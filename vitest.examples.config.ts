import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'examples/langchain/**/*.test.ts',
      'examples/local-speech/**/*.test.ts',
      'examples/openai-realtime/**/*.test.ts',
      'examples/tanstack/**/*.test.ts',
    ],
  },
});
