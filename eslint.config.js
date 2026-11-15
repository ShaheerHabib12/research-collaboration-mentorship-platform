// ESLint flat config: server/scripts/tests (Node, CommonJS) and client/src (React, ES modules).
const js = require('@eslint/js');
const globals = require('globals');
module.exports = [
  { ignores: ['client/dist/**', 'node_modules/**', 'client/node_modules/**', 'data/**', 'docs/**', 'coverage/**'] },
  js.configs.recommended,
  { files: ['server/**/*.js', 'scripts/**/*.js', 'tests/**/*.js', 'shared/**/*.js', '*.config.js', 'cypress.config.js'], languageOptions: { sourceType: 'commonjs', ecmaVersion: 2023, globals: { ...globals.node, ...globals.jest, ...globals.browser } }, rules: { 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }], 'no-empty': ['error', { allowEmptyCatch: true }], 'no-control-regex': 'off' } },
  { files: ['cypress/**/*.js', 'k6/**/*.js'], languageOptions: { sourceType: 'module', globals: { ...globals.browser, cy: 'readonly', Cypress: 'readonly', describe: 'readonly', it: 'readonly', expect: 'readonly', beforeEach: 'readonly', __ENV: 'readonly', __VU: 'readonly', __ITER: 'readonly' } } },
  { files: ['client/src/**/*.{js,jsx}', 'client/vite.config.js'], languageOptions: { sourceType: 'module', ecmaVersion: 2023, parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.browser } }, rules: { 'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^(React|Icon)$', caughtErrors: 'none' }], 'no-empty': ['error', { allowEmptyCatch: true }] } }
];
