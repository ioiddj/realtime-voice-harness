const path = require('path');

const rootDir = path.join(__dirname, '..', '..');

/** @type {import('jest').Config} */
module.exports = {
  rootDir,
  roots: [path.join(rootDir, 'examples', 'jest')],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/examples/jest/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript' },
          target: 'es2022',
        },
        module: { type: 'commonjs' },
      },
    ],
  },
};
