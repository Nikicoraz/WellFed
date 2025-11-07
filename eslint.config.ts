import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    ignores: ["**/node_modules/**", "eslint.config.ts"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node },
    rules: {
      'no-unused-vars': 'warn',
      'no-duplicate-imports': 'error',
      'arrow-body-style': ['warn', 'always'],
      'camelcase': 'warn',
      'default-case': 'error', // https://eslint.org/docs/latest/rules/default-casem
      'default-param-last': 'error', // https://eslint.org/docs/latest/rules/default-param-last
      'prefer-const': 'warn',
      'semi': ['error', 'always'],
      'brace-style': ['warn', '1tbs'],
      'indent': ['warn', 4],
      'space-before-blocks': ['warn', 'always'],
    }
},
  tseslint.configs.recommended,
]);



