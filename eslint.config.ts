import globals from "globals";
import * as pluginLit from "eslint-plugin-lit";
import pluginJs from "@eslint/js";
import tseslint, { Config } from "typescript-eslint";

export default [
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { ignores: ["dist/"] },
  { languageOptions: { globals: globals.browser } },

  pluginJs.configs.recommended,
  pluginLit.configs["flat/all"],
  ...tseslint.configs.recommended,
  { rules: { "lit/no-template-map": "off" } },
  { rules: { "lit/no-template-arrow": "off" } },
] satisfies Config;
