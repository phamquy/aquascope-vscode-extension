---
id: T-030
title: "Make the test run strict about the toolchain on request"
status: review
priority: medium
feature: "005-package-per-platform-vsix"
created: 2026-11-07
---

# T-030 Make the test run strict about the toolchain on request

Spec: [[specs/features/005-package-per-platform-vsix/spec.md]]

## Done when

- [x] with `AQUASCOPE_REQUIRE_TOOLCHAIN=1`, a missing bundle stops `npm test` and a toolchain test fails instead of skipping, the default still skips, and harness tests cover both; R5, AC4

## Notes

- `src/test/runTest.ts`: with `AQUASCOPE_REQUIRE_TOOLCHAIN=1`, a bundle path that does not exist stops the run before VS Code starts, naming the path.
- `src/test/suite/harness.ts`: `requireToolchain(ctx, env = process.env)` reads the environment when called; with `AQUASCOPE_REQUIRE_TOOLCHAIN=1` and no `AQUASCOPE_TEST_TOOLCHAIN` it throws instead of skipping. The extension host inherits the variable from the test runner's environment.
- `harness.test.ts`: one new test covers skipping (variable unset or empty), failing when required, and returning the root when given.
- Checked end to end (2026-11-06): strict with the dev bundle, exit 0, 92 passing, 0 skipped; strict with a missing path, exit 1 before launch; strict with an empty path, exit 1; default with an empty path, exit 0, 75 passing and 17 skipped, as before.

