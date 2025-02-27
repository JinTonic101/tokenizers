import { promisify } from "util";

import { metaspaceDecoder } from "../../bindings/decoders";
import { BPE, BPEOptions, Model } from "../../bindings/models";
import { nfkcNormalizer } from "../../bindings/normalizers";
import { metaspacePreTokenizer } from "../../bindings/pre-tokenizers";
import { Tokenizer } from "../../bindings/tokenizer";
import { bpeTrainer } from "../../bindings/trainers";
import { BaseTokenizer } from "./base.tokenizer";

export interface SentencePieceBPETokenizerOptions extends OptionsWithDefaults {
  dropout?: number;
  mergesFile?: string;
  vocabFile?: string;
}

interface OptionsWithDefaults {
  /**
   * @default true
   */
  addPrefixSpace?: boolean;
  /**
   * @default "▁"
   */
  replacement?: string;
  /**
   * @default "<unk>"
   */
  unkToken?: string;
}

export interface SentencePieceBPETrainOptions {
  /**
   * @default []
   */
  initialAlphabet?: string[];
  /**
   * @default 1000
   */
  limitAlphabet?: number;
  /**
   * @default 2
   */
  minFrequency?: number;
  /**
   * @default true
   */
  showProgress?: boolean;
  /**
   * @default ["<unk>"]
   */
  specialTokens?: string[];
  /**
   * @default 30000
   */
  vocabSize?: number;
}

type SentencePieceBPETokenizerConfig = SentencePieceBPETokenizerOptions &
  Required<OptionsWithDefaults>;

/**
 * Represents the BPE algorithm, with the pretokenization used by SentencePiece
 */
export class SentencePieceBPETokenizer extends BaseTokenizer<
  SentencePieceBPETokenizerConfig
> {
  private static readonly defaultOptions: SentencePieceBPETokenizerConfig = {
    addPrefixSpace: true,
    replacement: "▁",
    unkToken: "<unk>"
  };

  private readonly defaultTrainOptions: Required<SentencePieceBPETrainOptions> = {
    initialAlphabet: [],
    limitAlphabet: 1000,
    minFrequency: 2,
    showProgress: true,
    specialTokens: ["<unk>"],
    vocabSize: 30000
  };

  private constructor(
    tokenizer: Tokenizer,
    configuration: SentencePieceBPETokenizerConfig
  ) {
    super(tokenizer, configuration);
  }

  static async fromOptions(
    options?: SentencePieceBPETokenizerOptions
  ): Promise<SentencePieceBPETokenizer> {
    const opts = { ...this.defaultOptions, ...options };

    let model: Model;
    if (opts.vocabFile && opts.mergesFile) {
      const modelOptions: BPEOptions = {
        dropout: opts.dropout,
        unkToken: opts.unkToken
      };

      const fromFiles = promisify<string, string, BPEOptions, Model>(BPE.fromFiles);
      model = await fromFiles(opts.vocabFile, opts.mergesFile, modelOptions);
    } else {
      model = BPE.empty();
    }

    const tokenizer = new Tokenizer(model);
    if (tokenizer.tokenToId(opts.unkToken) !== undefined) {
      tokenizer.addSpecialTokens([opts.unkToken]);
    }

    tokenizer.setNormalizer(nfkcNormalizer());

    const preTokenizer = metaspacePreTokenizer(opts.replacement, opts.addPrefixSpace);
    tokenizer.setPreTokenizer(preTokenizer);

    const decoder = metaspaceDecoder(opts.replacement, opts.addPrefixSpace);
    tokenizer.setDecoder(decoder);

    return new SentencePieceBPETokenizer(tokenizer, opts);
  }

  /**
   * Train the model using the given files
   *
   * @param files Files to use for training
   * @param [options] Training options
   */
  async train(files: string[], options?: SentencePieceBPETrainOptions): Promise<void> {
    const mergedOptions = { ...this.defaultTrainOptions, ...options };
    const trainer = bpeTrainer(mergedOptions);

    this.tokenizer.train(trainer, files);
  }
}
