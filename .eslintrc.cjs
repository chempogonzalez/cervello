// @ts-check
const RULES = {
  OFF: 0,
  WARNING: 1,
  ERROR: 2,
}

const { OFF, WARNING, ERROR } = RULES


const TYPESCRIPT_RULES = {
  '@typescript-eslint/strict-boolean-expressions': OFF,
  '@typescript-eslint/no-extraneous-class': [ERROR, { allowStaticOnly: true }],
  '@typescript-eslint/array-type': [ERROR, { default: 'generic', readonly: 'generic' }],
  '@typescript-eslint/return-await': [WARNING, 'never'],
}


/** @type {import('eslint').ESLint.Options['baseConfig']} */
module.exports = {
  extends: ['standard-with-typescript', 'standard-jsx'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: [
      'tsconfig.json',
      'tsconfig.eslint.json',
      './test-app/tsconfig.json',
    ],
  },
  rules: {
    'operator-linebreak': [ERROR, 'before'],
    'no-return-await': OFF,
    'comma-dangle': [ERROR, 'always-multiline'],
    'no-multiple-empty-lines': [ERROR, { max: 8, maxBOF: 1, maxEOF: 0 }],
    'no-console': WARNING,
    'no-underscore-dangle': [ERROR, { allowAfterThis: true, allowFunctionParams: false }],
    ...TYPESCRIPT_RULES,
  },
}
