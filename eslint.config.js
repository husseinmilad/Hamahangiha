import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'dev-dist/**/*', 'node_modules/**/*', 'scripts/**/*', 'firestore.rules.test.ts']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  firebaseRulesPlugin.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  }
];
