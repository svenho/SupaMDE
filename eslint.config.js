// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'dist-demo/**', 'node_modules/**', 'easy-markdown-editor/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        // Kein projectService: Dateien unter test/ werden von ihm nicht
        // erfasst (allowDefaultProject deckt nur *.config.*), und ein
        // zusätzliches tsconfig zieht er nicht von selbst heran. Das
        // explizite Array nennt beide Projekte, die es im Repo gibt.
        project: ['./tsconfig.test.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
