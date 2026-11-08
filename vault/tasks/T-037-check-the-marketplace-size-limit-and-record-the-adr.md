---
id: T-037
title: "Check the Marketplace size limit and record the ADR"
status: todo
priority: medium
feature: "007-stack-heap-diagrams"
created: 2026-11-08
---

# T-037 Check the Marketplace size limit and record the ADR

Spec: [[specs/features/007-stack-heap-diagrams/spec.md]]

## Done when

- [ ] The Marketplace's package size limit is known, from its documentation or a test publish that needs your publisher
- [ ] ADR 0003 records shipping the Miri-built library, the limit and the new size cap
- [ ] If the limit is below what the package needs, the task stops and D2 goes back to the spec (D2)
- [ ] `npm run typecheck && npm run lint && npm test` pass

## Notes

- Plan: [[specs/features/007-stack-heap-diagrams/plan.md]]. Needs the user if the limit is not documented: a test publish uses their Marketplace publisher. The current cap is `MAX_BYTES` (150 MB) in `scripts/check-vsix.mjs`; the darwin-arm64 VSIX would be about 185 MB.
