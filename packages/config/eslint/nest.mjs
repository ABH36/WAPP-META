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
  {
    // `expect(mock.method).toHaveBeenCalledWith(...)` is a standard Jest
    // pattern that this rule can't distinguish from an actually-unsafe
    // unbound method reference — the well-known, accepted exception for
    // typescript-eslint's strict-type-checked config in Jest test files.
    files: ["**/*.spec.ts"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
    },
  },
];

export default nestConfig;
