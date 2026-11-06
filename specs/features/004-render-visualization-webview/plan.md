---
feature: 004-render-visualization-webview
---

# Plan

## Approach

The feature has three parts: the vendored embed files, a page that runs them in a webview, and a panel manager that the command calls. The work starts with the files, because nothing can be tried without them. A script downloads the `mdbook-aquascope` 0.4.0 archive from crates.io and checks it against the checksum in the crates.io index. It then copies `js/embed.iife.js` and `js/style.css` into `media/aquascope-embed/` (D1). It reads the Aquascope commit the crate was built from in the archive's `.cargo_vcs_info.json` and stops if that is not the pinned commit. Aquascope's licence is copied from the pinned checkout, since the crate does not include it. The files live under `media/`, which `.vscodeignore` packages, and the origin note sits beside them (R8).

Between 003's result and the embed sits one pure function, `embedInput`. It cuts the analysed text down to the whole lines of the selected body's range. It shifts every line number in the result so that the first shown line is line 0, and wraps the result in the one-element list the embed expects (D2, R3). It also produces the panel's title. Columns are left alone, because whole lines are kept and 003's columns are already UTF-16, the unit the embed's position arithmetic uses. If the result holds a position outside the shown lines, the function drops that entry and says so, rather than handing the embed a line it would throw on. This is a guard for cases the fixtures may not cover, such as closures.

The page is built by another pure function, `panelPage`, from the embed input, the webview's resource URIs and its `cspSource`. It holds one `<div class="aquascope-embed">` with `data-code`, `data-operations`, `data-responses`, the D3 configuration and `data-no-interact="true"`. All JSON is HTML-escaped into attributes, so the page needs no inline script. It loads the embed script, the embed's stylesheet, a small theme stylesheet (`media/panel.css`) and a small page script (`media/panel.js`). Each comes from the extension's folder under a content security policy whose only sources are the webview's own (`cspSource`). Inline styles are allowed, as R6 permits (Appendix C).

The page script does three jobs:

- **Theme.** Before the embed draws, it puts the embed's light or dark theme class on the page from VS Code's theme, and switches it when the theme changes.
- **Report.** After the embed has drawn, it posts a report to the extension: the code it was given, the number of step widgets and boundary markers in the page, and any content-security-policy violations, caught with the `securitypolicyviolation` event (R10).
- **Message mode.** The same page can show a message instead of a diagram, and then reports that message.

Q1 is settled by the first test that renders a captured fixture in a real webview: no reported violation means the policy stands. A violation shows exactly what to allow, and the decision is recorded in the spec.

The theme stylesheet defines mdBook's variables, which the embed's colours read, from VS Code's theme variables. It also sets the editor's font. The embed's own light and dark variants then do the rest (R7).

The panel manager, `panel.ts`, is a class constructed with the extension's folder; the extension holds one instance, and the panel tests create their own. It owns the single panel (R4):

- **Creating.** It creates the panel beside the active editor without taking focus.
- **Updating.** It replaces the page and reveals the panel where it is, again without taking focus.
- **Closing.** It forgets the panel when it is closed.
- **Reports.** It keeps the latest report from the page.

The command's `report` function changes in one place:

- **Success:** it calls `showAnalysis` instead of 003's summary notification (R1).
- **Most errors:** it keeps the error notification and also calls `showMessage`, which updates the panel only if one is open.
- **`noRustEditor` and `cancelled`:** it leaves the panel alone (R5).

The extension's `activate` returns a small API whose only member waits for the next panel report. The integration tests reach it through `vscode.extensions.getExtension(...).exports`. They cannot import the panel module directly, because the extension runs from the esbuild bundle and the tests from `tsc` output, two separate module instances.

The panel tests create their own panel manager and render captured results from `src/test/fixtures/data/`. Most of the feature is therefore tested without the toolchain, and only the acceptance tests that run the command need the dev bundle. The module responsibilities are in Appendix A and the mapping from criteria to tests in Appendix B.

## VS Code APIs and contribution points

- `vscode.window.createWebviewPanel(viewType, title, { viewColumn: ViewColumn.Beside, preserveFocus: true }, { enableScripts: true, localResourceRoots: [<extension>/media] })` with view type `aquascope.visualization`.
- `WebviewPanel.reveal(undefined, true)`, `.title`, `.onDidDispose`, `.webview.html`, `.webview.asWebviewUri`, `.webview.cspSource`, `.webview.onDidReceiveMessage`.
- `ExtensionContext.extensionUri`; the value returned by `activate` as the extension's exports.
- No new contribution points: no settings (D4), no commands, and webview panels need no declaration.

## Files touched

- `scripts/vendor-aquascope-embed.sh`: downloads, verifies and copies the embed files.
- `media/aquascope-embed/`: `embed.iife.js`, `style.css`, `LICENSE` and a `README.md` origin note.
- `media/panel.js` and `media/panel.css`: the page script and the theme stylesheet.
- `src/visualization/embedInput.ts`, `page.ts`, `panel.ts`.
- `src/analysis/command.ts`: `report` shows the panel instead of the summary and passes errors on.
- `src/extension.ts`: returns the test API from `activate`.
- `src/test/suite/`:
  - `embedInput.test.ts`, `page.test.ts` and `panel.test.ts`;
  - `visualization.test.ts`, the acceptance tests run through the command.
- `README.md`: the panel in the usage section (R11).
- `specs/features/004-render-visualization-webview/spec.md`: Q1 recorded as a decision.

## Risks

- **The embed under the content security policy (Q1).** CodeMirror, React and Font Awesome may need more than inline styles. The violation report shows exactly what. Anything that loads from the extension's own folder can be allowed; anything that needs the network is a blocker and goes back to the spec.
- **Class names.** The class names counted for the report come from the embed's source (`permission-stack` for boundary markers; the step widget's class is still to be confirmed). The vendored build may differ, so T-025 confirms them against the built file before the tests rely on them.
- **The download.** It reaches crates.io once, at development time, and needs your approval when it runs. If the archive's commit differs from the pinned one, the task stops for a decision instead of vendoring files from another version.
- **Third-party licences.** `embed.iife.js` bundles third-party libraries:
  - React, CodeMirror, lodash and floating-ui, under MIT;
  - Font Awesome's icons, under CC BY 4.0.

  R8 asks only for Aquascope's notice. The origin note lists these libraries, and a full third-party notice is left to packaging (feature 005).
- **Positions outside the shown lines.** A body whose result points outside its own lines would make the embed throw and leave the panel blank. `embedInput` drops such entries and the drop is logged. If a real fixture triggers it, R3 needs revisiting.
- **The hand checks.** The theme mapping (AC9) and the comparison with the Book (AC4) are judged by eye, which no test replaces.

## Test strategy

- **Unit tests** for `embedInput` and `panelPage` on captured data:
  - shown lines and the line shift, for a method, `main`, a closure and a multi-line body;
  - a non-ASCII line;
  - the title;
  - the policy and attributes, and HTML escaping.
- **Panel tests in a real webview, from captured results:** one panel, updates, the message mode, and the report's counts and violations. These settle Q1 and need no toolchain.
- **Acceptance tests through the command against the dev bundle:** AC1, AC2, AC3 and AC5 (AC11), and a run with no Rust editor leaving the panel as it was (part of AC7).
- **By hand,** recorded in T-028's note: AC4, AC6 to AC9. AC10 is a `vsce ls` check, also run in T-023.

## Appendix A: module responsibilities

| Module | Requirements | Decides | Tested by |
| --- | --- | --- | --- |
| `scripts/vendor-aquascope-embed.sh` | R8 | Archive checksum against the crates.io index, `.cargo_vcs_info.json` commit equal to the pin, files copied, origin note written | Run once; `vsce ls` |
| `embedInput.ts` | R3, R4 (title), D2 | Shown lines (whole lines of `body_range`), line shift of every position, one-element response, out-of-range guard, title | Unit, captured data |
| `page.ts` | R2, R6, R9, D3 | HTML with the embed element, escaped attributes, resource URIs, the policy; message mode | Unit |
| `media/panel.js` | R7, R10 | Theme class from VS Code's theme; report of code, step widgets, boundary markers and policy violations; message report | Panel tests |
| `media/panel.css` | R7 | mdBook variables from VS Code variables; editor font | By hand (AC9) |
| `panel.ts` | R1, R4, R5 | Single panel, beside the editor, reveal without focus, dispose, latest report and waiters | Panel and acceptance tests |
| `command.ts` (`report`) | R1, R5 | Success shows the panel; errors notify and update an open panel; `noRustEditor` and `cancelled` do not | Acceptance tests |

## Appendix B: acceptance criteria to tests

| Criterion | Test |
| --- | --- |
| AC1 | `visualization.test.ts`: fixture 05, cursor in `main`. One panel of view type `aquascope.visualization` in the tab groups, titled "Aquascope: lines 17–21". The report shows `main`'s five lines, `steps.length` step widgets and the distinct boundary locations as markers. `activeTextEditor` is still the Rust file, and the returned result is 003's |
| AC2 | Same file, cursor in `grow`: still one panel, title "Aquascope: lines 8–11", report with `grow`'s lines; the panel closed, then a new run opens a new one |
| AC3 | Cursor on the `struct` line: the report is a message, the no-function text |
| AC4 | By hand: fixture 04, the marker before `v` in `v.push(4);` shows W missing, as the Book draws it |
| AC5 | An inserted line inside `main`, unsaved: the reported code contains it |
| AC6 | By hand: `n1_non_ascii`, the marker for the moved `s` sits before `s` in `let t = s;` |
| AC7 | `visualization.test.ts`: with the panel open, the command run with no text editor active returns `noRustEditor` and the next report is unchanged; by hand, a run cancelled from the notification and a run with the panel focused |
| AC8 | `page.test.ts` checks the policy; the panel tests check that no violation is reported; by hand, a run with the network off |
| AC9 | By hand: Dark Modern and Light Modern |
| AC10 | `media/aquascope-embed/` holds `LICENSE` and `README.md`; `npx @vscode/vsce ls` lists the embed files |
| AC11 | AC1, AC2, AC3 and AC5 in `npm test` |

## Appendix C: page outline

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; script-src ${cspSource}; style-src ${cspSource} 'unsafe-inline'; img-src data:">
<link rel="stylesheet" href="${media}/aquascope-embed/style.css">
<link rel="stylesheet" href="${media}/panel.css">
<div class="aquascope-embed"
     data-code="${escaped JSON of the shown lines}"
     data-operations='["permissions"]'
     data-responses="${escaped JSON of {permissions: [ {Ok: shifted result} ]}}"
     data-config='{"stepper":true,"boundaries":true}'
     data-no-interact="true"></div>
<script src="${media}/panel.js"></script>
<script src="${media}/aquascope-embed/embed.iife.js"></script>
```

T-025 settled this policy (spec D7): inline styles are required, `data:` images cover an SVG filter in the embed's stylesheet, and the embed needs no fonts.
