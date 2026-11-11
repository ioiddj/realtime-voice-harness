/**
 * @file live-checks.ts — Shared env gates for live provider suites.
 * @module examples/live-nim/live-checks
 *
 * Live suites cost real provider calls, so they skip unless explicitly
 * enabled: `NIM_LIVE_RUN=1` plus `NVIDIA_NIM_API_KEY` for NIM-backed suites,
 * `AGUI_BASE_URL` for the AG-UI endpoint suite.
 */

/** NIM chat endpoint. Defaults to NVIDIA NIM cloud. */
export const NIM_BASE_URL: string =
  process.env['NIM_BASE_URL'] ?? 'https://integrate.api.nvidia.com/v1';

/** NIM chat model. Defaults to Nemotron 3.5 Lightning. */
export const NIM_MODEL_ID: string =
  process.env['NIM_MODEL_ID'] ?? 'nvidia/nemotron-3.5-lightning-30b-a3b';

/** True when the NIM live suites may run. */
export const NIM_LIVE_ENABLED: boolean =
  process.env['NIM_LIVE_RUN'] === '1' &&
  (process.env['NVIDIA_NIM_API_KEY'] ?? '').length > 0;

/** NIM key for live suites (empty unless enabled). */
export const NIM_API_KEY: string =
  NIM_LIVE_ENABLED ? (process.env['NVIDIA_NIM_API_KEY'] as string) : '';

/** AG-UI endpoint under test, or null when the suite must skip. */
export const AGUI_BASE_URL: string | null =
  process.env['AGUI_BASE_URL'] ?? null;
