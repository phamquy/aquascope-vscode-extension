---
id: 004-render-visualization-webview
title: Render the visualization in a webview
status: implemented
---
# Render the visualization in a webview

## Why

Feature 003 runs Aquascope on the function at the cursor, but it shows the result only as a one-line summary and a JSON dump in the output channel. A learner opens this extension to see what the Rust Book's experiment edition shows: the permission-step tables beside each line and the boundary markers that say which permission an expression needs and whether the variable has it. This feature draws those diagrams for the analysed function, in a panel beside the editor, using Aquascope's own frontend so that the diagrams are the Book's.

Aquascope ships that frontend as `aquascope-embed`, the script the mdBook plugin loads into each Book page. It needs no server when it is given the analysis up front. A page holds a `<div class="aquascope-embed">` whose data attributes carry the code, the operation (`permissions`) and the precomputed response, and a global `initAquascopeBlocks` draws every such block. The response it expects is the list of per-function results that `cargo aquascope permissions` prints. It places each marker by line and column within the code it was given, counting columns in UTF-16 code units, which is the unit 003's result already uses. The panel shows only the analysed function's lines, so the extension hands the embed the selected result alone, with its line numbers shifted to start at the function's first line. The columns stay as they are, because whole lines are shown. The evidence, with source locations in the pinned v0.4.0 tree, is in Appendix A.

The built embed is not in Aquascope's git repository, but spike 002 found it in the published `mdbook-aquascope` 0.4.0 crate, from which it can be vendored with no frontend build (D1). The embed was written for mdBook pages, though. Its colours come from mdBook's theme variables, which do not exist in a webview, so the panel needs a small stylesheet that supplies them from VS Code's theme. It runs unchanged under a strict content security policy once inline styles are allowed (D7).

The panel opens on its own after every successful run and replaces 003's interim summary notification (003 R13), so running the command is enough to see the diagrams. Errors keep 003's notifications, and an open panel shows the same message instead of an outdated diagram.

## Decisions

D1 to D4 were proposed in the draft and confirmed by its approval on 2026-11-06; D5 and D6 settle two of the draft's open questions.

- D1: The embed's built files (`embed.iife.js` and `style.css`) are vendored from the published `mdbook-aquascope` 0.4.0 crate, which matches the pinned tag; no frontend build is added (spike 002, Q6 and Appendix I).
- D2: The panel shows the selected body's whole lines only. The embed receives a one-element list holding 003's selected result with line numbers shifted so that the first shown line is line 0. The Book's `hidden_lines` mechanism is not used, because it would add a button that reveals the rest of the file.
- D3: The embed's configuration is exactly `{stepper: true, boundaries: true}`, with no `shouldFail` and no annotations. `shouldFail` would add the Book's "does not compile" image, which is not among the embed's files, and without annotations every step table starts expanded rather than focused on chosen variables.
- D4: No new settings. The panel opens automatically and has nothing to configure, so constitution principle 4 is met by documenting it in the README.
- D5 (was Q2): The code in the panel is not syntax-coloured in this version. The embed tags tokens with highlight.js classes but ships no colours for them, and mapping them to each theme is extra work that the diagrams do not need; the diagrams keep their own colours.
- D6 (was Q3, revised on 2026-11-06 after trying the panel): The embed's wide layout is kept at every width: each step table sits after its line, at the same height, with the arrow pointing at the line's end, and a narrow panel scrolls sideways, as Aquascope's own playground does. The embed's stylesheet instead moves each table under its line below 800 pixels, which a panel beside the editor nearly always is. Tried in the panel, that put the arrow at the start of the next line with the table covering it, so the panel's stylesheet overrides that breakpoint.
- D7 (was Q1, settled by T-025 on 2026-11-06): The embed runs unchanged under the policy `default-src 'none'; script-src <webview>; style-src <webview> 'unsafe-inline'; img-src data:`. Rendering four captured results in a real webview reported no policy violation and no script error, with the expected step widgets and boundary markers. Without `'unsafe-inline'`, every render reports blocked inline style elements and style attributes, so it is needed; `data:` images cover an SVG filter in the embed's stylesheet. The embed declares no fonts and the policy allows no requests.

### User stories

- As a Rust learner, I want to see the permission steps and boundaries of the function at my cursor drawn as in the Rust Book, beside my code, so that I can follow how ownership and permissions change line by line.
- As a learner whose code fails borrow checking, I want the diagram to show which permission is missing where, so that I can see why the compiler rejects the code.
- As a learner, I want to run the command again on another function or after an edit and see the panel update, so that I can compare without managing windows.

## Requirements

- R1: When `aquascope.analyzeAtCursor` produces an analysis, the extension shows it in a webview panel instead of 003's summary notification. Showing or updating the panel leaves keyboard focus in the editor. The command's return value and the JSON written to the output channel are unchanged (003 R12).
- R2: The panel draws the analysis with Aquascope's own embed frontend at the pinned version (v0.4.0), configured as in D3. The diagram is read-only: the embed's re-run button, which would call an Aquascope server, is not shown.
- R3: The panel shows the whole lines spanned by the selected body's range, as they were when the command ran, including unsaved edits; for a closure this is the line or lines containing it. The embed receives the selected result with its lines shifted as in D2, so that every marker sits on the code it belongs to, including on lines with characters outside the Basic Multilingual Plane such as emoji.
- R4: There is at most one Aquascope panel. The first one opens beside the active editor. A later analysis replaces its contents and reveals it where it is, without taking focus. After the user closes it, the next analysis opens a new one. The panel's title names the analysed lines, for example "Aquascope: lines 17–21".
- R5: The panel never shows a result older than the latest finished run. When a run ends with one of 003's error messages (R10), the notification appears as in 003, and an open panel replaces its diagram with the same message. A run that is cancelled or replaced by a newer run, and a run that finds no active Rust editor (for example because the panel has focus), leave the panel as it was.
- R6: The panel works offline and sends nothing anywhere (constitution 6). It loads scripts, styles and other files only from the extension's own folder, under a content security policy with no network sources. Inline styles inserted by the embed at run time (`style-src 'unsafe-inline'`) and `data:` images are allowed, since they load nothing (D7). The embed's bug reporter and telemetry stay off.
- R7: The panel is readable in VS Code's default light and dark themes: the code, the step tables and the permission letters contrast with the background, and a missing permission looks different from a held one.
- R8: The vendored embed files live outside `src/`, so that they are packaged (`.vscodeignore` excludes `src/**`), together with a note of their origin (crate name and version, Aquascope commit) and Aquascope's MIT licence notice.
- R9: The embed is not part of the extension's bundle (`dist/extension.js`); the webview loads it from the extension folder, so activation is unaffected (constitution 3).
- R10: After drawing, the webview reports back to the extension what it shows: the code text, the number of step widgets and the number of boundary markers. Integration tests read this report, since a webview's contents are otherwise invisible to them.
- R11: The README's usage section describes the panel.

## Acceptance criteria

- [x] AC1: With the cursor in `main` of `05_method_mut_borrow`, running the command opens one Aquascope panel beside the editor, titled "Aquascope: lines 17–21". The panel reports `main`'s five lines, one step widget per entry in the result's `steps`, and one boundary marker per distinct boundary location. The active text editor is still the Rust file, and the command returns the 003 result.
- [x] AC2: Running the command again with the cursor in `grow` updates the same panel to "Aquascope: lines 8–11" and `grow`'s lines; there is still one Aquascope panel. After the panel is closed, the next run opens a new one.
- [x] AC3: After AC2, running the command with the cursor on the `struct` line leaves no diagram in the panel; it reports the no-function message.
- [x] AC4: For `04_push_while_borrowed_fail`, the boundary marker before `v` in `v.push(4);` shows the write permission as missing, drawn as the Book draws a missing permission (checked by hand).
- [x] AC5: After an unsaved edit inside `main`, the panel reports the edited text.
- [x] AC6: On `n1_non_ascii`, the boundary marker for the moved `s` sits directly before `s` in `let t = s;`, after the emoji on that line (checked by hand).
- [x] AC7: A run cancelled from the progress notification, and a run started while the panel has focus, leave the panel's diagram as it was (checked by hand).
- [x] AC8: The panel's HTML carries a content security policy whose script and resource sources are only the extension's own files, and the panel draws with the machine's network turned off (checked by hand).
- [x] AC9: In the Dark Modern and Light Modern themes, the code, step tables and permission letters are readable and missing permissions are distinguishable from held ones (checked by hand).
- [x] AC10: The vendored embed folder holds the origin note and the MIT licence, and `vsce ls` lists the embed files.
- [x] AC11: Integration tests cover AC1, AC2, AC3 and AC5 and pass in `npm test`.
- [x] AC12: In a panel narrower than 800 pixels, each step table sits after its line, at the same height, with the arrow pointing at the line's end, and the panel scrolls sideways to show it (checked by hand; D6).

## Out of scope

- Aquascope's other diagram, the interpreter's memory pictures (`interpreter` operation).
- Drawing in the text editor itself, for example as inline decorations or hovers.
- Updating as the user types or moves the cursor; the command remains the only trigger (003 D2). Marking the panel out of date after an edit.
- Several functions or a whole file in one panel.
- The Book's annotations (focused variables, focused lines, hidden lines), its "does not compile" marker, and flow permissions.
- Clicking in the panel to move the editor's cursor.
- Restoring the panel after VS Code restarts.
- New settings (D4).
- High-contrast themes beyond what the default styling gives.

## Open questions

None; Q1 is settled as D7.

## Appendix A: Aquascope's embed frontend at v0.4.0

Read from the pinned source (commit `f2d0a06`), checked out by spike 002 under `spikes/002-toolchain-bundling/work/src/aquascope/`. Paths below are relative to its `frontend/packages/` unless they start with `crates/`.

| Fact | Source |
| --- | --- |
| The embed renders every `.aquascope-embed` element on window load and exposes `window.initAquascopeBlocks(root)` | `aquascope-embed/src/main.tsx` |
| Inputs are data attributes: `data-code` (required), `data-operations` (required, e.g. `["permissions"]`), `data-responses` (`{operation: response}`), `data-config`, `data-annotations`, `data-no-interact` and `data-show-bug-reporter` hold JSON; `data-server-url` holds a plain URL | `aquascope-embed/src/main.tsx` |
| `data-no-interact="true"` makes the editor read-only and omits the re-run button; the mdBook preprocessor always sets it | `aquascope-embed/src/main.tsx`, `crates/mdbook-aquascope/src/preprocessor.rs` |
| The bug reporter appears only when `window.telemetry` exists and `data-show-bug-reporter` is true | `aquascope-embed/src/main.tsx` |
| Without a response, `renderOperation` POSTs the code to an Aquascope server, by default `http://127.0.0.1:8008` | `aquascope-editor/src/lib.tsx` |
| For `permissions`, the response is a list of `{Ok}` / `{Err}` entries as `cargo aquascope permissions` prints; `Ok` entries are drawn and `Err` entries only logged to the console | `aquascope-editor/src/lib.tsx` (`renderOperation`) |
| Step tables and boundaries are drawn only when the config's `stepper` and `boundaries` compare equal to `"true"` as strings, so booleans work | `aquascope-editor/src/editor-utils/permissions.tsx` (`renderPermissions`) |
| One step widget is drawn per entry in `steps`; boundary markers are de-duplicated by position | `aquascope-editor/src/editor-utils/permissions.tsx` |
| A position is `doc.line(line + 1).from + column`: `line` counts lines of `data-code` (a line outside it throws), and the column is a UTF-16 offset in CodeMirror, the unit of 003's result rather than of Aquascope's raw output | `aquascope-editor/src/editor-utils/misc.tsx` (`linecolToPosition`) and its callers in `stepper.tsx`, `boundaries.tsx` |
| `shouldFail` in the config adds an image from `img/ferris/does_not_compile.svg`, which is not among the embed's files | `aquascope-embed/src/main.tsx`, `aquascope-editor/src/lib.tsx` |
| Colours come from mdBook's CSS variables (`--bg`, `--fg`, `--code-bg`, `--sidebar-bg`, `--theme-popup-bg` and others) | `aquascope-embed/src/styles.scss` |
| Syntax tokens get highlight.js classes (`hljs-*`), coloured only by the host page | `aquascope-embed/src/setup.ts` |
| Below 800 px wide, step tables are placed under their line | `aquascope-editor/src/styles.scss` |
| The built embed is not in the git repository: the crate's build script copies the Vite IIFE build (`AquascopeEmbed`) from `aquascope-embed/dist/` into `js/`, the crate's `include` packages `js/**/*`, and docs.rs lists `js/embed.iife.js` and `js/style.css` in the published 0.4.0 crate | `crates/mdbook-aquascope/build.rs`, `crates/mdbook-aquascope/Cargo.toml`, `aquascope-embed/vite.config.ts`, spike 002 Appendix I |
