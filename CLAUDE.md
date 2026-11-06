# Aquascope VS Code Extension

A VS Code extension, built spec-first with AI assistance. Everything needed to work on it (specs, decisions, task tracking) lives in this repo.

## Workflow: spec -> plan -> tasks -> implement

1. Read `specs/constitution.md` (non-negotiable principles) and `specs/product.md` (what we are building and why).
2. Every feature lives in `specs/features/NNN-slug/` with `spec.md` (what/why), `plan.md` (how), and `tasks.md` (ordered checklist). Copy from `specs/_templates/`.
3. Do not write implementation code for a feature until its `spec.md` is status `approved`. If the code and the spec disagree, fix the spec first, then the code.
4. Each task in `tasks.md` has a matching note in `vault/tasks/` (Obsidian). The note is the source of truth for status. Update its `status` frontmatter as you work: `todo` -> `doing` -> `review` -> `done`.
5. Record significant design choices as an ADR in `docs/adr/`.

## Task tracking

`vault/` is an Obsidian vault. Open it in Obsidian to see the board (`vault/views/board.base`). Create tasks with `npm run task -- new "Title" --feature 001-bootstrap-extension`. Task notes are plain Markdown with YAML frontmatter, so they can be edited without Obsidian.

## Commands

- `npm run compile` / `npm run watch` bundle with esbuild into `dist/`
- `npm run typecheck`, `npm run lint`, `npm test`
- `npm run package` builds the `.vsix`
- `npm run dev-bundle` links spike 002's build into a toolchain bundle for the end-to-end tests (see `scripts/dev-bundle.mjs`)
- F5 in VS Code launches the Extension Development Host

## Layout

- `src/` extension source; `src/test/suite/` integration tests
- `specs/` spec-driven artifacts; `docs/adr/` decisions
- `vault/` Obsidian task vault; `.claude/` agents and slash commands

## Rules

- Keep `activate()` fast; lazy-load heavy modules.
- Every user-facing command is declared in `package.json` `contributes` and covered by a test.
- Markdown files: one paragraph per line, never hard-wrap.
- Run `npm run typecheck && npm run lint && npm test` before marking a task `done`.
