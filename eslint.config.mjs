import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
    },
  },
  {
    // Rules of Hooks + exhaustive deps (and the compiler-backed purity checks) for the app.
    files: ['mobile/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat['recommended-latest'],
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.agents/**',
      '**/_bmad/**',
      '**/coverage/**',
      '**/.expo/**',
      'mobile/android/**',
      'mobile/ios/**',
    ],
  }
);
