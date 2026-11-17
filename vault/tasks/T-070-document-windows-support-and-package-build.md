---
id: T-070
title: "Document Windows support and package build"
status: done
priority: medium
feature: "012-windows-support"
created: 2026-11-16
---

# T-070 Document Windows support and package build

Spec: [[specs/features/012-windows-support/spec.md]]

## Done when

- [x] README and development guide document the verified Windows versions, VSIX installation, native package build prerequisites and steps.
- [x] Windows linker requirements and any confirmed Miri or runtime limitations are documented, and product constraints and the feature index reflect verified support.

## Notes

README requirements, DEVELOPMENT.md package build and product.md constraints now state the Windows facts measured in T-066 to T-069: Windows 11 x64 verified and Windows 10 untested, `x86_64-pc-windows-msvc`, Visual Studio 2022 C++ tools for `link.exe`, Git for Windows Bash for `npm run package`, `VCRUNTIME140.dll` not bundled, the 260-character linker path limit, the `cc` wording of the linker message, and the package size (about 160 MB, 505 MB unpacked). The feature index row for 012 stays `approved` until T-071 publishes the release.
