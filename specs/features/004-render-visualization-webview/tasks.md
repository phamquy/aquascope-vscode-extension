---
feature: 004-render-visualization-webview
---

# Tasks

Each line maps to a note in `vault/tasks/`. Status lives in the note, not here.

- [x] T-023 Vendor the embed from the mdbook-aquascope 0.4.0 crate (done when: `media/aquascope-embed/` holds `embed.iife.js`, `style.css`, Aquascope's `LICENSE` and an origin note naming the crate version and the commit read from `.cargo_vcs_info.json`, the script recreates them, and `vsce ls` lists them; R8, AC10; needs your approval for the download)
- [x] T-024 Shape the embed's input from the analysis result (done when: unit tests on captured data cover the shown lines and line shift for a method, `main`, a closure and a multi-line body, a non-ASCII line, the out-of-range guard and the title; R3, D2)
- [x] T-025 Build the panel page and settle Q1 (done when: unit tests cover the page's policy, attributes and escaping, a test renders captured fixture 05 in a real webview and receives a report with its code, step widgets, boundary markers and no policy violations, the counted class names are confirmed against the vendored build, and Q1 is a decision in the spec; R2, R6, R9, R10)
- [x] T-026 Manage the panel and show it from the command (done when: panel tests show one panel opening beside the editor without taking focus, updates in place, the message mode and a new panel after closing; the command shows the panel instead of the summary, errors update an open panel, `noRustEditor` and cancelled runs leave it alone; the README describes the panel; R1, R4, R5, R11)
- [x] T-027 Map VS Code's themes onto the embed's styles (done when: the page switches the embed between its light and dark styles with VS Code's theme, `panel.css` supplies mdBook's variables and the editor font, and AC9 is checked by hand; R7)
- [x] T-028 Integration tests for the acceptance criteria (done when: AC1, AC2, AC3, AC5 and the automated part of AC7 pass in `npm test`, AC4, AC6 to AC10 and AC12 are recorded, and the spec's criteria are ticked)

T-023 comes first, because every later task loads the embed. T-024 is independent of it and can run in either order. T-025 needs both, T-026 builds on T-025, T-027 needs only T-025's page, and T-028 comes last.
