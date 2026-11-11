/**
 * Marks dist/cjs as CommonJS so require() works under a "type": "module" root.
 * Run as the last step of build:cjs.
 */
import { writeFileSync } from 'node:fs';

writeFileSync(
  new URL('../dist/cjs/package.json', import.meta.url),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n'
);
