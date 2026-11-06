---
feature: 002-toolchain-bundling-spike
---

# Tasks

Each line maps to a note in `vault/tasks/`. Status lives in the note, not here.

- [x] T-004 Pin the Aquascope tag and nightly (done when: tag and nightly recorded with the reason)
- [x] T-005 Build cargo-aquascope and record its runtime dependencies (done when: binaries built, sizes and linked libraries recorded; needs your approval)
- [x] T-006 Create fixtures and baseline run with full toolchain (done when: fixtures committed and baseline JSON saved)
- [x] T-007 Run against a minimal toolchain in a scrubbed environment (done when: JSON matches baseline or each failure is explained; Q1, Q2)
- [x] T-008 Test a crate with dependencies online and offline (done when: network needs recorded; Q5)
- [x] T-009 Measure bundle size (done when: unpacked and compressed sizes and file list recorded; Q3)
- [x] T-010 Assess platform support (done when: each target platform assessed; Q4)
- [x] T-011 Assess frontend build and Marketplace limits (done when: vendoring path and size limit recorded with sources; Q6, Q7)
- [x] T-012 Write findings and update ADR 0002 and product.md (done when: findings doc has a verdict and all spec acceptance criteria are ticked)

T-004 to T-009 run in order. T-010 and T-011 are independent research and can run any time. T-012 comes last.
