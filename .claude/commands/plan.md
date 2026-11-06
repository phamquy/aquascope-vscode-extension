---
description: Write plan.md and tasks.md for an approved spec
argument-hint: <feature folder, e.g. 002-foo>
---
Read `specs/features/$ARGUMENTS/spec.md` (it must be `approved`; stop and say so if not). Write `plan.md` and `tasks.md` from the templates, then create one task note per task with `npm run task -- new "<title>" --feature $ARGUMENTS`.
