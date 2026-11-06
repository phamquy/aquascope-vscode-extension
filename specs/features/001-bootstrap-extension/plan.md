---
feature: 001-bootstrap-extension
---

# Plan

Single esbuild bundle (`dist/extension.js`), `@vscode/test-electron` with mocha for integration tests, vsce for packaging. The skeleton in `src/extension.ts` already implements R1.

## Test strategy

One integration test asserting the command is registered.
