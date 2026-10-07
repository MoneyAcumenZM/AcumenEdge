import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // A leading underscore marks a parameter that is part of a signature
      // but deliberately unused.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // shadcn/ui components export their variant helpers next to the
    // component, and each context module exports its provider together with
    // its hook. Both are deliberate, and only cost a full reload instead of
    // a hot update when one of these files is edited in development.
    files: ["src/components/ui/**/*.{ts,tsx}", "src/**/*Context.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
);
