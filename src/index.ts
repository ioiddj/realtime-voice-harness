/**
 * @file index.ts — Public API surface for realtime-voice-harness.
 * @module index
 *
 * The package entry point. Import harness pieces from here so internal
 * moves never break consumers.
 */
export { concatClips, DEFAULT_SAMPLE_RATE, type AudioClip } from './audio/AudioClip.js';
export type { ISpeechSynthesizer } from './speech/ISpeechSynthesizer.js';
export type {
  ISpeechTranscriber,
  TranscriptionResult,
} from './speech/ISpeechTranscriber.js';
export type {
  AudioListener,
  IRealtimeTransport,
  Unsubscribe,
} from './transport/IRealtimeTransport.js';
export {
  VoiceConversationHarness,
  type HarnessDrivers,
  type ScriptedTurn,
  type TurnResult,
} from './harness/VoiceConversationHarness.js';
export {
  AguiSseTransport,
  DEFAULT_CHAT_PATH,
  parseAguiSseText,
  type AguiSseTransportOptions,
} from './transports/AguiSseTransport.js';
export {
  LangChainTransport,
  type LangChainTransportOptions,
} from './transports/LangChainTransport.js';
export {
  OpenAiRealtimeTransport,
  DEFAULT_REALTIME_MODEL,
  DEFAULT_REALTIME_VOICE,
  type OpenAiRealtimeTransportOptions,
} from './transports/OpenAiRealtimeTransport.js';
export {
  TanStackTransport,
  type TanStackTransportOptions,
} from './transports/TanStackTransport.js';
export {
  createFakeToken,
  FAKE_TANSTACK_PROVIDER,
  FakeTanStackAdapter,
  FakeTanStackConnection,
} from './fakes/FakeTanStackAdapter.js';
export {
  FakeSynthesizer,
  FakeTranscriber,
  ScriptedAppTransport,
} from './fakes/FakeDoubles.js';
