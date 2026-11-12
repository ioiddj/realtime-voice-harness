/**
 * @file WavCodec.ts — Minimal 16-bit PCM mono WAV encoder/decoder.
 * @module audio/WavCodec
 *
 * Dependency-free conversion between {@link AudioClip} and WAV bytes so
 * developers can save harness audio and listen to it with any player
 * (`ffplay`, Audacity, a browser) when debugging voice tests.
 */
import { DEFAULT_SAMPLE_RATE, type AudioClip } from './AudioClip.js';

/** WAV header size in bytes (44-byte RIFF header, PCM, no extra chunks). */
export const WAV_HEADER_SIZE: number = 44;

/**
 * Encodes a clip as 16-bit PCM mono WAV bytes.
 * @param clip - Audio to encode. Samples are clamped to [-1, 1].
 * @returns WAV file bytes (header + samples).
 */
export function encodeWav(clip: AudioClip): Uint8Array {
  const dataBytes = clip.samples.length * 2;
  const bytes = new Uint8Array(WAV_HEADER_SIZE + dataBytes);
  const view = new DataView(bytes.buffer);
  const writeAscii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, clip.sampleRate, true);
  view.setUint32(28, clip.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < clip.samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, clip.samples[i] as number));
    view.setInt16(WAV_HEADER_SIZE + i * 2, Math.round(clamped * 32767), true);
  }
  return bytes;
}

/**
 * Decodes 16-bit PCM mono WAV bytes produced by {@link encodeWav} (or any
 * tool writing them, e.g. ffmpeg). Extra chunks (`LIST`, `bext`, ...),
 * which real-world files commonly carry between `fmt ` and `data`, are
 * skipped; format requirements (PCM, mono, 16-bit) are still enforced.
 * @param bytes - WAV file bytes.
 * @returns The decoded clip (tag is not preserved by the format).
 */
export function decodeWav(bytes: Uint8Array): AudioClip {
  if (bytes.length < 12) {
    throw new Error('decodeWav requires at least a 12-byte RIFF header.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const readAscii = (offset: number, length: number): string => {
    let text = '';
    for (let i = 0; i < length; i++) {
      text += String.fromCharCode(view.getUint8(offset + i));
    }
    return text;
  };
  if (readAscii(0, 4) !== 'RIFF' || readAscii(8, 4) !== 'WAVE') {
    throw new Error('decodeWav requires a RIFF/WAVE file.');
  }
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataBytes = 0;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = readAscii(offset, 4);
    const size = view.getUint32(offset + 4, true);
    if (id === 'fmt ') {
      if (offset + 24 > bytes.length) {
        throw new Error('decodeWav found a truncated fmt chunk.');
      }
      audioFormat = view.getUint16(offset + 8, true);
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (id === 'data') {
      dataOffset = offset + 8;
      dataBytes = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (dataOffset < 0) {
    throw new Error('decodeWav found no data chunk.');
  }
  if (audioFormat !== 1 || channels !== 1 || bitsPerSample !== 16) {
    throw new Error('decodeWav supports 16-bit PCM mono WAV only.');
  }
  const count = Math.floor(dataBytes / 2);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    samples[i] = view.getInt16(dataOffset + i * 2, true) / 32767;
  }
  return {
    samples,
    sampleRate: sampleRate === 0 ? DEFAULT_SAMPLE_RATE : sampleRate,
  };
}
