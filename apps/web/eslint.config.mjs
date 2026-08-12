import { nextConfig } from "@wapp/config/eslint-next";

export default [
  ...nextConfig,
  {
    // FRD-001 Volume-9 — public/sw.js is Serwist's compiled output (from
    // src/app/sw.ts), regenerated on every `next build`, gitignored, and
    // not part of this project's tsconfig — not source to lint.
    ignores: ["public/sw.js"],
  },
];
