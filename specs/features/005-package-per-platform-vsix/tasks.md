---
feature: 005-package-per-platform-vsix
---

# Tasks

Each line maps to a note in `vault/tasks/`. Status lives in the note, not here.

- [ ] T-029 Add the extension's licence and the embed's third-party notice (done when: `LICENSE` is MIT, "Copyright (c) 2026 Jack Pham", and `media/aquascope-embed/THIRD-PARTY-NOTICES` lists every library of the embed's production dependency closure at the pinned frontend's versions with copyright line and licence; R7, D5; needs your approval for the `npm pack` downloads)
- [ ] T-030 Make the test run strict about the toolchain on request (done when: with `AQUASCOPE_REQUIRE_TOOLCHAIN=1`, a missing bundle stops `npm test` and a toolchain test fails instead of skipping, the default still skips, and harness tests cover both; R5, AC4)
- [ ] T-031 Build and assemble the bundle (done when: `scripts/package-platform.sh` checks the platform and the pin, builds the binaries, and fills `build/bundle/` with the binaries, the trimmed toolchain keeping its licence files, Aquascope's `LICENSE` and the crate notices from `scripts/crate-notices.mjs`; AC6 recorded; R1–R4, R6, R7, D4; needs your approval for the rustup and cargo downloads)
- [ ] T-032 Test, package and check the VSIX (done when: the script runs the strict tests against the bundle, packages `darwin-arm64` with the bundle at the root only for `vsce`, removes it on every exit, deletes the previous VSIX first, and `scripts/check-vsix.sh` passes AC1 to AC3; `npm run package` runs it; AC4 and AC7 recorded; R5, R8, R9)
- [ ] T-033 Install check and close the feature (done when: AC5 is checked by hand on a macOS account without rustup with a browser-downloaded VSIX and the network off, the spec's criteria are ticked, and feature 005 is marked implemented)

T-029 and T-030 are independent and can run in either order. T-031 needs neither. T-032 needs all three, and T-033 comes last.
