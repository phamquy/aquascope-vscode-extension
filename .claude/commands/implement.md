---
description: Implement one task from the vault
argument-hint: <task id, e.g. T-003>
---
Open the note in `vault/tasks/` for $ARGUMENTS, set `status: doing`, read its feature's spec and plan, implement only that task, run `npm run typecheck && npm run lint && npm test`, then set `status: review` and tick the box in the feature's `tasks.md`. Report anything that diverged from the spec.
