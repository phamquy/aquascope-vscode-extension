# Constitution

Principles that every spec, plan and change must respect. Amend only through an ADR.

1. Spec before code: no feature work without an approved `spec.md`.
2. Small, verifiable steps: each task fits in one reviewable change and has an explicit done check.
3. Fast activation and no blocking the extension host: heavy work is lazy or off-thread.
4. Everything user-facing is configurable via `contributes.configuration` and documented.
5. Tests prove behavior: new commands and providers get an integration test.
6. No telemetry or network calls without an explicit, documented opt-in.
