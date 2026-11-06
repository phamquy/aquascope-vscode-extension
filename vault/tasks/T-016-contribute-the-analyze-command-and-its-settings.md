---
id: T-016
title: "Contribute the analyze command and its settings"
status: done
priority: medium
feature: "003-run-analysis-at-cursor"
created: 2026-11-06
---

# T-016 Contribute the analyze command and its settings

Spec: [[specs/features/003-run-analysis-at-cursor/spec.md]]

## Done when

- [x] the command shows in the palette for Rust files only, both settings appear in the settings UI with descriptions, README documents them, and a test asserts the command and settings are contributed (R1, R14)

## Notes

Done 2026-11-06. `package.json` declares `aquascope.analyzeAtCursor` ("Aquascope: Analyze Function at Cursor"), a `commandPalette` entry with `when: editorLangId == rust`, and the two settings with markdown descriptions. `aquascope.toolchainPath` has `scope: machine`, so only user settings can set it; a cloned repo's workspace settings cannot make the extension run other binaries. `aquascope.analysisTimeoutSeconds` is an integer, minimum 5. README has Usage, Settings and Development sections.

`src/analysis/command.ts` registers the handler. It already returns `noRustEditor` without a Rust editor; otherwise it returns a temporary "not implemented yet" error until T-021 wires the pipeline in. `contributes.test.ts` (5 tests) checks declarations, registration, defaults, README mentions and the no-editor result. The settings UI itself is checked by hand under AC11 in T-022.

