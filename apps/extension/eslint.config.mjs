/**
 * ESLint 9 扁平配置（Flat Config）
 * - TypeScript：typescript-eslint（不单独引入 @eslint/js）
 * - React：jsx/tsx 上 react + react-hooks（jsx-runtime）
 * - 格式：eslint-plugin-prettier + eslint-config-prettier
 */
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const reactFiles = ['**/*.{jsx,tsx}'];

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.plasmo/**']
  },

  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
        chrome: 'readonly'
      }
    }
  },

  ...tseslint.configs.recommended,

  {
    files: reactFiles,
    settings: {
      react: {
        version: 'detect'
      }
    },
    ...react.configs.flat.recommended,
    ...react.configs.flat['jsx-runtime']
  },
  {
    files: reactFiles,
    ...reactHooks.configs.flat['recommended-latest']
  },

  {
    plugins: { prettier: eslintPluginPrettier },
    rules: {
      'prettier/prettier': 'error',
      'no-unused-vars': 'off',
      quotes: ['error', 'single'],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },

  /**
   * 扩展 `src` 下任意层级 `*.ts` / `*.tsx` 文件名统一 **camelCase**（小驼峰）；`index.ts` 为聚合出口；Plasmo 根入口 `background.ts` / `popup.tsx` / `sidepanel.tsx` / `devtools.tsx` 与 `mnemonic.ts` 见 `ignores`。
   */
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: [
      'src/extension/web3/base/mnemonic.ts',
      'src/background.ts',
      'src/popup.tsx',
      'src/sidepanel.tsx',
      'src/devtools.tsx'
    ],
    plugins: { unicorn: eslintPluginUnicorn },
    rules: {
      'unicorn/filename-case': [
        'error',
        {
          case: 'camelCase',
          ignore: [/^index\.ts$/, /^index\.tsx$/]
        }
      ]
    }
  },

  eslintConfigPrettier
);
