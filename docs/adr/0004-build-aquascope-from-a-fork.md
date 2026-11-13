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

## Revised 2026-11-09: nine changes, tag `v0.4.0-vscode.3`

Feature 009, showing the stack and heap of a program that is a whole crate, needs six more changes, all in the interpreter (its D3, D4 and D7, and the plan's one-crate build, measured by T-051's probe). The pin names tag `v0.4.0-vscode.3`, commit `0ae1372`, on the fork's branch `vscode-v0.4.0`, which now carries nine commits on upstream v0.4.0.

Five of the new changes are general and are offered upstream, each with its own branch. The arguments and error changes touch the same lines, so the error change's branch is stacked on the arguments branch. The frame paths reuse #202's helper, so that branch is stacked on #202's. The sixth change, running a binary as one crate with its library, exists to let the extension show a library's functions inside the program that calls them. It adds lines to the library's root file as the compiler reads it, so it stays in the fork; the extension is its only user. The pin therefore no longer returns to upstream when upstream takes the other eight changes, unless the extension finds another way to step through a library: teaching the interpreter to step through other crates' functions, which needs a different mapping from MIR to source.

Without the new options the interpreter runs as before, with three differences that every run sees:

- The program sees its crate's name as its first argument.
- When `MIRI_SYSROOT` is set, as the extension always sets it, every crate is built with Miri's standard library and `-Zalways-encode-mir` for the host target, in `target/<host>/` of the plugin's build folder.
- Programs holding a string literal, a `&str` into an array or a trait object now run instead of crashing; feature 007's single-file run gains this too.

The trace's frames gain `file_path`, which the extension's types now include.

| Commit | Change | Offered upstream |
| --- | --- | --- |
| `8d4b2f2` | The program's arguments (`interpreter -- <args>`), after the crate's name, and `--disable-isolation`, through a new `InterpretOptions` | [#203](https://github.com/cognitive-engineering-lab/aquascope/pull/203), branch `interpreter-args` |
| `47465c4` | When `MIRI_SYSROOT` is set, every crate is built as `cargo miri` does: `--sysroot`, `-Zalways-encode-mir` and `--target <host>` | [#205](https://github.com/cognitive-engineering-lab/aquascope/pull/205), branch `interpreter-miri-build` |
| `d56e7f1` | `file_path` on each frame of a trace | [#206](https://github.com/cognitive-engineering-lab/aquascope/pull/206), branch `frame-file-paths`, on #202 |
| `2bde423` | The reason a run ended without a trace goes to stderr; a crate with no entry point is an error, not a panic | [#204](https://github.com/cognitive-engineering-lab/aquascope/pull/204), branch `interpreter-errors`, on #203 |
| `6a06827` | String literals and `&str` into arrays are read as their characters, a literal's memory is shown with the heap, and trait objects are shown by their type (upstream issues #75 and #118) | [#207](https://github.com/cognitive-engineering-lab/aquascope/pull/207), branch `interpreter-string-literals` |
| `0ae1372` | `interpreter --bin-file <file>`: the binary is compiled as a module of its package's library, which is compiled as an executable with `no_main`, and the run starts at that module's `main` | Not offered: it serves the extension only |

On `vscode-v0.4.0`, `cargo fmt --check`, `cargo clippy -p aquascope -p aquascope_front -- -D warnings`, and `cargo test -p aquascope -p aquascope_front` pass. The tests are 72 unit tests, the new `interpreter_options.rs` and `one_crate.rs`, and the interpreter snapshots, which gain `file_path` and three new programs. Each upstream branch passes the same checks for the tests it touches.

## Revised 2026-11-09: ten changes, tag `v0.4.0-vscode.4`

The interpreted program saw no environment variables. Lifting isolation lets Miri forward the host environment, but only the snapshot in `MiriConfig::env`, which Miri's own driver fills and `v0.4.0-vscode.3` left empty. A todo CLI run from the extension therefore found no `HOME` and exited at once (T-057). The pin names tag `v0.4.0-vscode.4`, commit `edb5694`, which adds one commit to `vscode-v0.4.0`:

| Commit | Change | Offered upstream |
| --- | --- | --- |
| `edb5694` | The interpreter passes the host environment to Miri, which gives it to the program only when isolation is lifted | Added to [#203](https://github.com/cognitive-engineering-lab/aquascope/pull/203), branch `interpreter-args`, as `b5abc62` |

`tests/interpreter_options.rs` gains a test: with isolation lifted the program sees `PATH`, isolated it does not. On `vscode-v0.4.0`, `cargo fmt --check`, `cargo clippy -p aquascope -p aquascope_front -- -D warnings` and `cargo test -p aquascope -p aquascope_front` pass.


## Revised 2026-11-13: eleven changes, tag `v0.4.0-vscode.5`

Analysing a file whose function moves a field out of a recursive type, such as a linked stack's `pop` with `self.head = node.next`, failed with "Aquascope failed with exit code 101" (issue #61). Aquascope panicked with "Could not find path for place": the places it tracks stop expanding a recursive type, while the interior paths of a moved place keep going, so the lookup of an interior path failed. The pin names tag `v0.4.0-vscode.5`, commit `0bb6b88`, which adds one commit to `vscode-v0.4.0`:

| Commit | Change | Offered upstream |
| --- | --- | --- |
| `0bb6b88` | The move relation skips an interior path of a moved place that has no tracked place, instead of panicking | Not yet; branch `move-out-of-recursive` in the fork |

`tests/refinement/move_out_of_recursive.test` holds the case, and fails without the change. On `vscode-v0.4.0`, `cargo fmt --check`, `cargo clippy -p aquascope -p aquascope_front -- -D warnings` and `cargo test -p aquascope -p aquascope_front` pass.

## Revised 2026-11-13: twelve changes, tag `v0.4.0-vscode.6`

Analysing a file with a function that walks a recursive tree through a mutable reference, such as a binary search tree's `remove`, which descends with `while let Some(ref mut l) = min_ref.left`, failed with "Aquascope failed with exit code 101" (issue #64). It is the same cause as issue #61 at a second place: the places Aquascope tracks stop expanding a recursive type, and `path_to_perm_boundary` panicked in `place_to_path` for a place the function uses but the table lacks. Skipping the place, as the move relation now does, would have dropped the annotation at an expression the user wrote, so the change adds the place to the table instead. The pin names tag `v0.4.0-vscode.6`, commit `483957f`, which adds one commit to `vscode-v0.4.0`:

| Commit | Change | Offered upstream |
| --- | --- | --- |
| `50af5a4` | The table of tracked places also holds every place the MIR body mentions, so the permissions of an expression over a recursive type are derived like any other | Not yet; branch `place-table-used-places` in the fork |

`tests/boundaries/walk_recursive_box.test` holds the case, with its snapshot, and fails without the change. On `vscode-v0.4.0`, `cargo fmt --check`, `cargo clippy -p aquascope -p aquascope_front -- -D warnings` and `cargo test -p aquascope -p aquascope_front` pass. One thing the change does not touch: for a `while let Some(ref mut l) = place` scrutinee Aquascope expects read and drop but computes read and write, also for a non-recursive type, so the view may show a boundary there as violated.

## Revised 2026-11-13: thirteen changes, tag `v0.4.0-vscode.7`

Feature 010 gives step tables to functions that leave early and then branch again, such as `Config::parse` of issue #31, which until now had boundaries and no steps. The stepper closed every branch at the least post-dominator of its `switchInt`; when an arm returns, that point lies past the function's last statement, so the code after the branch could not be stepped and the fork's first change dropped the whole body's steps. The pin names tag `v0.4.0-vscode.7`, commit `23a8486`, which adds one commit to `vscode-v0.4.0`:

| Commit | Change | Offered upstream |
| --- | --- | --- |
| `23a8486` | A branch with an arm of type `!` and at least one arm that continues takes its join point from the continuing arms; the error path of `?` is left out of the tables, and the `val` it binds is not shown | Not yet; branch `step-diverging-arms` in the fork |

Two shapes still get no steps, as spec 010 decided (D2): an `if` chain where every arm returns with a `match` on a tuple inside, and `if … { break; }` in a `loop` followed by more code. `tests/analysis.rs` pins them as boundaries without steps. The change works around a bug in `CleanedBody::successors`, which keeps a `FalseEdge`'s imaginary target because it checks the target block's terminator instead of the source's; the fix at its source changes dominators everywhere and is left for upstream (D3).

`tests/steps/early_exit_*.test` hold eight cases with their snapshots, each checked by hand against the code; the 19 existing step snapshots are unchanged, and `tests/analysis.rs` gains a test that the early-exit shapes get steps. On `vscode-v0.4.0`, `cargo fmt --check`, `cargo clippy -p aquascope -p aquascope_front -- -D warnings` and `cargo test -p aquascope -p aquascope_front` pass. Across the extension's 20 fixture files, the step and boundary counts of every function are as on `v0.4.0-vscode.6` except `Config::parse` (0 to 10 steps) and the tree's `next` (0 to 20).

## Revised 2026-11-13: fourteen changes, tag `v0.4.0-vscode.8`

Feature 010's second task steps `let … else`. The stepper visited a `let` statement without opening a branch, so a `let … else` followed by another branch failed with "opening a branch missed a step" and the body lost its steps. The pin names tag `v0.4.0-vscode.8`, commit `baacb6c`, which adds one commit to `vscode-v0.4.0`:

| Commit | Change | Offered upstream |
| --- | --- | --- |
| `baacb6c` | A `let … else` is a branch on its pattern whose `else` block diverges, with a step for the bindings on the `let`'s line; the join point of a branch with diverging arms is the first location after it that every non-diverging path passes through; two fixes in the branch bookkeeping for patterns tested in several `switchInt`s | Not yet; branch `step-let-else` in the fork |

The join point's new definition gives the same location for every shape `v0.4.0-vscode.7` stepped, and its snapshots are unchanged; it also covers a nested pattern such as `let Some(Ok(x)) = e else`, whose `else` block is reached from both tests. The bookkeeping fixes are upstream bugs that the nested pattern reached: an implicit child of an implicit child branch looked up a span mapping only its ancestor had, and panicked (it now follows the ancestor, and returns an error if there is none), and `close_branch` compared against a branch's own table id instead of its union-find representative, so a branch unioned with an implicit child left its arms open.

`tests/steps/early_exit_let_else*.test` hold three cases (a simple pattern, a nested pattern followed by a second `let … else`, and a `let … else` on a plain place followed by `?`), each checked by hand; the existing snapshots are unchanged, and `tests/analysis.rs` adds `let … else` functions to the test that early exits get steps. On `vscode-v0.4.0`, `cargo fmt --check`, `cargo clippy -p aquascope -p aquascope_front -- -D warnings` and `cargo test -p aquascope -p aquascope_front` pass. Across the extension's 21 fixture files, only the new `n6_let_else.rs` changes, from 0 to 7 steps. Two `else` arms in the tests get no table on their line, because the step for their `return` falls in code shared with another exit or in a block reached from two tests; the tables shown are right, and the rest of each function is stepped.

## Revised 2026-11-13: fifteen changes, tag `v0.4.0-vscode.9`

Analysing a file with a plain `loop` that contains `if … { break; }` failed with "Aquascope failed with exit code 101" (issue #68). The stepper panicked with "index out of bounds" in `get_branch_scope`, and while the fork's first change turns a stepper error into a body with boundaries and no steps, a panic was not caught, so it aborted the analysis of every body in the crate. The pin names tag `v0.4.0-vscode.9`, commit `8bda2ab`, which adds one commit to `vscode-v0.4.0`:

| Commit | Change | Offered upstream |
| --- | --- | --- |
| `8bda2ab` | A panic in the permission steps is caught like the stepper's errors: it is logged, and the body keeps its boundaries with no steps | Not yet; branch `catch-stepper-panic` in the fork |

Spec 010 decided to fix the crash this way (D4) rather than the stepper's handling of that loop, which would also give such a loop its steps and is left for later. Catching is safe here because the panic happens in Aquascope's own code, outside any rustc query, and the stepper keeps no thread-local state that the unwinding could leave behind; the driver installs no compiler crash hook, so no crash report is written. `tests/analysis.rs` gains a test with the issue's program and a second function, which fails without the change with the issue's panic. On `vscode-v0.4.0`, `cargo fmt --check`, `cargo clippy -p aquascope -p aquascope_front -- -D warnings` and `cargo test -p aquascope -p aquascope_front` pass.

