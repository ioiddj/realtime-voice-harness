import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // NOTE: the project service (`TSSERVER_PROJECT_SERVICE`) is created
        // once per eslint run from the FIRST linted file's options
        // (typescript-estree `populateProjectService` uses `??=`), so these
        // options must live here in the base config: a `files:`-scoped
        // override only applies when an examples file happens to be parsed
        // first, which made examples linting order-dependent and flaky.
        // The service only auto-discovers `tsconfig.json`/`jsconfig.json`,
        // never `tsconfig.examples.json`, so examples files are linted
        // against the default project; they import their type surface
        // explicitly. `**` is disallowed in these globs, so each examples
        // subdir needs its own one-level entry (other workstreams: add
        // yours here, e.g. 'examples/bun/*.ts').
        projectService: {
          // Nine example files share the default project (the service only
          // auto-discovers tsconfig.json); the cap below is the sanctioned
          // escape hatch for this known-small set.
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 20,
          allowDefaultProject: [
            'examples/agui/*.ts',
            'examples/bun/*.ts',
            'examples/jest/*.ts',
            'examples/langchain/*.ts',
            'examples/local-speech/*.ts',
            'examples/midscene/*.ts',
            'examples/node/*.mts',
            'examples/openai-realtime/*.ts',
            'examples/tanstack/*.ts',
            'examples/playwright/*.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true },
      ],
    },
  },
  {
    // Test callbacks are idiomatically async even without an await
    // (frameworks accept async hooks/assertions); the rule stays on for src/.
    // Rules-only override: does not touch parserOptions, so it cannot
    // recreate the project service (see note above).
    files: ['examples/**/*.test.ts', 'examples/**/*.spec.ts', 'tests/**/*.test.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  }
);
