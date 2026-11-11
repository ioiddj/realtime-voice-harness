/** @file playwright.config.ts — Playwright config for the pure-logic voice example (no browser, no webServer). @module examples/playwright/playwright-config */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'voice-harness.spec.ts',
  reporter: 'list',
});
