# Aquascope VS Code Extension

A VS Code extension, built spec-first with AI assistance. Everything needed to work on it (specs, decisions, task tracking) lives in this repo.

## Workflow: spec -> plan -> tasks -> implement

1. Read `specs/constitution.md` (non-negotiable principles) and `specs/product.md` (what we are building and why).
2. Every feature lives in `specs/features/NNN-slug/` with `spec.md` (what/why), `plan.md` (how), and `tasks.md` (ordered checklist). Copy from `specs/_templates/`.
3. Do not write implementation code for a feature until its `spec.md` is status `approved`. If the code and the spec disagree, fix the spec first, then the code.
4. Each task in `tasks.md` has a matching note in `vault/tasks/` (Obsidian). The note is the source of truth for status. Update its `status` frontmatter as you work: `todo` -> `doing` -> `review` -> `done`.
5. Each task is one pull request into `main`, so the history has one reviewed unit per task. Start from an up-to-date `main` on a branch named `task/T-NNN-slug`, commit the task as one commit whose subject ends with the task id, push, and open the PR with `gh pr create`; the note is `review` while the PR is open. Once the user approves, set the note to `done` and bump the build number on the branch (see Versions and releases), push, and merge with `gh pr merge --squash --delete-branch`.
6. Record significant design choices as an ADR in `docs/adr/`.

## Versions and releases

- Between releases, the version in `package.json` is the next patch version with a build number after a dash: after release x.y.z, builds are x.y.(z+1)-1, x.y.(z+1)-2, and so on, so that every build sorts after the release before it and before the next one. For example, after 1.1.3 come 1.1.4-1 and 1.1.4-2.
- Every pull request merged into `main` bumps the build number and nothing else, for example 1.1.4-2 to 1.1.4-3: once the user approves, run `npm version <x.y.z-n> --no-git-tag-version` on the branch, which updates `package.json` and `package-lock.json`, so the squash merge carries it. The first merge after a release starts the next patch at build 1.
- A build version is never released: push no `v<version>` tag for it. A pushed tag starts `.github/workflows/publish.yml`, which publishes to the Marketplace, and the Marketplace refuses versions with a dash anyway.
- Any change to the first three numbers is a release, made only when the user says to: set the version to the one they name without a build number (the next patch, such as 1.1.4, or a new minor or major), merge it to `main`, then push the `v<version>` tag. DEVELOPMENT.md describes the release workflow.

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
- `vendor/aquascope` the Aquascope fork, a git submodule at the pinned commit (ADR 0005); DEVELOPMENT.md describes changing it

## Rules

- Keep `activate()` fast; lazy-load heavy modules.
- Every user-facing command is declared in `package.json` `contributes` and covered by a test.
- Markdown files: one paragraph per line, never hard-wrap.
- Run `npm run typecheck && npm run lint && npm test` before marking a task `done`.
