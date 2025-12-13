import js from "@eslint/js";
import globals from "globals";
import tseslintPlugin from "@typescript-eslint/eslint-plugin";
import tseslintParser from "@typescript-eslint/parser";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";

export default [
  // Ignore patterns
  {
    ignores: [
      "dist/**",
      "dist-electron/**",
      "release/**",
      "node_modules/**",
      "build/**",
      "*.config.js",
      "*.config.ts",
      "**/*.json",
      "**/*.md",
      ".vscode/**",
    ],
  },

  js.configs.recommended,

  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslintPlugin,
    },
    rules: {
      ...tseslintPlugin.configs.recommended.rules, 
    },
  },

  // JSON files - skip for now
  // {
  //   files: ["**/*.json"],
  //   plugins: { json },
  //   rules: { ...json.configs.recommended.rules },
  // },
  // Markdown files - skip for now due to parser issues
  // {
  //   files: ["**/*.md"],
  //   plugins: { markdown },
  //   rules: {},
  // },
  // CSS files - skip for now
  // {
  //   files: ["**/*.css"],
  //   plugins: { css },
  //   rules: { ...css.configs.recommended.rules },
  // },
];
