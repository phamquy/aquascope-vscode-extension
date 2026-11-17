---
id: T-075
title: "Check out the Aquascope fork as a submodule"
status: review
priority: medium
feature: "005-package-per-platform-vsix"
created: 2026-11-17
---

# T-075 Check out the Aquascope fork as a submodule

Spec: [[specs/features/005-package-per-platform-vsix/spec.md]]

## Done when

- [x] The fork is the submodule `vendor/aquascope`, tracking `vscode-v0.4.0`, at the commit `pin.env` names, and `src/test/suite/pin.test.ts` fails when the two differ
- [x] The packaging script builds from the submodule and stops when it is at another commit, has local changes, or the fork's tag in the pin does not name the commit; `npm run package` passes from it
- [x] Spike 002's `build.sh` and the bindings, embed and notice scripts use the submodule; the release workflow checks out submodules; `vendor/` stays out of the VSIX, and the package check rejects it
- [x] ADR 0005 records the decision, and DEVELOPMENT.md describes cloning with the submodule and changing the fork

## Notes

- Asked for 2026-11-17, to edit, view and build the fork together with the extension. Until now the fork's source was cloned in three places outside the repository: `build/aquascope-src` for packages, `spikes/002-toolchain-bundling/work/src/aquascope` for the development bundle, and the same spike checkout for the bindings, embed and notice scripts.
- `pin.env` keeps the fork's repository, tag and commit, since the packaging script and the older spikes' probes read them; the test ties its commit to the submodule's. The fork is small (under 3 MB, about 300 files, longest path 111 characters), so the submodule is a full clone, not shallow.
- `build/aquascope-src` and the spike checkout are no longer used and can be deleted by hand.
- Checks: `npm run typecheck` and `npm run lint` pass. `npm run package` from the submodule passes all five stages: the check stage finds `v0.4.0-vscode.13` at `3d2df9a` on the fork, the test stage has 263 passing and 2 pending, and `check-vsix` passes with 161 entries, as many as before. The check stage stops on an uncommitted change in the submodule, and on a pin whose tag (`v0.4.0-vscode.12`) names another commit. The pin test fails when `AQUASCOPE_COMMIT` differs from the submodule's commit. The release workflow's submodule checkout runs at the next release.
