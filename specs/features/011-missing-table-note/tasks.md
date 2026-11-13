---
feature: 011-missing-table-note
---

# Tasks

Each line maps to a note in `vault/tasks/`. Status lives in the note, not here.

- [x] T-061 Say why a function has no step table (done when: the permissions panel shows the R1 note for a result with boundaries and no steps and the R2 note for one with neither, none when it has steps; unit, page and end-to-end tests cover AC1 to AC3, AC5 and AC6, AC4 is checked by hand, and `npm run typecheck && npm run lint && npm test` pass)

The feature is one task: the change is a field, a line in the page and tests, and splitting it would leave a state on `main` where the field exists and nothing shows it.
