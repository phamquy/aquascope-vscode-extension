---
id: T-038
title: "Ship the Miri-built standard library in the bundle"
status: todo
priority: medium
feature: "007-stack-heap-diagrams"
created: 2026-11-08
---

# T-038 Ship the Miri-built standard library in the bundle

Spec: [[specs/features/007-stack-heap-diagrams/spec.md]]

## Done when

- [ ] `npm run package` builds the library into `build/bundle/miri-sysroot` and the VSIX
- [ ] `check-vsix.mjs` verifies it and uses ADR 0003's size cap
- [ ] The bundle has no symbolic links and the interpreter runs the probe programs against the packaged bundle
- [ ] `npm run dev-bundle` provides a development copy
- [ ] The VSIX size is recorded (R3, R6, AC7)
- [ ] `npm run typecheck && npm run lint && npm test` pass

## Notes

- Plan: [[specs/features/007-stack-heap-diagrams/plan.md]]. Depends on T-037. The build stage already installs `-c miri -c rust-src` (`scripts/package-platform.sh:60`).
