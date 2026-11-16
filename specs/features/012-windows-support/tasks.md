---
feature: 012-windows-support
---

# Tasks

Each line maps to a note in `vault/tasks/`. Status lives in the note, not here.

- [x] T-066 Probe pinned Windows Aquascope and Miri compatibility (done when: the pinned toolchain builds on a native Windows x64 host, the permissions and interpreter fixtures run with the candidate bundle, and the supported OS, Rust host triple, packaging environment, and measured bundle size are recorded; if a requirement cannot be met, revise the spec and get approval before implementation)
- [x] T-067 Build the Windows toolchain bundle (done when: `npm run package` can assemble the pinned Windows binaries, toolchain, Miri sysroot and required licences into the staging layout on the supported Windows host without changing the existing macOS package behavior; depends on T-066)
- [x] T-068 Validate win32-x64 VSIX contents (done when: the package checker validates the Windows target, required executables and DLLs, Miri libraries, licences, size limit and absence of build-machine paths, and rejects deliberately incomplete or wrong-target packages; depends on T-067)
- [ ] T-069 Test Windows runtime and installation (done when: focused Windows path and process-tree tests pass, the complete suite passes strictly against the Windows bundle, and both views work from an installed VSIX on a clean supported Windows profile without Rust or network access; depends on T-068)
- [ ] T-070 Document Windows support and package build (done when: README, development guide and product constraints state the verified Windows versions, installation and build steps, linker requirements and any measured limitations; depends on T-066 and T-069)
- [ ] T-071 Prepare and publish the Windows release (done when: a new version's Windows VSIX passes the package check, is attached to the matching GitHub release, and the existing release workflow publishes it to the Marketplace; depends on T-068, T-069 and T-070)

T-066 has no prerequisites. T-067 depends on T-066. T-068 depends on T-067. T-069 depends on T-068. T-070 depends on T-066 and T-069. T-071 depends on T-068, T-069 and T-070.
