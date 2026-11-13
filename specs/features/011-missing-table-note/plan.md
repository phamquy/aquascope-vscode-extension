---
feature: 011-missing-table-note
---

# Plan

## Approach

The permissions view builds its page from `EmbedInput` (`src/visualization/embedInput.ts`), and the stack and heap view's input already carries a `notes` list that `page.ts` writes as `<p class="aquascope-note">` above the embed. The permissions view gets the same: `embedInput` fills a new `notes: string[]` from the result's counts, and `panelPage` writes them above the embed for the `analysis` kind as it does for `trace`. The styling in `media/panel.css` already covers `.aquascope-note` for both themes, so it needs no change.

The note for the result is chosen from two counts of the selected `AnalysisOutput`, taken before `dropOutside` removes anything, so that what Aquascope returned and not what was drawn decides it. With at least one boundary and no steps, the note is "The step table could not be computed for this function. The markers at each use are still shown." With neither, it is "There is nothing to show for this function." With steps, there is no note (R3, D1, D2). The text names no cause (D1).

Alternatives considered: putting the note in the panel title, which is too short to carry it and hides in a tab; and writing it into the embed's code area, which would change what the embed draws. A note above the code is the same place the other view uses, so a learner sees the same convention in both.

A shared helper for writing notes would avoid repeating the `<p>` markup for the two kinds. It is small enough that the plan keeps the one line in `page.ts` and builds the markup for both kinds from the same expression.

## VS Code APIs and contribution points

- None. The change is inside the page the panel already builds. No command, setting or contribution is added (R6).

## Files touched

- `src/visualization/embedInput.ts`: `notes` on `EmbedInput`, filled from the result's counts.
- `src/visualization/page.ts`: write the notes above the embed for the `analysis` kind, escaped as the `trace` kind's are.
- `src/test/suite/embedInput.test.ts`: the three cases of AC6.
- `src/test/suite/page.test.ts`: the note is in the page, and escaped (AC5).
- `src/test/suite/analyze.test.ts` or `panel.test.ts`: the end-to-end check on `n5_bst.rs` for AC1 to AC3, whichever already opens the panel for a fixture.
- `specs/features/011-missing-table-note/tasks.md`, the task note, and `specs/product.md`'s index, which becomes `implemented`.

## Risks

- A result with boundaries and no steps may come from a cause other than an early exit. The note names none, so it stays true (D1, D4).
- A function whose result is empty because Aquascope found nothing to analyse, as opposed to nothing changing, would get the "nothing to show" note. The note's words are about showing, not about the program, for that reason.
- The embed throws on a position outside the shown lines, which `dropOutside` guards; the notes must be decided before it runs, or a result whose only steps were dropped would be mistaken for one that had none. The test for the counts covers this.
- The page test in `page.test.ts` compares the page's HTML; a new `<p>` could break an existing exact comparison. The plan keeps the markup identical to the trace view's, and updates the comparison only if one exists.

## Test strategy

- Unit: `embedInput` on a result with boundaries and no steps, one with neither, one with steps, and one whose steps all lie outside the shown lines (AC6, and the risk above).
- Page: `panelPage` writes the note for `analysis`, writes none when `notes` is empty, and escapes `<`, `&` and `>` (AC5).
- End to end, on the development bundle: the panel's page for `remove_rec` and `next` holds the R1 note, `insert` and `contains` hold none, and `new` holds the R2 note (AC1 to AC3).
- By hand: the note is readable in Dark Modern and Light Modern (AC4).
