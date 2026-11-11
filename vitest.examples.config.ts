import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'examples/langchain/**/*.test.ts',
      'examples/openai-realtime/**/*.test.ts',
    ],
  },
});
