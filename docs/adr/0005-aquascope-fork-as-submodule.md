# 0005. Check out the Aquascope fork as a submodule

- Status: accepted
- Date: 2026-11-17

## Context

ADR 0004 builds the extension's binaries from a fork of Aquascope, and since then most fixes have changed the fork and the extension together. T-065, T-072, T-073 and T-074 each changed the fork on a branch, tagged it, moved the tag and commit in `spikes/002-toolchain-bundling/pin.env`, and rebuilt the development bundle. Through all of that the fork's source lived in three places, none of them in this repository. The packaging script cloned the pinned tag into `build/aquascope-src`. The development bundle's binaries came from a checkout in `spikes/002-toolchain-bundling/work/src/aquascope`, whose `origin` was upstream and which had the fork as a second remote. The bindings, embed and notice scripts read that same spike checkout. Editing the fork beside the extension meant knowing about that buried checkout, and nothing tied it to the pin except the scripts that compared commits.

## Decision

The fork is a git submodule of this repository at `vendor/aquascope`, tracking the fork's integration branch `vscode-v0.4.0`. The submodule records the exact commit the extension is built from. `pin.env` keeps the fork's repository, tag and commit, because the packaging script and the spikes read them, and `src/test/suite/pin.test.ts` fails when its commit differs from the one the submodule records. Everything that built from a clone now builds from the submodule. The packaging script builds the pinned commit only: it stops when the submodule is at another commit or has local changes, and when the fork's tag does not name that commit, so a package can't be built from a commit the fork doesn't have. Spike 002's `build.sh` builds the development bundle's binaries from whatever the submodule has checked out, so a fork branch can be tried in the extension before it is tagged. The release workflow checks out submodules. `vendor/` is kept out of the VSIX by `.vscodeignore` and by the package check.

A change to the fork now goes as follows. Make a branch in `vendor/aquascope` from `vscode-v0.4.0`, commit, and push it to the fork. Rebuild with `build.sh` and run the extension's tests. Open a pull request into `vscode-v0.4.0` and tag the commit `v0.4.0-vscode.N`. Then, in the extension, commit the submodule at that commit along with the tag and commit in `pin.env`. DEVELOPMENT.md has the commands.

Alternatives considered:

- **Keep the clone, and add a workspace file and a script that clones the fork beside the extension.** This gives the same editing in one window without a submodule. But the checkout would still not be tied to the pin, and the pin would remain the only record of the commit.
- **Copy the fork's source into this repository.** That would lose the fork's own history, tests and upstream pull requests, which ADR 0004 relies on.
- **Make the submodule shallow.** The fork is small, under 3 MB with about 300 files, and a full clone lets branches be made and pushed from the submodule as from any clone.

## Consequences

- A fresh clone needs `git clone --recursive`, or `git submodule update --init` afterwards. The packaging script and `build.sh` run the latter themselves when the submodule is missing.
- The fork's commit has to be pushed before the extension commit that records it. The release workflow's checkout fails otherwise, and the packaging script's tag check catches it locally.
- The submodule is its own git repository, so its commit email must be set in it separately (`git -C vendor/aquascope config user.email …`).
- `build/aquascope-src` and the spike's checkout in `spikes/002-toolchain-bundling/work/src/aquascope` are no longer used and can be deleted. The older spikes' probes still clone the pinned tag into their own `work/` folders, as they always have.
- A `cargo test` run inside `vendor/aquascope` fills its `target/` folder with several GB. The fork's `.gitignore` ignores that folder, and the workspace settings keep VS Code's file watcher out of it.
