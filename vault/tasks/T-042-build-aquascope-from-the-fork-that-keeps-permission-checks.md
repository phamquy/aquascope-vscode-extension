---
id: T-042
title: "Build Aquascope from the fork that keeps permission checks"
status: doing
priority: medium
feature: "003-run-analysis-at-cursor"
created: 2026-11-08
---

# T-042 Build Aquascope from the fork that keeps permission checks

Spec: [[specs/features/003-run-analysis-at-cursor/spec.md]]

## Done when

- [x] The fork [phamquy/aquascope](https://github.com/phamquy/aquascope) has the fix at tag `v0.4.0-vscode.1`, and the fix is offered upstream
- [x] `pin.env` names the fork and the upstream release it is based on; the embed vendoring script checks the embed against that release
- [x] ADR 0004 records the decision
- [x] Issue #31's function is analysed end to end against the development bundle, and its result is drawn in a real webview
- [x] `npm run typecheck && npm run lint && npm test` pass

## Notes

- Fixes issue #31. Aquascope v0.4.0's permission stepper gives up on any function that leaves early (`return`, `?`, `let … else`) and then branches again, and `AquascopeAnalysis::run` then discards the whole function, boundaries included. Upstream issue cognitive-engineering-lab/aquascope#157 reports the same failure. ADR 0004 has the mechanism and the evidence.
- The fix is one commit in the fork, `27ad0b3` on branch `keep-boundaries-when-steps-fail`, tagged `v0.4.0-vscode.1`. It returns such a function with its boundaries and no steps, logs the stepper's error, and adds `crates/aquascope/tests/analysis.rs`, which fails on v0.4.0 and passes with the fix. `cargo test -p aquascope`, `cargo fmt --check` and `cargo clippy -p aquascope -- -D warnings` pass. Offered upstream as cognitive-engineering-lab/aquascope#199.
- `pin.env` now names the fork's repository, tag and commit, and adds `AQUASCOPE_UPSTREAM_*` for v0.4.0. `vendor-aquascope-embed.sh` checks the published embed against the upstream release, because the fork does not change the frontend. The TypeScript bindings are unchanged.
- Spike 002's checkout was moved to the fork's tag and `build.sh` rebuilt the development bundle's binaries. With those binaries, the 16 fixtures other than `n3_early_return` give the same content as v0.4.0 (the order of entries in `steps` varies from run to run of either binary), so their captures still hold. ADR 0004 Appendix A has the comparison.
- New fixture `n3_early_return.rs` (issue #31's program) with its captured output. `analyze.test.ts` checks it end to end: `Config::parse` is analysed, with boundaries and no steps. `page.test.ts` draws it in a real webview with no problems.
- The README notes that such functions are drawn with markers but no tables, and that the package is built from the fork. The panel does not say why the tables are missing; that would be a feature change and is not part of this task.
