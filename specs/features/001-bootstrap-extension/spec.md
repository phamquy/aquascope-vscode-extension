---
id: 001-bootstrap-extension
title: Bootstrap extension
status: implemented
---

# Bootstrap extension

## Why

Establish a buildable, testable, packageable extension skeleton that later features build on.

## Requirements

- R1: The extension activates and registers `aquascope.hello`.
- R2: Build, lint, typecheck, test and package scripts all run from a clean checkout.

## Acceptance criteria

- [x] F5 launches the Extension Development Host and the command shows a notification.
- [x] `npm test` passes.
- [x] `npm run package` produces a `.vsix`.

## Open questions

- Final publisher id and extension name.
