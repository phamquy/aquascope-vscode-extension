---
id: T-029
title: "Add the extension's licence and the embed's third-party notice"
status: done
priority: medium
feature: "005-package-per-platform-vsix"
created: 2026-11-07
---

# T-029 Add the extension's licence and the embed's third-party notice

Spec: [[specs/features/005-package-per-platform-vsix/spec.md]]

## Done when

- [x] `LICENSE` is MIT, "Copyright (c) 2026 Jack Pham", and `media/aquascope-embed/THIRD-PARTY-NOTICES` lists every library of the embed's production dependency closure at the pinned frontend's versions with copyright line and licence; R7, D5; needs your approval for the `npm pack` downloads

## Notes

- `LICENSE`: MIT, "Copyright (c) 2026 Jack Pham" (D5). `vsce ls` now lists it, and `vsce` no longer stops at its missing-licence prompt.
- `scripts/embed-notices.py` (committed so the notice can be regenerated on upgrade): takes the packages the embed and editor sources import at run time, resolves them in the pinned frontend's `pnpm-lock.yaml` (lockfile v9 importers and snapshots), follows their runtime and optional dependencies, fetches each with `npm pack` into a temporary folder, and copies the licence files from the package root. Leader Line, vendored in Aquascope's frontend, gets its source header (Copyright (c) 2025 anseki, MIT) and the MIT text. Needs PyYAML, npm and the network.
- `media/aquascope-embed/THIRD-PARTY-NOTICES`: 24 npm packages (CodeMirror, Lezer, React, ReactDOM, scheduler, Floating UI, Font Awesome, lodash, classnames, style-mod, w3c-keyname, loose-envify, js-tokens) plus Leader Line; all 24 ship licence files; all MIT except Font Awesome's icons (CC BY 4.0 with MIT code). The only version difference between the editor and embed entries is `@types/react-dom`, which is not bundled.
- Correction to T-023: the Modernizr banner in `embed.iife.js` belongs to React DOM's `isEventSupported` ("Borrows from Modernizr"), not to Leader Line. Fixed in `scripts/vendor-aquascope-embed.sh`, the generated `README.md` beside the embed (identical wording) and the 005 spec's evidence table.
- Checks: typecheck and lint clean, 91 tests passing (no code changed).

