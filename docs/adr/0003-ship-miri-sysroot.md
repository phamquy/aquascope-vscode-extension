# 0003. Ship a Miri-built standard library in the VSIX

- Status: accepted
- Date: 2026-11-08

## Context

Feature 007 draws Aquascope's stack-and-heap diagrams, which come from Aquascope's interpreter. The interpreter runs the program in Miri, and Miri needs a copy of the standard library compiled with full MIR (a "Miri sysroot"). The toolchain that ADR 0002 bundles has only the ordinary standard library, so the interpreter fails with it. A Miri sysroot for the pinned nightly takes 14 seconds to build with `cargo miri setup`, and it is 193 MB unpacked and 61 MB compressed. Shipping it takes the darwin-arm64 VSIX from about 125 MB to about 185 MB. The package check from feature 005 rejects anything over 150 MB.

ADR 0002 already noted that the VS Code Marketplace's package size limit is undocumented. For this decision we looked again on 2026-11-08 and still found no stated limit. Appendix A lists what we checked. We could settle the question only by test-publishing a package of this size, which needs the Marketplace publisher and would put a throwaway extension on the Marketplace for a while. The extension is installed from VSIX files today and is not yet on the Marketplace, so the owner decided not to run that test now.

## Decision

The VSIX ships the Miri sysroot, as the folder `miri-sysroot/` beside `bin/` and `toolchain/` in the bundle. The packaging script builds it with `cargo +<pinned nightly> miri setup`, with `MIRI_SYSROOT` pointing into the bundle. The interpreter finds it through `MIRI_SYSROOT`, so nothing is built or downloaded on the user's machine and the extension stays zero-install and offline (constitution 6).

The package check's size cap rises from 150 MB to 200 MB. That leaves room above the expected 185 MB and still catches an accidental doubling.

The Marketplace limit stays unverified. The first publish to the Marketplace is the check. If the Marketplace rejects a package of this size, the sysroot moves out of the VSIX, to the first of the alternatives below that fits.

Alternatives considered:

- **Build the sysroot on the user's machine on first use.** This keeps the VSIX at about 125 MB, but it means shipping the standard library's source code and Miri's build tool and a wait of about 15 seconds on first use, and the build may need the network.
- **Download a prebuilt sysroot on first use.** This also keeps the VSIX small, but it needs the network, a hosted download and a checksummed download path.
- **A companion extension that carries only the sysroot.** The main package stays small, but users have to install a second extension, and the two have to be released in step.

## Consequences

- Every platform package grows by about 60 MB compressed. Each upgrade of the Aquascope pin or the nightly also means rebuilding the sysroot, which the packaging script does on every run.
- The packaging build needs `miri` and `rust-src` from the pinned nightly, which its build stage already installs. It also needs the network while `cargo miri setup` fetches the standard library's dependencies.
- The risk ADR 0002 left open grows from a 120 MB package to a 185 MB one. It is now resolved by the first Marketplace publish, not before packaging work. `specs/product.md` lists it under risks.
- If that publish fails on size, the extension can still be installed from VSIX files as it is today, while the sysroot moves out of the package.

## Appendix A: what was checked on 2026-11-08

| Source | What it says |
| --- | --- |
| [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) | No package size limit. The only stated publishing limit is at most 30 `keywords` |
| [vscode-vsce issue 815](https://github.com/microsoft/vscode-vsce/issues/815) | A Marketplace limit on tags, added in January 2023 and lifted in November 2024; nothing on size |
| [Azure DevOps: publish an extension](https://learn.microsoft.com/azure/devops/extend/publish/overview) | Advises optimising packages over 50 MB; applies to Azure DevOps extensions, not VS Code's |
| [Reducing a VSIX file size](https://blog.clydedsouza.net/posts/reducing-a-visual-studio-extension-file-size) | Rejections against a 20 MB cap, for Visual Studio and Azure DevOps extensions |
| [konveyor/editor-extensions issue 1494](https://github.com/konveyor/editor-extensions/issues/1494), [open-vsx.org issue 2300](https://github.com/EclipseFdn/open-vsx.org/issues/2300) | Open VSX, a different registry: a 351 MB VSIX rejected against a 250 MB limit, and a 512 MB server default |
| Feature 007 spec, Appendix A | The sysroot's size and build time, and the interpreter failing without it |
