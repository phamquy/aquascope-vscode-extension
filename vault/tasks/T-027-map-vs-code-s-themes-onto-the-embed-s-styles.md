---
id: T-027
title: "Map VS Code's themes onto the embed's styles"
status: review
priority: medium
feature: "004-render-visualization-webview"
created: 2026-11-06
---

# T-027 Map VS Code's themes onto the embed's styles

Spec: [[specs/features/004-render-visualization-webview/spec.md]]

## Done when

- [ ] the page switches the embed between its light and dark styles with VS Code's theme, `panel.css` supplies mdBook's variables and the editor font, and AC9 is checked by hand; R7

## Notes

- `media/panel.css` defines mdBook's theme variables, which the embed's colours are built on, from VS Code's: `--fg`/`--bg` from the editor, step tables from the editor widget colours (with fallbacks to `widget-border`/`panel-border`), the arrows from `descriptionForeground`, and the frame and buttons from widget and list colours. `--code-bg` is the editor background in both mdBook theme classes, and the code uses `--vscode-editor-font-family` and `--vscode-editor-font-size` instead of the embed's "Source Code Pro" (`.aquascope .cm-editor .cm-content`, one class more specific than the embed's rule).
- `media/panel.js` puts mdBook's `coal` class on the root for dark and high-contrast themes and `light` otherwise, from VS Code's body classes, and follows theme changes through a `MutationObserver` on the body's class. Without it the embed's gain and loss marks stay `#333`/`#666`, which disappear on a dark background. The report now carries `theme`.
- Measured on fixture 05 `grow` (temporary diagnostics, removed): in Light Modern, code 11.2:1, table text 10.5:1, arrows 11.2:1; in Dark Modern, code 10.3:1, table text 10.1:1, arrows 7.1:1. The code font follows the editor (Menlo 12 px in the test instance). The permission letters keep Aquascope's own colours (D5): on light, R 2.1:1, W 4.1:1, O 4.7:1, the same as on the Book's white pages; on dark, 3.2 to 7.5:1. They are bold and outlined, which helps more than the ratio says.
- `page.test.ts`: a test switches VS Code to Default Light Modern and Default Dark Modern and checks the page's theme in each; the message test now includes the theme. 89 passing.
- Pending: AC9 by hand in the Extension Development Host, in both themes, and switching theme with the panel open.

