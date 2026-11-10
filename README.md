# Aquascope VS Code Extension

Spec-driven, AI-assisted VS Code extension. See [CLAUDE.md](CLAUDE.md) for the workflow, `specs/` for what is being built, and `vault/` (open in Obsidian) for task tracking.

## Demo

A short demo of the extension in use:

<!-- markdownlint-disable-next-line MD034 -- GitHub only turns a bare attachment link into a video player -->
https://github.com/user-attachments/assets/b074c7ec-d93a-4ff4-a5d1-5d141dd60e49

## Usage

Open a Rust file, put the cursor inside a function and click the eye button at the right end of the editor's tab bar, beside Split Editor, or run **Aquascope: Analyze Function at Cursor** from the Command Palette. The button shows only above Rust files and analyses the file it sits above, even while the Aquascope panel has focus. To hide it, right-click it and choose **Hide**; right-clicking any of the tab bar's buttons brings it back. A file that belongs to a Cargo package is analysed with the rest of its crate: its other modules, the other members of its workspace and its crates.io dependencies. A file in no package is analysed on its own. Either way, the text analysed is exactly what the editors show, including unsaved changes. Each run is logged to the **Aquascope** output channel.

The result opens in an **Aquascope** panel beside the editor, drawn as in the Rust Book's experiment edition: beside each line, a table of how the variables' permissions change, and before each expression that needs a permission, a marker showing whether the variable has it. Running the command again updates the same panel without moving the cursor out of the editor. When a run cannot analyse the function, the panel shows why in place of the old diagram. Aquascope cannot work out the tables for a function that leaves early, with `return`, `?` or `let … else`, and then branches again with `if` or `match`; such a function is drawn with its markers but without the tables. The panel has no settings.

To analyse a crate, the extension keeps a copy of the project, with your unsaved editors written over it, in its own storage, and builds the copy there, so it never writes to the project folder. The first run on a project also builds the crate's dependencies, which takes a few seconds for a crate using `serde` and longer for bigger ones; later runs reuse them and take about a second. The copies and their build output stay in the extension's storage, which can grow to hundreds of megabytes for a project with many dependencies. It never downloads anything: the dependencies come from your cargo cache, so a project you have built before works offline, and for a dependency the cache lacks it asks you to run `cargo fetch` in the project. Building a crate runs the build scripts and proc macros of the project and of its dependencies, as `cargo check` does. They need a system linker, which on macOS comes with the Xcode Command Line Tools (`xcode-select --install`), and VS Code turns the extension off in Restricted Mode, so this happens only in folders you trust. Integration tests, examples and benches are analysed with their own targets; a `build.rs`, and functions in `#[cfg(test)]` modules, cannot be. When a crate cannot be analysed, the message says why and offers **Analyze This File Alone**.

To see memory instead of permissions, run **Aquascope: Show Stack and Heap** from the Command Palette in a Rust file. It runs the whole program, starting at `main`, in Aquascope's interpreter, and draws in the same panel what the Rust Book draws in its chapter on ownership: after each step, the stack frames with their variables and the heap with arrows to what each pointer owns, with a marker after the line of each step. It draws at most the first 100 steps and says when it stopped there; each call to a function of the program adds steps, so a shorter run shows them all. A run that reaches undefined behaviour, such as using a pointer after its memory was freed, is drawn up to that step, marked in red and named.

A file of a Cargo package with a binary runs that binary with the rest of its crate, as `cargo run` would: its library, its other modules and its dependencies, with your unsaved changes. Before the run it asks for the program's command-line arguments, as you would type them after `cargo run --`, filled with the ones you gave last time, so Enter repeats the last run; quotes keep spaces inside one argument, and Escape cancels. A package with several binaries first asks which one to run, offering the last one first. The program sees your environment variables and can read and write files, as with `cargo run`: a relative path such as minigrep's `poem.txt` is read from the workspace folder, in the extension's copy of the project, so writes land in the copy, while an absolute path reaches your own files. The panel draws the steps in the file you ran from, each with the whole stack, including the frames of functions in other files. Run from a module, such as minigrep's `config.rs` in the Rust Book's chapter 12, it shows that module's functions while the real program runs, with `main`'s frame below them; a file the program never reaches gets a message naming the files that have steps. A file in no package runs on its own, and so does any file through **Run This File Alone**, which a crate that cannot be run offers along with the reason.

Because it runs the program inside Miri, Rust's interpreter for checking unsafe code, it cannot show a program that reads input from the terminal, uses the network, or never ends; a program that panics or exits early is reported as having stopped while running, with the arguments it was given and Miri's reason, such as its exit code, and a run that never ends as a timeout. Code with compile errors cannot run at all, including code that fails borrow checking, which the permissions view can still show. The steps of functions in other crates, the crates.io dependencies and the other members of a workspace, are not drawn: a call into them passes in one step, as a call into the standard library does. A package's own library is drawn because its binary is compiled together with it as one crate; a binary whose modules refer to each other through `crate::` paths cannot be compiled that way, so it runs alone, and only its own files have steps. A string literal's text is drawn in the heap, the only place the panel has for memory outside the stack, although a compiled program keeps it with its code. The first run on a project builds the whole program for the interpreter, with no time limit; later runs of a program like minigrep take about ten seconds, since Miri interprets every function, the standard library's included.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `aquascope.toolchainPath` | empty | Folder holding the Aquascope tools and the pinned Rust toolchain, laid out as `bin/cargo-aquascope`, `bin/aquascope-driver` and `toolchain/`. Empty uses the copy shipped with the extension. Read from user settings only, so a workspace cannot point the extension at other programs. |
| `aquascope.analysisTimeoutSeconds` | `60` | Seconds an analysis may run before it is stopped (minimum 5). A run can also be cancelled from its progress notification. |

## Installing

This version is packaged for Macs with Apple silicon (darwin-arm64) and is installed from its VSIX file: in VS Code, run **Extensions: Install from VSIX…** from the Command Palette and choose `aquascope-vscode-extension-darwin-arm64-<version>.vsix`. The package carries Aquascope, the pinned Rust toolchain it needs and the standard library its interpreter runs programs with, so nothing else has to be installed, `aquascope.toolchainPath` can stay empty, and nothing is downloaded when it runs. Analysing a file with its crate, or running its program, uses the crate's dependencies from your cargo cache and, for build scripts and proc macros, a system linker, as described under Usage.

## Development

```sh
npm install
npm run compile
# press F5 in VS Code
```

For development without a package, build a development bundle from spike 002's output with `npm run dev-bundle` and set `aquascope.toolchainPath` to the folder it prints. The first run also builds the standard library that Aquascope's interpreter needs, which takes about 15 seconds and needs rustup's pinned nightly with the `miri` and `rust-src` components; without them the bundle serves the permissions view only. `npm test` finds that bundle on its own.

### Building a package

`npm run package` builds the VSIX for the machine it runs on; this version supports darwin-arm64 only. It needs rustup, git, the Xcode Command Line Tools, Node and npm, and the network while it builds. It works through five stages and stops with a message if any fails:

1. It checks that the Aquascope checkout in `build/aquascope-src` matches the pin in `spikes/002-toolchain-bundling/pin.env`. After the pin changes, delete that folder so the new tag is cloned.
2. It installs the pinned nightly and builds Aquascope. The pin names a fork of Aquascope with the changes ADR 0004 lists, such as keeping a function's markers when its tables cannot be worked out, and running a program with its arguments and its library.
3. It assembles the trimmed toolchain with its licence files, and the standard library built for Miri, which Aquascope's interpreter needs.
4. It runs the full test suite against exactly that toolchain.
5. It writes `aquascope-vscode-extension-darwin-arm64-<version>.vsix` at the repository root, checks its contents, including that no file holds your home folder's path, and prints its path and size (about 185 MB).

The first run downloads the nightly and Aquascope's dependencies, about 1 GB, and takes a few minutes; later runs take under a minute. All the work happens in `build/`, which git ignores and which can be deleted at any time to free several GB.
