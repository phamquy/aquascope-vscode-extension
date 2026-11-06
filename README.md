# Aquascope VS Code Extension

Spec-driven, AI-assisted VS Code extension. See [CLAUDE.md](CLAUDE.md) for the workflow, `specs/` for what is being built, and `vault/` (open in Obsidian) for task tracking.

## Usage

Open a Rust file, put the cursor inside a function and run **Aquascope: Analyze Function at Cursor** from the Command Palette. The file is analysed on its own, exactly as it is in the editor, including unsaved changes. This version cannot follow `mod` declarations or external crates, and says so when the function at the cursor needs them. Each run is logged to the **Aquascope** output channel.

The result opens in an **Aquascope** panel beside the editor, drawn as in the Rust Book's experiment edition: beside each line, a table of how the variables' permissions change, and before each expression that needs a permission, a marker showing whether the variable has it. Running the command again updates the same panel without moving the cursor out of the editor. When a run cannot analyse the function, the panel shows why in place of the old diagram. The panel has no settings.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `aquascope.toolchainPath` | empty | Folder holding the Aquascope tools and the pinned Rust toolchain, laid out as `bin/cargo-aquascope`, `bin/aquascope-driver` and `toolchain/`. Empty uses the copy shipped with the extension. Read from user settings only, so a workspace cannot point the extension at other programs. |
| `aquascope.analysisTimeoutSeconds` | `60` | Seconds an analysis may run before it is stopped (minimum 5). A run can also be cancelled from its progress notification. |

## Development

```sh
npm install
npm run compile
# press F5 in VS Code
```

Until the toolchain ships inside the extension (feature 005), build a development bundle from spike 002's output with `npm run dev-bundle` and set `aquascope.toolchainPath` to the folder it prints. `npm test` finds that bundle on its own.
