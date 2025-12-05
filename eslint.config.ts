import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: ["**/node_modules/**", "eslint.config.ts", "**/dist/**", "**/frontend/**"],
  },
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node },
    rules: {
      'no-unused-vars': 'warn',
      'no-duplicate-imports': 'error',
      'arrow-body-style': ['warn', 'always'],
      'camelcase': 'warn',
      'default-case': 'error', // https://eslint.org/docs/latest/rules/default-case
      'default-param-last': 'error', // https://eslint.org/docs/latest/rules/default-param-last
      'prefer-const': 'warn',
      'semi': ['error', 'always'],
      'brace-style': ['warn', '1tbs'],
      'indent': ['warn', 4],
      'space-before-blocks': ['warn', 'always'],
      'sort-imports': 'warn',
      'require-await': 'error',
      'no-undefined': 'error',
      'keyword-spacing': ["warn", { "before": true, "after": true}]
    },
  },
  tseslint.configs.recommended,
]);



