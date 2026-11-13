---
id: 010-stepper-early-exits
title: Show step tables for functions that leave early
status: approved # draft | approved | implemented
---

# Show step tables for functions that leave early

## Why

The permissions view draws two things: boundaries, the markers at each use of a variable, and step tables, the tables after a line that show how permissions change. For a function that leaves early, with `return`, `?` or `let … else`, and then reaches another `if` or `match`, the view draws the boundaries and no tables. The function is not reported as failed, so a learner sees a view that looks complete but lacks the part that explains the changes; feature 011 now says so in a note, but the tables are still missing. In the binary search tree of `n5_bst.rs`, `remove_rec` and `next` are such functions, and so is `Config::parse` of `n3_early_return.rs`, the function of issue #31. Code like this is common, because every function that checks its input first and then goes on is one.

The cause is in Aquascope's stepper, the part that splits a function into steps. Every branch it opens is closed at a join point, which it takes from the control-flow graph as the least post-dominator of the branch's `switchInt`. When one arm returns, the arms only meet again at the function's return, so the join point lands past the function's last statement, and the code after the branch has no open collection to be stepped into: the stepper stops with "no open collection dominates root location". Upstream v0.4.0 gives up on the whole function; the fork the extension builds from (ADR 0004) keeps the boundaries and drops the steps.

The proposal is to change the stepper in the fork so that the join point of a branch with a diverging arm comes from the arms that continue: the first location after the branching expression that every continuing arm reaches. An arm diverges when its type is `!`, as for `return`, `?`'s residual arm, `break` or a call that never returns. The arm that leaves gets its own tables for its lines, which show the permissions along that path, and the lines after the branch get tables for the paths that continue. Where no arm diverges, nothing changes. Each line still has one table, so the panel and the embed frontend need no change.

A spike on 2026-11-13 tried this on a scratch branch of the fork and it works for the common shapes. `Config::parse` gets 10 steps and the tree's `next` gets 20, where both had none, and an `if` with an early `return`, a `?` chain and a `match` with a returning arm all get tables whose letters match the code by hand. Every function that stepped before steps the same, and the rest of Aquascope's suite passes. The change is about 170 lines in three files of the stepper. Three shapes still fail, as they did before, and keep their boundaries-only result: a `let … else` followed by another branch, which the stepper does not treat as a branch at all; an `if` chain where every arm returns, with a `match` on a tuple inside, which is the tree's `remove_rec`; and an `if … { break; }` inside a `loop` followed by more code. The spike also found an upstream bug in how the stepper's graph treats a `match` arm's false edge, which it works around locally, and a separate crash on a plain `loop` with a `break` that aborts the whole analysis today (Q4). The details are in Appendix B.

So the work is smaller and better understood than the draft assumed. The decisions below settle the scope: the spike's shapes plus `let … else`, with the two remaining shapes left for later.

## Decisions

Recorded 2026-11-13 when the draft was approved. Each one takes the recommendation given for the open question it settles.

- D1 (was Q1): The per-line display is kept. A value that only the returning arm stops using shows as lost on the `if` line, where the `then` arm's first table sits as it does today, and again at its own last use on the path that continues.
- D2 (was Q2): The first version covers `if`, `match` and `?` with at least one arm that continues, as the spike does, plus `let … else`, for which the stepper opens a branch whose `else` arm diverges and reuses the same join point. An `if` chain where every arm returns with a tuple `match` inside (the tree's `remove_rec`) and `if … { break; }` in a `loop` followed by more code are left for later, with tests that pin their boundaries-only result.
- D3 (was Q3): The false-edge bug in `CleanedBody::successors` is worked around in the join-point code, as in the spike. The fix at its source is offered upstream separately, with its own before and after comparison.
- D4 (was Q4): The crash on a plain `loop { if … { break; } … }` is a separate bug, filed as an issue and fixed outside this feature, by catching a panic in the steps as the fork already catches an error.
- D5 (was Q5): The work does not wait for upstream. Whether upstream has a plan for early exits is checked when the change is offered there (R6).

## User stories

- As a Rust learner, I want the step tables for a function that checks its input and returns early, so that I can follow how permissions change in the code after the check as I can in a function without early exits.
- As a Rust learner, I want to see what the permissions are inside the arm that returns, so that I can follow what happens to a value I give up on the way out.
- As a working Rust developer, I want a function with `?` to be shown like any other, so that I do not have to rewrite it to see its tables.

## Requirements

- R1: A function with an `if` or `match` that has an arm of type `!` (it leaves with `return`, `?`, `break` or a call that never returns) and at least one arm that continues gets step tables, as it gets boundaries today. So does a function with a `let … else`, whose `else` block always diverges (D2).
- R2: The lines of an arm that leaves get tables that show the permissions along that arm.
- R3: The lines after the branch get tables that show the permissions along the paths that reach them, which excludes the arms that left.
- R4: Functions the stepper handles today give the same output as before.
- R5: A function whose steps still cannot be computed keeps today's behaviour: its boundaries without steps, and a log line with the stepper's error. The change must not turn a function that works, or one that fails with an error, into one that panics.
- R6: The change lives in the fork (ADR 0004), with tests in Aquascope's own suite, and is offered upstream.
- R7: The extension changes only its pin on the fork's tag, its bindings if the output types change, an ADR 0004 entry, and tests on fixtures.

## Acceptance criteria

- [x] AC1: `next` of `n5_bst.rs` returns step tables, where before it returned none. `remove_rec` keeps its boundaries and no steps (D2).
- [x] AC2: `Config::parse` of `n3_early_return.rs`, which leaves early from two `match`es with `None => return`, returns step tables.
- [x] AC3: For a function with an early `return` inside an `if`, the lines of that arm have tables, and the permissions in them are those on that path (checked on a case written by hand, with the expected letters).
- [x] AC4: For the same function, the line after the `if` has the table of the fall-through path: a variable moved only in the returning arm keeps its permissions there until its own last use.
- [x] AC5: The outputs of the bodies the stepper handles today, in the existing fixtures and in Aquascope's suite, are unchanged.
- [x] AC6: A `match` where some arms return and some continue, and a chain of `?`, get tables that match hand-checked expectations. The two shapes D2 leaves for later keep today's boundaries-only result without a panic, with a test in Aquascope's suite that says so.
- [ ] AC8: A `let … else` whose `else` returns, followed by an `if` and `else`, gets tables: the `else` block's lines show the permissions on that path, and the lines after the `let` show the bound value and the other variables as the path that continues has them.
- [x] AC7: `cargo fmt --check`, `cargo clippy -p aquascope -p aquascope_front -- -D warnings` and `cargo test -p aquascope -p aquascope_front` pass on the fork, and `npm run typecheck && npm run lint && npm test` pass in the extension.

## Out of scope

- Choosing an exit and seeing the permissions along the path to it. This needs one set of tables per path, which grows quickly with branches and loops, and a change to the embed frontend, which is vendored from the published `mdbook-aquascope` and not modified. It would be its own feature with its own spec.
- The panel note that says why a table is missing. That is feature 011, and it stays useful for the functions this feature does not cover.
- Changes to how loops are stepped when they do not leave early.
- The interpreter's stack and heap view (features 007 and 009), which does not use the stepper.

## Open questions

None.

## Appendix A: evidence before the spike

- Measured 2026-11-13 on `n5_bst.rs` with the bundle built from fork tag `v0.4.0-vscode.6`: `remove_rec` 0 steps and 20 boundaries, `next` 0 and 28, `insert` 6 and 10, `contains` 7 and 8, `iter` 6 and 5, `height` 2 and 1, `new` 0 and 0. On `n3_early_return.rs`, `Config::parse` has 0 steps and 10 boundaries; its stepper error, read with `RUST_LOG=aquascope=warn`, is "no open collection dominates root location bb11[1]".
- Where it fails: `segmented_mir.rs`, in `mk_branch`, `bail!("no open collection dominates root location {location:?}")`. The module's documentation gives the three validity rules: linear, split and join segments; a total cover of the body; no location in two steps.
- Size of the modules involved, at `v0.4.0-vscode.6`: `segmented_mir.rs` 1,080 lines, `hir_steps.rs` 1,250 lines, `table_builder.rs` 374 lines.
- History: ADR 0004's first fork change (`27ad0b3`, upstream pull request #199) made a failing stepper return boundaries without steps for issue #31.

## Appendix B: spike, 2026-11-13

Branch `spike-early-exit-stepper` in the local fork checkout, commit `65e8999` on top of `v0.4.0-vscode.6`, not pushed. The change, 167 added lines in three files:

- `hir_steps.rs`: for an `if` or `match`, find the arms whose type is `!` (`typeck_body(..).expr_ty_opt(arm).is_never()`) and pass them, with the expression's own MIR locations, to `open_branch`. The `while` and `for` desugarings opt out, since their `break` arm is the loop's own exit and they step correctly today.
- `segmented_mir.rs`: when some arms diverge and at least one continues, `mk_branch` takes the join point from `continuation_after`: among the blocks dominated by the `switchInt`, outside the expression's own locations and post-dominating every continuing arm, the first one, and in it the first location after the expression's own (a block can start with the tail of the `if` and go on with the next statement). A continuing arm that starts with a `FalseEdge` is tested from its real target (Q3). Otherwise the least post-dominator is used as before.
- `mir_locations.rs`: a getter for the locations of a HIR node.

Step tests, each run on the unchanged stepper and on the spike:

| Case | Unchanged | Spike |
| --- | --- | --- |
| 1. `if flag { return 0; }`, then `let t = s;` and an `if`/`else` | error | tables |
| 2. A value moved only in the returning arm (AC3, AC4) | error | tables, letters checked |
| 3. Two `?` in a row, then an `if`/`else` | error | tables |
| 4. `match` with `None => return`, then an `if`/`else` | error | tables |
| 5. `Config::parse`, two `match`es with `None => return` | error | tables |
| 6. The tree's `next`: `return` inside a `while let`, then `if let`s | error ("more than one collection open") | tables |
| 7. The tree's `remove_rec` with the tuple `match` replaced by an assignment | not run | tables |
| 8. The tree's `remove_rec` as written | error | error |
| 9. `let … else`, then an `if`/`else` | error ("opening a branch missed a step") | error |
| 10. `if … { break; }` in a `loop`, then more code and an `if` | error | error |
| 11. A plain `loop { if … { break; } i += 1; }` | panic | panic |

Case 2's tables, with lines counted from 0: line 0 `flag` and `s` +R +O; line 1 (`if flag {`) `flag` −R −O; line 2 (`let t = s;`, returning arm) `s` −R −O, `t` +R +O; line 3 (`return t.len();`) `t` −R −O; line 5 (`let n = s.len();`, fall-through) `n` +R +O, `s` −R −O at its last use. On the path that continues, no table before line 5 shows `s` losing its permissions.

The 19 existing step snapshots are unchanged, and the other test targets pass: 72 unit tests including the stepper's own tests of odd expressions such as `while (return)`, and the boundaries, permissions, analysis and interpreter suites. `cargo fmt --check` and `cargo clippy -D warnings` pass. With the spike's binaries, every function of `n5_bst.rs` and `n3_early_return.rs` other than `next` and `Config::parse` has the same step and boundary counts as on `v0.4.0-vscode.6`.

Two attempts that did not work: excluding whole blocks that hold any of the `if`'s locations put the join point one block too late, because the fall-through block starts with the `if`'s tail; giving a branch whose every arm diverges no join point at all made `remove_rec` panic with "no entry found for key" when an implicit child branch looked up its parent, so it was reverted.

Case 11 also crashes the released extension: `cargo aquascope permissions` on that function with the 0.0.6 bundle exits with code 101 and the panic "index out of bounds: the len is 0 but the index is 0" at `segmented_mir.rs:327` (Q4).
