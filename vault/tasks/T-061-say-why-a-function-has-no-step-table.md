---
id: T-061
title: "Say why a function has no step table"
status: review
priority: medium
feature: "011-missing-table-note"
created: 2026-11-13
---

# T-061 Say why a function has no step table

Spec: [[specs/features/011-missing-table-note/spec.md]]

## Done when

- [x] `embedInput` carries `notes`, decided from the result's counts before anything is dropped, and `page.ts` writes them above the embed
- [x] A result with boundaries and no steps gets the R1 note, one with neither gets the R2 note, one with steps gets none (unit and page tests, AC5 and AC6)
- [x] End to end on `n5_bst.rs`: `remove_rec` and `next` have the R1 note, `insert` and `contains` none, `new` the R2 note (AC1 to AC3)
- [ ] The note is readable in Dark Modern and Light Modern (AC4, by hand)
- [x] `npm run typecheck && npm run lint && npm test` pass

## Notes
- `npm test`: 231 passing, 0 failing; typecheck and lint pass. The readability check of AC4 (Dark Modern and Light Modern) is left for a person to do in the panel; the note reuses `.aquascope-note`, whose colour is `--vscode-descriptionForeground`.
