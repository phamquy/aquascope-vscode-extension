---
feature: 010-stepper-early-exits
---

# Plan

## Approach

The work is in the Aquascope fork's stepper and follows the spike (spec Appendix B), split in two tasks so that each one is a fork change with its own tag, pin and end-to-end test, as T-058 and T-060 were.

The first task makes the spike's change reviewable. In `hir_steps.rs`, `handle_expr_if` and `handle_expr_match` find the arms whose type is `!` from the body's typeck results and pass them to `open_branch` with the branching expression's own MIR locations; the `while` and `for` desugarings pass none, since their `break` arm is the loop's exit and they step correctly today. In `segmented_mir.rs`, `mk_branch` takes the join point from a new `continuation_after` when some arms diverge and at least one continues: among the blocks the `switchInt` dominates, outside the expression's own locations and post-dominating every continuing arm, the first, and in it the first location after the expression's own. A continuing arm that starts with a `FalseEdge` is tested from its real target (D3). Every other branch keeps the least post-dominator, so the functions that step today are untouched (R4).

The second task adds `let … else`. The stepper visits a `let` statement without opening a branch, so a `let … else` followed by another branch fails with "opening a branch missed a step". `visit_stmt` will open a branch at the pattern's `switchInt` for a `LetStmt` with an `else` block, visit the `else` block as the diverging arm, and close the branch, with the same `Divergence` so that the join point is the first location after the `let`. Whether the pattern's test produces one `switchInt` or several (a nested pattern) is checked first; several are handled by the implicit child branches the stepper already opens for a `match`.

Alternatives considered: fixing `CleanedBody::successors` instead of stepping past false edges (deferred to upstream by D3, since it changes dominators everywhere); giving a branch whose every arm diverges no join point (tried in the spike; it panicked, and the shape is left for later by D2).

## VS Code APIs and contribution points

- None. The extension changes only its pin, its fixtures and tests, and ADR 0004 (R7).

## Files touched

- Fork, `crates/aquascope/src/analysis/stepper/hir_steps.rs`: divergence of `if` and `match` arms (first task); `let … else` as a branch (second task).
- Fork, `crates/aquascope/src/analysis/stepper/segmented_mir.rs`: `Divergence`, `continuation_after`, and `mk_branch` choosing the join point.
- Fork, `crates/aquascope/src/analysis/ir_mapper/mir_locations.rs`: a getter for a node's locations.
- Fork tests: `tests/steps/*.test` with snapshots for each shape that now steps; `tests/analysis.rs` cases that pin the boundaries-only result of the two shapes D2 leaves for later.
- Extension: `spikes/002-toolchain-bundling/pin.env`, `docs/adr/0004-build-aquascope-from-a-fork.md`, `src/analysis/bindings/README.md` (regenerated), `src/test/suite/analyze.test.ts`, a `let … else` fixture in `src/test/fixtures/workspace/` with its README line, the task notes, `tasks.md`, and the spec's ticks.

## Risks

- A join point chosen wrongly would give wrong tables, which is worse than none. Each shape that steps gets a snapshot whose letters are checked by hand against the code before it is accepted, as the spike did for the value moved only in the returning arm (AC3, AC4).
- Arms of type `!` that are not exits, such as a `loop` without `break` used as an expression, could be taken for diverging. The spike's suite showed no change in the existing snapshots; the first task adds a `match` arm that calls a function returning `!` as a case.
- A stepper panic aborts the whole crate (#68). Until #68 is fixed, a change here that panics on some shape the tests do not cover would crash user files; the tests include the shapes the spike saw fail, and R5 forbids turning an error into a panic.
- The `let … else` lowering may differ from what the plan assumes; the second task starts by reading its MIR and adjusts before writing code.

## Test strategy

- Fork, steps: the spike's cases 1 to 7 as snapshot tests (early `return` then a branch, a value moved only in the returning arm, `?` chain, `match` with a returning arm, `Config::parse`, the tree's `next`, `remove_rec` with a simple assignment), plus a `match` arm calling a `!` function; the 19 existing snapshots must not change (AC5).
- Fork, analysis: `remove_rec` as written and `if … { break; }` in a `loop` followed by more code return their boundaries and no steps without a panic (AC6, D2).
- Fork, full: `cargo fmt --check`, `cargo clippy -p aquascope -p aquascope_front -- -D warnings`, `cargo test -p aquascope -p aquascope_front` (AC7).
- Extension, end to end on the development bundle: `next` of `n5_bst.rs` and `Config::parse` of `n3_early_return.rs` have steps, `remove_rec` has boundaries and no steps (AC1, AC2); in the second task, the `let … else` fixture has steps (AC8). The counts of every other function in those files are compared with the previous bundle (AC5).
