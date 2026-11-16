# Aquascope for VS Code

See how Rust's ownership and borrowing work in your own code. This extension runs [Aquascope](https://github.com/cognitive-engineering-lab/aquascope) on the Rust file you are editing and draws its diagrams in a panel beside the editor, the same diagrams the [Rust Book's experiment edition](https://rust-book.cs.brown.edu) uses to teach ownership. It has two views: **permissions**, which shows what each variable may do at each line, and **stack and heap**, which runs your program and shows its memory step by step.

A short demo of the extension in use:

<!-- markdownlint-disable-next-line MD034 -- GitHub only turns a bare attachment link into a video player -->
https://github.com/user-attachments/assets/b074c7ec-d93a-4ff4-a5d1-5d141dd60e49

## Requirements

The extension runs on Macs with Apple silicon; other platforms are not packaged yet. It brings everything it runs with it: Aquascope, the Rust toolchain Aquascope needs and the standard library its interpreter uses. You do not need Rust installed, the extension never touches your own toolchain, and it downloads nothing.

Two things come from your machine when a project has dependencies. The dependencies themselves come from your cargo cache, so a project you have built before works offline, and for a dependency the cache lacks the extension asks you to run `cargo fetch` in the project. Build scripts and proc macros, in your project or its dependencies, need a system linker, which on macOS comes with the Xcode Command Line Tools (`xcode-select --install`).

Because analysing a crate runs its build scripts and proc macros, as `cargo check` does, VS Code turns the extension off in Restricted Mode, so it only runs in folders you trust.

## Installing

Search for **Aquascope** in VS Code's Extensions view and install it, or run `code --install-extension psyquy.aquascope-vscode-extension`. Each version is also attached to a [GitHub release](https://github.com/phamquy/aquascope-vscode-extension/releases) as a `.vsix` file, which you can install with **Extensions: Install from VSIX…** from the Command Palette.

## Seeing permissions

Open a Rust file, put the cursor inside a function and click the eye button at the right end of the editor's tab bar, beside Split Editor, or run **Aquascope: Analyze Function at Cursor** from the Command Palette. The button shows only above Rust files and analyses the file it sits above, even while the Aquascope panel has focus. To hide it, right-click it and choose **Hide**; right-clicking any of the tab bar's buttons brings it back.

The result opens in an **Aquascope** panel beside the editor, drawn as in the Rust Book's experiment edition: beside each line, a table of how the variables' permissions change, and before each expression that needs a permission, a marker showing whether the variable has it. Running the command again updates the same panel without moving the cursor out of the editor. When a run cannot analyse the function, the panel shows why in place of the old diagram. The text analysed is exactly what the editors show, including unsaved changes, and each run is logged to the **Aquascope** output channel. The panel has no settings.

Aquascope cannot work out the tables for a function that leaves early, with `return`, `?` or `let … else`, and then branches again with `if` or `match`. Such a function is drawn with its markers but without the tables.

### Files in a Cargo package

A file that belongs to a Cargo package is analysed with the rest of its crate: its other modules, the other members of its workspace and its crates.io dependencies. A file in no package is analysed on its own.

To analyse a crate, the extension keeps a copy of the project, with your unsaved editors written over it, in its own storage, and builds the copy there, so it never writes to your project folder. The first run on a project also builds the crate's dependencies, which takes a few seconds for a crate using `serde` and longer for bigger ones; later runs reuse them and take about a second. The copies and their build output stay in the extension's storage, which can grow to hundreds of megabytes for a project with many dependencies.

Integration tests, examples and benches are analysed with their own targets. A `build.rs`, and functions in `#[cfg(test)]` modules, cannot be analysed. When a crate cannot be analysed, the message says why and offers **Analyze This File Alone**.

## Seeing the stack and heap

To see memory instead of permissions, run **Aquascope: Show Stack and Heap** from the Command Palette in a Rust file. It runs the whole program, starting at `main`, in Aquascope's interpreter, and draws in the same panel what the Rust Book draws in its chapter on ownership: after each step, the stack frames with their variables and the heap with arrows to what each pointer owns, with a marker after the line of each step. It draws at most the first 100 steps and says when it stopped there; each call to a function of the program adds steps, so a shorter run shows them all. A run that reaches undefined behaviour, such as using a pointer after its memory was freed, is drawn up to that step, marked in red and named.

### Programs in a Cargo package

A file of a Cargo package with a binary runs that binary with the rest of its crate, as `cargo run` would: its library, its other modules and its dependencies, with your unsaved changes. Before the run it asks for the program's command-line arguments, as you would type them after `cargo run --`, filled with the ones you gave last time, so Enter repeats the last run; quotes keep spaces inside one argument, and Escape cancels. A package with several binaries first asks which one to run, offering the last one first.

The program sees your environment variables and can read and write files, as with `cargo run`. A relative path such as minigrep's `poem.txt` is read from the workspace folder, in the extension's copy of the project, so writes land in the copy, while an absolute path reaches your own files.

The panel draws the steps in the file you ran from, each with the whole stack, including the frames of functions in other files. Run from a module, such as minigrep's `config.rs` in the Rust Book's chapter 12, it shows that module's functions while the real program runs, with `main`'s frame below them; a file the program never reaches gets a message naming the files that have steps. A file in no package runs on its own, and so does any file through **Run This File Alone**, which a crate that cannot be run offers along with the reason.

### What the stack and heap view cannot show

The program runs inside Miri, Rust's interpreter for checking unsafe code, which sets these limits:

- It cannot show a program that reads input from the terminal, uses the network, or never ends. A program that panics or exits early is reported as having stopped while running, with the arguments it was given and Miri's reason, such as its exit code, and a run that never ends as a timeout.
- Code with compile errors cannot run at all, including code that fails borrow checking, which the permissions view can still show.
- The steps of functions in other crates, the crates.io dependencies and the other members of a workspace, are not drawn: a call into them passes in one step, as a call into the standard library does. A package's own library is drawn because its binary is compiled together with it as one crate; a binary whose modules refer to each other through `crate::` paths cannot be compiled that way, so it runs alone, and only its own files have steps.
- A string literal's text is drawn in the heap, the only place the panel has for memory outside the stack, although a compiled program keeps it with its code.
- The first run on a project builds the whole program for the interpreter, with no time limit. Later runs of a program like minigrep take about ten seconds, since Miri interprets every function, the standard library's included.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `aquascope.analysisTimeoutSeconds` | `60` | Seconds an analysis may run before it is stopped (minimum 5). A run can also be cancelled from its progress notification. |
| `aquascope.toolchainPath` | empty | Leave it empty to use the Aquascope tools and Rust toolchain that ship with the extension. Set it only to use your own build, a folder laid out as `bin/cargo-aquascope`, `bin/aquascope-driver` and `toolchain/`. It is read from user settings only, so a workspace cannot point the extension at other programs. |

## Reporting a problem

Open an issue at [github.com/phamquy/aquascope-vscode-extension/issues](https://github.com/phamquy/aquascope-vscode-extension/issues) with the code you analysed and what the **Aquascope** output channel logged for that run.

## Credits and licence

The diagrams and analyses come from [Aquascope](https://github.com/cognitive-engineering-lab/aquascope), by the Cognitive Engineering Lab, under the MIT licence. The extension builds it from a fork with a few fixes and is an independent project, not made by Aquascope's authors. The extension itself is MIT licensed; see [LICENSE](LICENSE). To work on the extension, see [DEVELOPMENT.md](DEVELOPMENT.md).
