---
id: 010-stepper-early-exits
title: Show step tables for functions that leave early
status: draft # draft | approved | implemented
---

# Show step tables for functions that leave early

## Why

The permissions view draws two things: boundaries, the markers at each use of a variable, and step tables, the tables after a line that show how permissions change. For a function that leaves early, with `return`, `?` or `let … else`, and then reaches another `if` or `match`, the view draws the boundaries and no tables. The function is not reported as failed, so a learner sees a view that looks complete but lacks the part that explains the changes. In the binary search tree of `n5_bst.rs`, `remove_rec` and `next` are such functions: they have 20 and 28 boundaries and no steps, while `insert` and `contains` have their tables. Code like this is common, because every function that checks its input first and then goes on is one.

The cause is in Aquascope's stepper, the part that splits a function into steps. It builds its steps as a tree of segments with one way in and one way out, and every branch it opens must be closed again at the point where all its paths meet. A branch whose arm returns never meets the others, and the code after the `if` is then reached by only one of the arms, so the stepper stops with "no open collection dominates root location". Upstream v0.4.0 gives up on the whole function. The fork the extension builds from (ADR 0004) keeps the boundaries and drops the steps, which is why there is a view at all, and the panel does not say that the tables are missing (feature 011 would add a note).

The proposal is to change the stepper in the fork so that a branch may have arms that leave the function. The arm that returns gets its own tables for its lines, which show the permissions along that path. The lines after the `if` get tables for the path that falls through. Where paths do rejoin, as after an `if` and `else` that both continue, nothing changes. Each line still has one table, so the panel and the embed frontend need no change.

This is a draft and is not scheduled. The evidence for the cause and the size of the work is in Appendix A. Choosing an exit and seeing the permissions along its path is a different feature, listed under Out of scope.

## User stories

- As a Rust learner, I want the step tables for a function that checks its input and returns early, so that I can follow how permissions change in the code after the check as I can in a function without early exits.
- As a Rust learner, I want to see what the permissions are inside the arm that returns, so that I can follow what happens to a value I give up on the way out.
- As a working Rust developer, I want a function with `?` to be shown like any other, so that I do not have to rewrite it to see its tables.

## Requirements

- R1: A function that leaves early with `return`, `?`, `let … else`, `break` out of a loop or a call that never returns, and then branches again, gets step tables, as it gets boundaries today.
- R2: The lines of a branch that leaves the function get tables that show the permissions along that branch.
- R3: The lines after the branch get tables that show the permissions along the paths that reach them, which excludes the arms that left.
- R4: Functions the stepper handles today give the same output as before, except for the cases R1 names.
- R5: A function whose steps still cannot be computed keeps today's behaviour: its boundaries without steps, and a log line with the stepper's error. The change must not turn a function that works into one that panics.
- R6: The change lives in the fork (ADR 0004), with tests in Aquascope's own suite, and is offered upstream.
- R7: The extension changes only its pin on the fork's tag, its bindings if the output types change, an ADR 0004 entry, and tests on fixtures.

## Acceptance criteria

- [ ] AC1: `remove_rec` and `next` of `n5_bst.rs` return step tables, where before they returned none.
- [ ] AC2: `Config::parse` of `n3_early_return.rs`, which has early `return`, `?` and `let … else`, returns step tables.
- [ ] AC3: For a function with an early `return` inside an `if`, the lines of that arm have tables, and the permissions in them are those on that path (checked on a case written by hand, with the expected letters).
- [ ] AC4: For the same function, the line after the `if` has the table of the fall-through path: a variable moved only in the returning arm is still readable and writable there.
- [ ] AC5: The outputs of the bodies the stepper handles today, in the existing fixtures and in Aquascope's suite, are unchanged.
- [ ] AC6: A function with a loop that contains `break`, `continue` or `return`, one with a `match` where some arms return and some continue, and one with a chain of `?` are each either given tables that match hand-checked expectations or keep today's boundaries-only result without a panic.
- [ ] AC7: `cargo fmt --check`, `cargo clippy -p aquascope -p aquascope_front -- -D warnings` and `cargo test -p aquascope -p aquascope_front` pass on the fork, and `npm run typecheck && npm run lint && npm test` pass in the extension.

## Out of scope

- Choosing an exit and seeing the permissions along the path to it. This needs one set of tables per path, which grows quickly with branches and loops, and a change to the embed frontend, which is vendored from the published `mdbook-aquascope` and not modified. It would be its own feature with its own spec.
- The panel note that says why a table is missing. That is feature 011, and it is still useful after this feature for the functions R5 keeps unchanged.
- Changes to how loops are stepped when they do not leave early.
- The interpreter's stack and heap view (features 007 and 009), which does not use the stepper.

## Open questions

- Q1: What should the table show at the first line after a branch where one arm left? The proposal is the permissions of the continuing paths only. Is that what a learner expects, or should the view mark that some paths left?
- Q2: How are `?` and `let … else` stepped? They compile to a branch whose one arm is a return, but with extra blocks the stepper may not map back to source lines. Do they need separate handling from an explicit `return`?
- Q3: What happens to a loop with an early exit in its body? The loop's own join and the exit's path both change.
- Q4: What happens when every arm of a `match` leaves, so that nothing falls through? The code after it is unreachable and has no table.
- Q5: Which cases get a spike first? The proposal is the plain `if x { return }` case, to measure whether the segment model can take a diverging arm without changing its three validity rules, before deciding on the rest.
- Q6: How do we know a table is right? The stepper's own validity checks guard the structure, not the permissions in it. The proposal is hand-checked expectations for each case in AC3, AC4 and AC6, in the style of Aquascope's refinement tests.
- Q7: Is the effort worth it before upstream's own plans are known? Issue #31's fix was offered as cognitive-engineering-lab/aquascope#199. Is there an upstream issue or plan for early exits to build on?

## Appendix A: evidence

- Measured 2026-11-13 on `n5_bst.rs` with the bundle built from fork tag `v0.4.0-vscode.6`: `remove_rec` 0 steps and 20 boundaries, `next` 0 and 28, `insert` 6 and 10, `contains` 7 and 8, `iter` 6 and 5, `height` 2 and 1, `new` 0 and 0 (nothing changes there). `remove_rec` returns from each `if` and goes on; `next` returns inside its `while`. That the stepper's error is the dominance one for these two was not read from the log, which the fork writes only at debug level; the match with issue #31's pattern is an inference.
- Where it fails: `segmented_mir.rs`, in `mk_branch`, `bail!("no open collection dominates root location {location:?}")`. The module's documentation gives the three validity rules: linear, split and join segments; a total cover of the body; no location in two steps.
- Size of the modules the change would touch, in the fork at `v0.4.0-vscode.6`: `segmented_mir.rs` 1,080 lines (the segment tree and its validity checks), `hir_steps.rs` 1,250 lines (opens and closes branches for `if`, `match` and loops), `table_builder.rs` 374 lines (builds the tables, including the merge after a branch). A first estimate is 300 to 800 changed lines plus tests; a version limited to a plain diverging arm might be 100 to 200. Neither was tried.
- History: ADR 0004's first fork change (`27ad0b3`, upstream pull request #199) made a failing stepper return boundaries without steps for issue #31. The `n3_early_return` fixture holds that case.
