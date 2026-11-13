---
feature: 010-stepper-early-exits
---

# Tasks

Each line maps to a note in `vault/tasks/`. Status lives in the note, not here.

- [x] T-062 Step branches whose arms diverge (done when: the fork takes a branch's join point from its continuing arms when some arms have type `!`, with snapshot tests for each shape of spec Appendix B cases 1 to 7 checked by hand, unchanged existing snapshots, and analysis tests pinning `remove_rec` and `break` in a `loop` as boundaries-only; tag `v0.4.0-vscode.7` is pushed; the pin, development bundle, bindings and ADR 0004 follow; end-to-end tests show steps for `next` and `Config::parse` and none for `remove_rec`; AC1 to AC7)
- [ ] T-063 Step `let … else` (done when: the fork opens a branch for a `let … else` whose `else` diverges, with a snapshot test checked by hand; tag `v0.4.0-vscode.8` is pushed; the pin, bundle, bindings and ADR 0004 follow; an end-to-end test on a new fixture shows its steps; AC8; spec 010 is `implemented`)

T-062 comes first: T-063 reuses its join-point code. #68, the crash on a plain `loop` with `break`, is fixed outside this feature (D4).
