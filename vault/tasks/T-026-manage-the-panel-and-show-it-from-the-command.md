---
id: T-026
title: "Manage the panel and show it from the command"
status: review
priority: medium
feature: "004-render-visualization-webview"
created: 2026-11-06
---

# T-026 Manage the panel and show it from the command

Spec: [[specs/features/004-render-visualization-webview/spec.md]]

## Done when

- [x] panel tests show one panel opening beside the editor without taking focus, updates in place, the message mode and a new panel after closing; the command shows the panel instead of the summary, errors update an open panel, `noRustEditor` and cancelled runs leave it alone; the README describes the panel; R1, R4, R5, R11

## Notes

- `src/visualization/panel.ts`: `VisualizationPanel` holds at most one panel (view type `aquascope.visualization`). `showAnalysis` opens it beside the active editor with `preserveFocus`, or reveals it where it is without focus, and sets the title from `embedInput`; `showMessage` updates an open panel only; `latestReport()` resolves with the page's report for the latest render, waiting if needed; closing the tab disposes it. Dropped result entries and any page problems are logged to the Aquascope channel.
- `src/analysis/command.ts`: `report` shows a successful result in the panel instead of 003's summary notification (the JSON still goes to the channel); every error except `noRustEditor` and `cancelled` keeps its notification and also replaces the diagram in an open panel; `noRustEditor` only notifies, and `cancelled` does neither.
- `src/extension.ts`: creates the panel manager and returns `{ latestPanelReport, isPanelOpen }` from `activate`, which the tests reach through `getExtension(...).exports`. The bundle grew from 22 KB to 28 KB and still contains none of the embed.
- Change to T-025's `media/panel.js`: polling for stable counts with 30 ms timers took about 5 s whenever the test window was in the background, because Chromium throttles background timers to about one a second (measured: the page loaded in 30 ms, the report came at 5.2 s). The page now computes the expected counts from its own data (steps, distinct boundary locations), reports from a `MutationObserver` as soon as the page matches, and keeps a 3 s timer only as a fallback that reports the actual counts. Webview tests went from 0.2–6 s to 45–150 ms, steady over three full runs. Users were not affected: the diagram itself draws on load.
- README usage now describes the panel (R11).
- Tests: `panel.test.ts` (4, own panel instance, no toolchain: one panel beside the editor and focus kept, update in place, message, closed panel not reopened by a message and reopened by an analysis); `visualization.test.ts` (3, through the command with the dev bundle: success draws, a failure replaces the diagram, `noRustEditor` with the panel open leaves the report unchanged). 88 passing.
- Layout, after you tried the panel (2026-11-06): below 800 px the embed's stylesheet moved each step table under its line, so the arrow landed at the start of the next line and the table covered it; your playground screenshot shows the table after the line with the arrow at its end. `media/panel.css` now restores the embed's wide values (`.perm-step-widget` inline-block, `top: 0.75em`, no left margin; spacer without `max-width`) at every width, and the panel scrolls sideways. Measured at 300 px on fixtures 02 and 03: every widget inline-block, each arrow starting exactly at its line's text end, each table after the arrow at the line's height, no problems. Spec D6 reversed, AC12 added as a hand check (plan and T-028 updated).

