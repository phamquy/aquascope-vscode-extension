# 0004. Build Aquascope from a fork that keeps permission boundaries

- Status: accepted
- Date: 2026-11-08

## Context

Issue #31 reports that the permissions view fails on the Rust Book's minigrep `Config::parse`, a function that does nothing unusual. Aquascope v0.4.0, the release this extension pins and still the tip of upstream's `main`, gives up on any function that leaves early, with `return`, `?` or `let … else`, and then reaches another `if` or `match`. Two `?` in a row are enough. Code like this is everyday Rust, so the extension refuses many of the functions learners write.

The cause is in Aquascope's permission stepper, the part that computes how permissions change after each line. It assumes the branches of every `if` and `match` meet again. An arm that returns never meets the others, so the stepper finds nowhere to attach the next branch and returns an error. `AquascopeAnalysis::run` then returns that error for the whole function and discards the permission boundaries it has already computed, although the boundaries do not depend on the steps. Upstream issue cognitive-engineering-lab/aquascope#157 has reported the same failure since April 2025, on an older version.

The extension cannot recover this on its own side, because for such a function Aquascope's output holds only the error message: no boundaries and no range.

## Decision

The extension builds Aquascope from the owner's fork, [phamquy/aquascope](https://github.com/phamquy/aquascope), at tag `v0.4.0-vscode.1`. That tag is upstream v0.4.0 plus one commit, `27ad0b3`. When the steps cannot be computed, the commit returns the function with its boundaries and no steps, and logs the stepper's error. Functions the stepper handles give the same output as before. The commit adds a test to Aquascope's own suite and was offered upstream as cognitive-engineering-lab/aquascope#199.

`spikes/002-toolchain-bundling/pin.env` names the fork's repository, tag and commit, which the packaging script and spike 002's build use as before. It also names the upstream release the fork is based on. The embed frontend still comes from the `mdbook-aquascope` crate published for that release, and the TypeScript bindings are unchanged, because the fix touches neither.

When an upstream release includes the fix, the pin returns to that release and the fork is no longer needed.

Alternatives considered:

- **A patch file in this repository, applied by the packaging script before it builds.** This keeps upstream as the only source, but the change would live outside Aquascope's history and tests, and every build would depend on it applying cleanly. The fork keeps the change as one reviewable commit, tested with Aquascope's own suite, and the upstream pull request carries the same commit.
- **Wait for upstream.** The issue has been open for over a year, and the extension would keep failing on common code until a release.
- **Fix the stepper so these functions also get their steps.** That is the real fix, but it is design work on Aquascope's handling of control flow. It belongs upstream in #157 and is not attempted here.

## Consequences

- Functions that return early and then branch again are now drawn with their permission markers but without the per-line tables. The panel does not say why the tables are missing; the README describes the limit.
- The binaries come from the owner's fork, not from upstream. The licence is unchanged (MIT), and the fork is upstream v0.4.0 plus one public commit.
- Every Aquascope upgrade means rebasing the commit onto the new release and tagging it in the fork, unless the release already includes the fix.
- Changing the pin means deleting `build/aquascope-src` so the packaging script clones the new tag, and moving spike 002's checkout to the new tag before rebuilding the development bundle.
- The captured fixture output in `src/test/fixtures/data/` stays valid. Appendix A compares the two versions.

## Revised 2026-11-09: three changes, tag `v0.4.0-vscode.2`

Feature 008, analysing a function with the rest of its crate, needs two more changes in Aquascope (its D2 and D3, measured by T-044's probe). The fork now carries three commits on top of upstream v0.4.0, and the pin names tag `v0.4.0-vscode.2`, commit `467a9ae`:

| Commit | Change | Offered upstream |
| --- | --- | --- |
| `27ad0b3` | Keep a body's permission boundaries when its permission steps fail (issue #31) | [#199](https://github.com/cognitive-engineering-lab/aquascope/pull/199) |
| `07bc660` | `--crate-of <file>`: analyse only the crate containing a file, through rustc_plugin's `CrateContainingFile` filter | [#201](https://github.com/cognitive-engineering-lab/aquascope/pull/201) |
| `467a9ae` | `file_path` on each result and on each build error: the path of the body's file, as the compiler was given it | [#202](https://github.com/cognitive-engineering-lab/aquascope/pull/202) |

The tag is on the fork's branch `vscode-v0.4.0`, which is `v0.4.0-vscode.1` with the second and third commits applied. Each of those also has its own branch from upstream v0.4.0, `crate-of-option` and `file-paths`, which its pull request uses. The embed frontend and the upstream release the fork is based on are unchanged.

The pin returns to upstream only when a release holds all three changes, and until then every Aquascope upgrade means applying three commits instead of one. Without `--crate-of`, the fork runs exactly as before. Its output gains the `file_path` fields, which the extension's types now include. The captured fixtures made before this tag lack them, so the parser must not rely on the field for single-file runs.

The output of `cargo aquascope permissions` for each of the 17 programs in `src/test/fixtures/workspace/` (edition 2024, library crate), from v0.4.0 and from the fork:

| Programs | Result |
| --- | --- |
| 16 programs: `01` to `05`, `e1` to `e5`, `i1`, `i4`, `i6`, `i10`, `n1`, `n2` | Same content. The order of entries within `steps` varies between runs of the same binary, so they were compared with arrays sorted |
| `n3_early_return` (issue #31) | `Config::parse` was `AnalysisError: no open collection dominates root location bb11[1]`; it is now `Ok`, with 10 boundaries and no steps. The other five bodies are unchanged |

Variants of the failing shape, run with v0.4.0 and with the fork:

| Function | v0.4.0 | Fork |
| --- | --- | --- |
| Two `match`es, each with `None => return Err(..)` | error | 7 boundaries, no steps |
| Early-return `match`, then a `match` without return | error | 7 boundaries |
| Early-return `match`, then `if` | error | 4 boundaries |
| `if … { return … }`, then `match` | error | 4 boundaries |
| Two `?` in a row | error | 7 boundaries |
| `let … else { return … }`, then `match` | error (`opening a branch missed a step`) | 6 boundaries |
| One early-return `match`, then straight-line code | analysed | unchanged |
| Two `match`es without early return | analysed | unchanged |

In Aquascope's suite, the new `tests/analysis.rs` fails on v0.4.0 and passes on the fork. The rest of `cargo test -p aquascope` passes unchanged, as do `cargo fmt --check` and `cargo clippy -p aquascope -- -D warnings`.
