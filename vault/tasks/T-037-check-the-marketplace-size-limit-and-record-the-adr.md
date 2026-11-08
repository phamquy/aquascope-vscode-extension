---
id: T-037
title: "Check the Marketplace size limit and record the ADR"
status: review
priority: medium
feature: "007-stack-heap-diagrams"
created: 2026-11-08
---

# T-037 Check the Marketplace size limit and record the ADR

Spec: [[specs/features/007-stack-heap-diagrams/spec.md]]

## Done when

- [x] The Marketplace's package size limit is known, from its documentation or a test publish that needs your publisher: not documented; by the owner's decision, recorded as unverified and checked at the first publish
- [x] ADR 0003 records shipping the Miri-built library, the limit and the new size cap
- [x] If the limit is below what the package needs, the task stops and D2 goes back to the spec (D2)
- [x] `npm run typecheck && npm run lint && npm test` pass (see Notes: feature 006's focus tests are flaky)

## Notes

- Plan: [[specs/features/007-stack-heap-diagrams/plan.md]]. Needs the user if the limit is not documented: a test publish uses their Marketplace publisher. The current cap is `MAX_BYTES` (150 MB) in `scripts/check-vsix.mjs`; the darwin-arm64 VSIX would be about 185 MB.
- Done on 2026-11-08. The Marketplace documents no package size limit: the publishing guide states only a 30-keyword cap, and the numbers found elsewhere are other registries' (Open VSX 250 to 512 MB, Azure DevOps 20 to 25 MB). The sources are in ADR 0003's Appendix A.
- A test publish would have settled it but needs the `jackpham` Marketplace publisher and puts a throwaway extension on the Marketplace for a while. Asked on 2026-11-08, the owner chose to record the limit as unverified instead: the extension is installed from VSIX files today.
- `docs/adr/0003-ship-miri-sysroot.md`: ship the Miri sysroot as `miri-sysroot/` in the bundle, built by `cargo miri setup` at packaging time; raise `check-vsix.mjs`'s cap to 200 MB (done in T-038); the first Marketplace publish is the check, with a first-run build, a download or a companion extension as fallbacks. The spec's D2 and R6, the plan and the product spec's size risk follow.
- The limit is not below what the package needs as far as anyone knows, so the task did not stop the feature.
- `npm run typecheck && npm run lint` pass. `npm test` passed 100 of 100 in two of four runs; the other two failed one or two of feature 006's `titleButton.test.ts` tests, which timed out waiting for VS Code to report a focus change. This task changes no code or tests, so the failures are pre-existing flakiness from T-034, to be fixed separately.
