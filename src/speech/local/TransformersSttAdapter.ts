/**
 * @file TransformersSttAdapter.ts — Local speech-to-text over transformers.js.
 * @module speech/local/TransformersSttAdapter
 *
 * Real STT with no keys and no cloud: runs an ONNX Whisper model in-process
 * via `@huggingface/transformers` (WASM by default, GPU when configured).
 * The model downloads once from the Hugging Face Hub on first use and is
 * cached locally afterwards. Import is lazy and dynamic, so CommonJS
 * consumers never `require()` the ESM-only engine.
 */
import type { DataType, DeviceType } from '@huggingface/transformers';
import { resampleClip } from '../../audio/AudioClip.js';
import type { AudioClip } from '../../audio/AudioClip.js';
import type {
  ISpeechTranscriber,
  TranscriptionResult,
} from '../ISpeechTranscriber.js';

/** Minimal structural type for the loaded ASR pipeline. */
interface SttPipeline {
  (
    audio: Float32Array,
    options?: { sampling_rate?: number }
  ): Promise<{ text: string } | Array<{ text: string }>>;
}

/** Options for {@link TransformersSttAdapter}. */
export interface TransformersSttOptions {
  /**
   * Hugging Face model id. Defaults to `'onnx-community/whisper-tiny.en'`
   * (small, fast, English-only; swap in a larger Whisper for accuracy).
   */
  readonly model?: string;
  /** Quantization/dtype override, e.g. `'q8'`. Defaults to the model default. */
  readonly dtype?: DataType;
  /** Execution device, e.g. `'webgpu'`. Defaults to WASM CPU. */
  readonly device?: DeviceType;
}

/** Default model: small, fast, English-only Whisper. */
export const DEFAULT_STT_MODEL: string = 'onnx-community/whisper-tiny.en';

/** Sample rate Whisper natively hears. Clips are resampled to this. */
export const WHISPER_SAMPLE_RATE: number = 16000;

/**
 * Local speech-to-text: Whisper in-process, no keys, no network after the
 * one-time model download.
 */
export class TransformersSttAdapter implements ISpeechTranscriber {
  private readonly model: string;
  private readonly dtype: DataType | undefined;
  private readonly device: DeviceType | undefined;
  private loaded: SttPipeline | null = null;

  /**
   * Creates the adapter. Downloads nothing; the model loads on first use.
   * @param options - Model id plus dtype/device overrides.
   */
  public constructor(options: TransformersSttOptions = {}) {
    this.model = options.model ?? DEFAULT_STT_MODEL;
    this.dtype = options.dtype;
    this.device = options.device;
  }

  /**
   * Transcribes spoken audio with the local Whisper model. Audio is
   * resampled to 16 kHz first: Whisper hears wrong (slow-motion) speech at
   * any other rate, which surfaces as confident hallucinations.
   * @param audio - Audio segment to recognize.
   * @returns The recognized text (may be empty on silence).
   */
  public async transcribe(audio: AudioClip): Promise<TranscriptionResult> {
    const pipeline = await this.load();
    const clip = resampleClip(audio, WHISPER_SAMPLE_RATE);
    const output = await pipeline(clip.samples, {
      sampling_rate: clip.sampleRate,
    });
    const text = Array.isArray(output)
      ? output.map((part) => part.text).join(' ')
      : output.text;
    return { text: text.trim() };
  }

  private async load(): Promise<SttPipeline> {
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
      'automatic-speech-recognition',
      this.model,
      pipelineOptions
    )) as unknown as SttPipeline;
    this.loaded = pipeline;
    return pipeline;
  }
}
