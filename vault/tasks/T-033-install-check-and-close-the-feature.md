---
id: T-033
title: "Install check and close the feature"
status: review
priority: medium
feature: "005-package-per-platform-vsix"
created: 2026-11-07
---

# T-033 Install check and close the feature

Spec: [[specs/features/005-package-per-platform-vsix/spec.md]]

## Done when

- [x] AC5 is checked by hand on a macOS account without rustup with a browser-downloaded VSIX and the network off, the spec's criteria are ticked, and feature 005 is marked implemented

## Notes

- The VSIX built by `npm run package` at the merge of T-032 (`aquascope-vscode-extension-darwin-arm64-0.0.1.vsix`, 124.2 MB, SHA-256 `b72c6a68816f252b369a13154520d9be126ea9138b18ac76c624c473567334cd`) was attached by the user to a draft pre-release on the private GitHub repository, with the notes giving the check's steps.
- AC5, checked by the user on 2026-11-06 and reported as passing in full: on a macOS account without rustup, the VSIX was downloaded through a browser and its SHA-256 matched. Then, with the network off, it was installed with "Install from VSIX…" into a fresh profile with `aquascope.toolchainPath` empty. The panel drew the diagram for `main` of `05_method_mut_borrow`, and no macOS security dialog appeared. This also confirms that installing kept the binaries executable (R8) and that the extension found its bundled tools through 003 R3's empty-setting path.
- All seven criteria ticked, with where each was verified: AC1 to AC3 by `check-vsix.mjs` on every packaging run (T-032), AC4 by hand in T-032, AC5 here, AC6 by hand in T-031, AC7 in T-032. Spec 005 and its row in `specs/product.md` set to `implemented`; the product spec's Gatekeeper risk now records this check.

