---
feature: 003-run-analysis-at-cursor
---

# Tasks

Each line maps to a note in `vault/tasks/`. Status lives in the note, not here.

- [x] T-013 Settle Q1 and Q2 by experiment and verify cargo config overrides (done when: every check in plan Appendix A has a result, Q1 and Q2 are resolved in the spec and R6 names the flag strategy; needs your approval)
- [x] T-014 Generate and vendor Aquascope result types (done when: generated types are in `src/analysis/bindings/` with a provenance note and typecheck passes; needs your approval)
- [x] T-015 Assemble a development bundle and fixture test workspace (done when: `scripts/dev-bundle.mjs` builds the R3 layout, the tool runs from it, and tests open the fixture workspace)
- [x] T-016 Contribute the analyze command and its settings (done when: command in the palette for Rust files only, both settings in the UI and README, contribution test passes)
- [x] T-017 Resolve the toolchain and build the run environment (done when: unit tests cover R3 to R5)
- [x] T-018 Write the temporary single-file crate (done when: unit tests cover edition detection, crate contents and cleanup; R2, R9)
- [x] T-019 Run cargo aquascope with progress, cancel, timeout and logging (done when: process group killed on cancel and timeout, runs logged, AC8 tested against the dev bundle; R8, R11)
- [x] T-020 Parse the output and select the body at the cursor (done when: unit tests cover fixture 05's three bodies, nesting, no body and a non-ASCII line; R7)
- [x] T-021 Classify failures, show the summary and wire the command (done when: captured diagnostics map to each R10 category and the command works end to end; R10, R13)
- [x] T-022 Integration tests for the acceptance criteria (done when: AC1 to AC7 and AC9 pass in `npm test`, AC8 and AC11 recorded, spec criteria ticked)
- [x] T-042 Build Aquascope from the fork that keeps permission checks (done when: issue #31's function is analysed end to end and drawn, the pin names the fork, ADR 0004 records it; after the feature, from issue #31)
- [x] T-058 Analyse moves out of recursive types (done when: the fork skips an untracked interior path of a moved place, with a test, in tag `v0.4.0-vscode.5`; the pin, development bundle and bindings follow; an end-to-end test analyses a linked stack's `pop`, failing on the previous bundle; issue #61)
- [x] T-060 Analyse walks over recursive types (done when: the fork adds every place the body uses to its table of tracked places, with a test, in tag `v0.4.0-vscode.6`; the pin, development bundle and bindings follow; an end-to-end test analyses a binary search tree's `remove_rec`, failing on the previous bundle; issue #64)
- [x] T-064 Survive a stepper panic (done when: the fork catches a panic in the permission steps like an error, with a test that fails without it; tag `v0.4.0-vscode.9`; the pin, development bundle and bindings follow; an end-to-end test analyses a file with a plain `loop` and `break`, which failed with exit code 101; issue #68)

T-013 comes first because its answers set the runner's flag strategy and the R10 error samples. T-014 and T-015 are independent of each other and can run in either order after it. T-016 to T-020 each build one module and need only T-015's harness; T-021 joins them, and T-022 comes last.
