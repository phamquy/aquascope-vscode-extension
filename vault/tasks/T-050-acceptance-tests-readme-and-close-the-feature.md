---
id: T-050
title: "Acceptance tests, README and close the feature"
status: todo
priority: medium
feature: "008-whole-crate-analysis"
created: 2026-11-09
---

# T-050 Acceptance tests, README and close the feature

Spec: [[specs/features/008-whole-crate-analysis/spec.md]]

## Done when

- [ ] `crate.test.ts` passes AC1 to AC6 and AC8 to AC10, and feature 003's suites pass unchanged for AC7, in `npm test`
- [ ] The README describes analysing a file with its crate, the limits, and the linker and cargo cache it needs
- [ ] The spec's criteria are ticked, and feature 008 is `implemented` in the spec and `specs/product.md`
- [ ] `npm run typecheck && npm run lint && npm test` pass

## Notes

- Plan: [[specs/features/008-whole-crate-analysis/plan.md]].
