---
id: 011-missing-table-note
title: Say why a function has no step table
status: approved # draft | approved | implemented
---

# Say why a function has no step table

## Why

For some functions the permissions panel draws the boundaries and no step tables, and nothing tells the learner why. In the binary search tree of `n5_bst.rs`, `insert` and `contains` have their tables, while `remove_rec` and `next` have 20 and 28 boundaries and none. Aquascope's stepper cannot split a function that leaves early, with `return`, `?` or `let … else`, and then branches again, so the fork the extension builds from (ADR 0004) returns such a function with its boundaries and no steps. A learner who has just seen a table for one function sees a panel for the next that looks complete and is not, and may conclude that nothing changes in it or that the extension is broken. Feature 010 would remove the most common cause, but is not scheduled, and some functions would still have no steps after it.

The proposal is a short note above the code, in the style of the notes the stack and heap view already shows (feature 007), when the result has boundaries and no steps. It says that the table is missing and gives the usual cause. Nothing else changes: the panel draws what Aquascope returns, and the analysis, the commands and the settings are untouched. The evidence is in Appendix A.

## User stories

- As a Rust learner, I want to be told when a function's step table cannot be shown, so that I do not take the missing table for a sign that no permission changes.
- As a Rust learner, I want to know what to do about it, so that I can still learn from the boundaries or look at a simpler function.

## Decisions

Recorded 2026-11-13 when the draft was approved. Each one settles an open question.

- D1 (was Q1): The note says only that the step table could not be computed. It does not name the early exit, since the stepper's actual error was not read for the functions measured, and a wrong cause is worse than none. Feature 010's work can add the cause once it is confirmed.
- D2 (was Q3): A result with no boundaries and no steps gets a note saying that there is nothing to show (R2).
- D3 (was Q2): The note is one line above the code, with the weight of the interpreter view's notes, not a banner.
- D4 (was Q4): The note does not tell the causes apart, since the extension cannot.

## Requirements

- R1: When the selected result has at least one boundary and no steps, the panel shows a note above the code saying that the step table could not be computed for this function and that the markers at each use are still shown. It names no cause (D1).
- R2: When the selected result has no boundaries and no steps, the panel shows a note saying that there is nothing to show for this function.
- R3: When the result has steps, the panel shows no note, and the page is as it is today.
- R4: The note is plain text in the page's own markup, styled by `media/panel.css` for the light and dark themes like the interpreter view's notes, and is part of the page the panel's render report covers.
- R5: The note is shown with every render of the result, including a refresh of the same function, and goes away when the next result has steps.
- R6: There is no setting for it. It is explanatory text, not a behaviour a user would turn off, and the decision is revisited if anyone asks.

## Acceptance criteria

- [x] AC1: For `remove_rec` and `next` of `n5_bst.rs`, the panel's page holds the R1 note, and the boundaries are still drawn (checked on the page's HTML and, by hand, in the panel).
- [x] AC2: For `insert` and `contains` of `n5_bst.rs`, the page holds no note.
- [x] AC3: For `new` of `n5_bst.rs`, which has no boundaries and no steps, the page holds the R2 note.
- [ ] AC4: The note is readable in the Dark Modern and Light Modern themes (checked by hand).
- [x] AC5: The note's text is escaped like the interpreter view's, so a result cannot inject markup into it.
- [x] AC6: A unit test builds the embed input for a result with boundaries and no steps, one with neither, and one with steps, and checks which has a note.
- [x] AC7: `npm run typecheck && npm run lint && npm test` pass.

## Out of scope

- Showing the tables for such functions. That is feature 010.
- Showing why the stepper failed, or guessing at it. The fork writes the stepper's error to its log only at debug level, and its text is not written for learners.
- A link or button in the note, such as one that opens documentation.
- The stack and heap view, which has its own notes.

## Open questions

None.

## Appendix A: evidence

- Measured 2026-11-13 on `n5_bst.rs` with the bundle built from fork tag `v0.4.0-vscode.6`: `remove_rec` 0 steps and 20 boundaries, `next` 0 and 28, `insert` 6 and 10, `contains` 7 and 8, `iter` 6 and 5, `height` 2 and 1, `new` 0 and 0. The stepper's error for `remove_rec` and `next` was not read; the fork logs it only at debug level.
- ADR 0004: the fork's first change (`27ad0b3`, upstream pull request #199) returns a function with its boundaries and no steps when its steps cannot be computed (issue #31).
- Where the note would be built: `src/visualization/embedInput.ts` turns the result into the embed's input and `src/visualization/page.ts` writes the page. The page already writes `<p class="aquascope-note">` for the stack and heap view's notes, styled in `media/panel.css`; the permissions view has no notes yet.
