/* eslint-disable @typescript-eslint/no-unused-vars */

const RULES = {
  OFF: 0,
  WARNING: 1,
  ERROR: 2,
}

const { OFF, WARNING, ERROR } = RULES



/** @type {import('eslint').ESLint.Options['baseConfig']} */
module.exports = {
  // Rules for .js or .jsx files
  extends: ['ts-standard-next'],

  // Rules for .ts or .tsx files
  overrides: [
    {
      files: ['**/*.+(ts|tsx)'],
      parserOptions: {
        project: './tsconfig.base.json',
      },
    },
  ],
}
