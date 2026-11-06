---
id: T-014
title: "Generate and vendor Aquascope result types"
status: done
priority: medium
feature: "003-run-analysis-at-cursor"
created: 2026-11-06
---

# T-014 Generate and vendor Aquascope result types

Spec: [[specs/features/003-run-analysis-at-cursor/spec.md]]

## Done when

- [x] TypeScript types generated from the pinned Aquascope checkout are vendored in `src/analysis/bindings/` with a provenance and MIT note, `types.ts` exports `AnalyzeResult`, and `npm run typecheck` passes; needs your approval to run Aquascope's export step

## Notes

Generated on 2026-11-06 with `scripts/export-aquascope-types.sh` (runs Aquascope's `export-ts` binary and its 35 ts-rs export tests in the pinned checkout, then copies `crates/aquascope/bindings/*.ts`). 38 files, including the interpreter types this feature does not use; kept whole so a rerun reproduces the folder exactly. The generated folder is excluded from eslint.

`src/analysis/types.ts` re-exports `AnalysisOutput`, `AquascopeError`, `CharPos`, `CharRange` and defines `AquascopeEntry`, `AnalyzeErrorCode` and `AnalyzeResult`. Note for T-020/T-021: `AquascopeError` is `BuildError { range: CharRange | null }` or `AnalysisError { msg }`.

Running the script needed a permission rule in `.claude/settings.local.json` (the auto-mode classifier blocks building external code).

