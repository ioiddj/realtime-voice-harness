/**
 * @file latency.ts — Turn-level latency budgets for voice UX assertions.
 * @module harness/latency
 *
 * Voice UX lives or dies on timing: how fast the app starts answering and
 * how long a turn takes end to end. The harness measures both on every
 * `TurnResult`; these helpers assert them so latency regressions fail the
 * suite instead of reaching users.
 */
import type { TurnResult } from './VoiceConversationHarness.js';

/** Latency ceilings for one turn. Every bound is optional; set what you own. */
export interface LatencyBudget {
  /** Max ms from send to first reply audio. */
  readonly timeToFirstAudioMs?: number;
  /** Max ms from send to completed transcription. */
  readonly roundTripMs?: number;
}

/**
 * Asserts a turn met its latency budget.
 * @param result - The completed turn to check.
 * @param budget - Ceilings to enforce.
 * @throws A plain Error naming the blown bound and both values.
 */
export function assertLatency(
  result: TurnResult,
  budget: LatencyBudget
): void {
  if (
    budget.timeToFirstAudioMs !== undefined &&
    (result.timeToFirstAudioMs === null ||
      result.timeToFirstAudioMs > budget.timeToFirstAudioMs)
  ) {
    throw new Error(
      `Latency budget blown: timeToFirstAudioMs=${String(result.timeToFirstAudioMs)} ` +
        `exceeds budget ${String(budget.timeToFirstAudioMs)}ms (heard=${JSON.stringify(result.heard)}).`
    );
  }
  if (
    budget.roundTripMs !== undefined &&
    result.roundTripMs > budget.roundTripMs
  ) {
    throw new Error(
      `Latency budget blown: roundTripMs=${String(result.roundTripMs)} ` +
        `exceeds budget ${String(budget.roundTripMs)}ms (heard=${JSON.stringify(result.heard)}).`
    );
  }
}
