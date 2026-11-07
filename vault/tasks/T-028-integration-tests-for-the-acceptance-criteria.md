---
id: T-028
title: "Integration tests for the acceptance criteria"
status: done
priority: medium
feature: "004-render-visualization-webview"
created: 2026-11-06
---

# T-028 Integration tests for the acceptance criteria

Spec: [[specs/features/004-render-visualization-webview/spec.md]]

## Done when

- [x] AC1, AC2, AC3, AC5 and the automated part of AC7 pass in `npm test`, AC4, AC6 to AC10 and AC12 are recorded, and the spec's criteria are ticked

## Notes

- `src/test/suite/visualization.test.ts` now holds one test per automated criterion, through the real command against the dev bundle and read through the extension's panel API: AC1 (main's five lines, step widgets equal to `steps.length`, markers equal to the distinct boundary locations, one panel titled "Aquascope: lines 17–21" in another column, focus still in the Rust file, the 003 result returned), AC2 (same panel updated to `grow`, "lines 8–11"; closed, then a run in `area` opens a new one, "lines 12–14"), AC3 (the `struct` line gives a message report with the no-function text), AC5 (an unsaved line inside the function appears in the reported code, "lines 17–22"; the editor is reverted) and the automated part of AC7 (with only the panel open, the command returns `noRustEditor` and the panel's report is unchanged). It replaces T-026's three wiring tests. 91 passing; 003's workspace-unchanged test still passes.
- AC10: `media/aquascope-embed/` holds `README.md` (origin) and `LICENSE` (MIT, Gavin Gray); `npx vsce ls` lists the four embed files and `media/panel.{js,css}`.
- AC9 was checked by the user in T-027.
- Ticked in the spec: AC1, AC2, AC3, AC5, AC9, AC10, AC11.
- Hand checks, run by the user on 2026-11-06 in the Extension Development Host with the dev bundle and reported as all passing: AC4 (fixture 04, W shown missing before `v` in `v.push(4);`), AC6 (fixture n1, the marker for the moved `s` before `s` in `let t = s;`, after the emoji), AC7 (a long run on a generated 4,000-function file cancelled from the notification left the earlier diagram; the panel-focused half rests on the automated test, since the palette offers the command only in Rust editors), AC8 (the diagram draws with the network off) and AC12 (narrow panel: each table after its line, arrow at the line's end, sideways scrolling).
- All acceptance criteria ticked; spec 004 and its row in `specs/product.md` set to `implemented`.

