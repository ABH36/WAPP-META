/**
 * Conventional Commits, enforced by commit-msg hook (see .husky/commit-msg).
 * Scopes correspond to SDP-001 §6's approved module names — keeps commit
 * history traceable to a specific bounded context, same discipline as
 * TAD-001 GIT-003's feature-branch naming (feature/customer-module, etc.).
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"],
    ],
    "scope-case": [2, "always", "kebab-case"],
    "subject-case": [0],
  },
};
