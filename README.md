# Aquascope VS Code Extension

Spec-driven, AI-assisted VS Code extension. See [CLAUDE.md](CLAUDE.md) for the workflow, `specs/` for what is being built, and `vault/` (open in Obsidian) for task tracking.

## Demo

A short demo of the extension in use:

<!-- markdownlint-disable-next-line MD034 -- GitHub only turns a bare attachment link into a video player -->
https://github.com/user-attachments/assets/b074c7ec-d93a-4ff4-a5d1-5d141dd60e49

## Usage

Open a Rust file, put the cursor inside a function and click the eye button at the right end of the editor's tab bar, beside Split Editor, or run **Aquascope: Analyze Function at Cursor** from the Command Palette. The button shows only above Rust files and analyses the file it sits above, even while the Aquascope panel has focus. To hide it, right-click it and choose **Hide**; right-clicking any of the tab bar's buttons brings it back. The file is analysed on its own, exactly as it is in the editor, including unsaved changes. This version cannot follow `mod` declarations or external crates, and says so when the function at the cursor needs them. Each run is logged to the **Aquascope** output channel.

The result opens in an **Aquascope** panel beside the editor, drawn as in the Rust Book's experiment edition: beside each line, a table of how the variables' permissions change, and before each expression that needs a permission, a marker showing whether the variable has it. Running the command again updates the same panel without moving the cursor out of the editor. When a run cannot analyse the function, the panel shows why in place of the old diagram. The panel has no settings.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `aquascope.toolchainPath` | empty | Folder holding the Aquascope tools and the pinned Rust toolchain, laid out as `bin/cargo-aquascope`, `bin/aquascope-driver` and `toolchain/`. Empty uses the copy shipped with the extension. Read from user settings only, so a workspace cannot point the extension at other programs. |
| `aquascope.analysisTimeoutSeconds` | `60` | Seconds an analysis may run before it is stopped (minimum 5). A run can also be cancelled from its progress notification. |

## Installing

This version is packaged for Macs with Apple silicon (darwin-arm64) and is installed from its VSIX file: in VS Code, run **Extensions: Install from VSIX…** from the Command Palette and choose `aquascope-vscode-extension-darwin-arm64-<version>.vsix`. The package carries Aquascope and the pinned Rust toolchain it needs, so nothing else has to be installed, `aquascope.toolchainPath` can stay empty, and nothing is downloaded when it runs.

## Development

```sh
npm install
npm run compile
# press F5 in VS Code
```

For development without a package, build a development bundle from spike 002's output with `npm run dev-bundle` and set `aquascope.toolchainPath` to the folder it prints. `npm test` finds that bundle on its own.

### Building a package

`npm run package` builds the VSIX for the machine it runs on; this version supports darwin-arm64 only. It needs rustup, git, the Xcode Command Line Tools, Node and npm, and the network while it builds. It works through five stages and stops with a message if any fails:

1. It checks that the Aquascope checkout matches the pin in `spikes/002-toolchain-bundling/pin.env`.
2. It installs the pinned nightly and builds Aquascope.
3. It assembles the trimmed toolchain with its licence files.
4. It runs the full test suite against exactly that toolchain.
5. It writes `aquascope-vscode-extension-darwin-arm64-<version>.vsix` at the repository root, checks its contents, and prints its path and size (about 125 MB).

The first run downloads the nightly and Aquascope's dependencies, about 1 GB, and takes a few minutes; later runs take under a minute. All the work happens in `build/`, which git ignores and which can be deleted at any time to free several GB.
