/**
 * @file TransformersTtsAdapter.ts — Local text-to-speech over transformers.js.
 * @module speech/local/TransformersTtsAdapter
 *
 * Real TTS with no keys and no cloud: runs an ONNX Supertonic model
 * in-process via `@huggingface/transformers`. The model (and the selected
 * speaker embedding) download once from the Hugging Face Hub on first use
 * and are cached locally afterwards. Import is lazy and dynamic, so
 * CommonJS consumers never `require()` the ESM-only engine.
 */
import type { DataType, DeviceType } from '@huggingface/transformers';
import type { AudioClip } from '../../audio/AudioClip.js';
import type { ISpeechSynthesizer } from '../ISpeechSynthesizer.js';

/** Minimal structural type for the loaded TTS pipeline. */
interface TtsPipeline {
  (
    text: string,
    options?: { speaker_embeddings?: string | Float32Array }
  ): Promise<{ audio: Float32Array; sampling_rate: number }>;
}

/** Options for {@link TransformersTtsAdapter}. */
export interface TransformersTtsOptions {
  /**
   * Hugging Face model id. Defaults to the ONNX Kokoro community build.
   */
  readonly model?: string;
  /**
   * Speaker embedding: a voice-file URL or raw embedding vector. Defaults
   * to the `af_heart` Kokoro voice.
   */
  readonly speakerEmbeddings?: string | Float32Array;
  /** Quantization/dtype override, e.g. `'q8'`. Defaults to the model default. */
  readonly dtype?: DataType;
  /** Execution device, e.g. `'webgpu'`. Defaults to WASM CPU. */
  readonly device?: DeviceType;
}

/** Default model: ONNX Supertonic community build. */
export const DEFAULT_TTS_MODEL: string = 'onnx-community/Supertonic-TTS-ONNX';

/** Default voice: Supertonic `F1` speaker embedding. */
export const DEFAULT_TTS_VOICE: string =
  'https://huggingface.co/onnx-community/Supertonic-TTS-ONNX/resolve/main/voices/F1.bin';

/**
 * Local text-to-speech: Kokoro in-process, no keys, no network after the
 * one-time model download.
 */
export class TransformersTtsAdapter implements ISpeechSynthesizer {
  private readonly model: string;
  private readonly speakerEmbeddings: string | Float32Array;
  private readonly dtype: DataType | undefined;
  private readonly device: DeviceType | undefined;
  private loaded: TtsPipeline | null = null;

  /**
   * Creates the adapter. Downloads nothing; the model loads on first use.
   * @param options - Model id, voice, plus dtype/device overrides.
   */
  public constructor(options: TransformersTtsOptions = {}) {
    this.model = options.model ?? DEFAULT_TTS_MODEL;
    this.speakerEmbeddings = options.speakerEmbeddings ?? DEFAULT_TTS_VOICE;
    this.dtype = options.dtype;
    this.device = options.device;
  }

  /**
   * Synthesizes speech with the local Supertonic model.
   * @param text - Utterance to speak. Must be non-empty.
   * @returns PCM audio at the model's native sample rate.
   */
  public async synthesize(text: string): Promise<AudioClip> {
    if (text.length === 0) {
      throw new Error('TransformersTtsAdapter requires non-empty text.');
    }
    const pipeline = await this.load();
    const output = await pipeline(text, {
      speaker_embeddings: this.speakerEmbeddings,
    });
    return {
      samples: output.audio,
      sampleRate: output.sampling_rate,
    };
  }

  private async load(): Promise<TtsPipeline> {
    if (this.loaded !== null) {
      return this.loaded;
    }
    const engine = await import('@huggingface/transformers');
    const pipelineOptions: { dtype?: DataType; device?: DeviceType } = {};
    if (this.dtype !== undefined) {
      pipelineOptions.dtype = this.dtype;
    }
    if (this.device !== undefined) {
      pipelineOptions.device = this.device;
    }
    const pipeline = (await engine.pipeline(
      'text-to-speech',
      this.model,
      pipelineOptions
    )) as unknown as TtsPipeline;
    this.loaded = pipeline;
    return pipeline;
  }
}
