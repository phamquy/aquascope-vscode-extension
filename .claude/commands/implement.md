---
description: Implement one task from the vault
argument-hint: <task id, e.g. T-003>
---
Update `main` (`git switch main && git pull`) and create a branch `task/$ARGUMENTS-<slug of the task title>`. Open the note in `vault/tasks/` for $ARGUMENTS, set `status: doing`, read its feature's spec and plan, implement only that task, run `npm run typecheck && npm run lint && npm test`, then set `status: review` and tick the box in the feature's `tasks.md`. Commit everything as one commit whose subject ends with `($ARGUMENTS)`, push, and open a pull request into `main` with `gh pr create`. Report the PR link and anything that diverged from the spec. When the user approves, set `status: done` on the branch, push, and merge with `gh pr merge --squash --delete-branch`.
