---
id: T-023
title: "Vendor the embed from the mdbook-aquascope 0.4.0 crate"
status: done
priority: medium
feature: "004-render-visualization-webview"
created: 2026-11-06
---

# T-023 Vendor the embed from the mdbook-aquascope 0.4.0 crate

Spec: [[specs/features/004-render-visualization-webview/spec.md]]

## Done when

- [x] `media/aquascope-embed/` holds `embed.iife.js`, `style.css`, Aquascope's `LICENSE` and an origin note naming the crate version and the commit read from `.cargo_vcs_info.json`, the script recreates them, and `vsce ls` lists them; R8, AC10; needs your approval for the download

## Notes

- `scripts/vendor-aquascope-embed.sh` reads the archive's SHA-256 from the crates.io sparse index (`index.crates.io/md/bo/mdbook-aquascope`), downloads `mdbook-aquascope-0.4.0.crate` from `static.crates.io`, verifies it, and refuses to copy unless `.cargo_vcs_info.json` names the pinned commit. Run on 2026-11-06: checksum `ee615a65…f71696` matched, built from `f2d0a06` (v0.4.0). A second run reproduced byte-identical files.
- `media/aquascope-embed/`: `embed.iife.js` (2.2 MB), `style.css` (30 KB), `LICENSE` from the pinned checkout (the crate does not include it), and a generated `README.md` origin note.
- Bundled libraries found in the build and listed in the note: React and ReactDOM, CodeMirror 6, lodash, Floating UI, Leader Line with a custom Modernizr build (its own `@license` banner, MIT), Font Awesome SVG core and icons. The build contains no `eval(` and no `new Function`, a good sign for Q1.
- AC10: `npx vsce ls` lists `media/aquascope-embed/{embed.iife.js,style.css,README.md,LICENSE}`; the criterion itself is ticked in T-028.

