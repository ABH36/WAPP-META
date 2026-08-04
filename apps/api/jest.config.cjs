/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@wapp/shared-types$": "<rootDir>/../../../packages/shared-types/src/index.ts",
    // NestJS source uses ESM-style ".js" extensions on relative imports (correct
    // for tsc/nest build's CommonJS resolution), but ts-jest doesn't remap them
    // back to the ".ts" source files — strip the extension so Jest resolves the
    // same files tsc does. Caught by actually running the e2e suite, not by
    // typecheck/lint/build (all three tolerate this without complaint).
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
