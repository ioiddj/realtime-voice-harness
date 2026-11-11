/** @file playwright.config.ts — Playwright config for the Midscene voice example (no webServer; the live AI test additionally needs a model key, a browser, and MIDSCENE_LIVE_RUN=1, otherwise it skips). @module examples/midscene/playwright-config */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'voice-harness.spec.ts',
  reporter: 'list',
});
