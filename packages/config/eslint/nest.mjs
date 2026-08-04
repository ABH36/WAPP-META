// @wapp/config — NestJS ESLint extension
import { baseConfig } from "./base.mjs";

/** @type {import("eslint").Linter.Config[]} */
export const nestConfig = [
  ...baseConfig,
  {
    rules: {
      // Nest relies on decorators + DI; these two conflict with that pattern
      // and are intentionally relaxed here only (never in shared domain logic).
      "@typescript-eslint/no-extraneous-class": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
];

export default nestConfig;
