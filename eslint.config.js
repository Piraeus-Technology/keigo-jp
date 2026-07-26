const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ['coverage/**', 'dist/**'],
  },
  {
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['jest.setup.ui.js'],
    languageOptions: {
      globals: { jest: 'readonly', require: 'readonly', module: 'readonly' },
    },
  },
]);
