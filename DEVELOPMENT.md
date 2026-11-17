# Developing the Aquascope extension

This file is for working on the extension; the [README](README.md) describes it for the people who use it. The extension is built spec-first with AI assistance. [CLAUDE.md](CLAUDE.md) describes the workflow, from spec to plan to tasks to implementation, `specs/` holds what is being built and why, `docs/adr/` records the design decisions, and `vault/` is the task board, which opens in Obsidian.

## Getting started

```sh
npm install
npm run compile
# press F5 in VS Code
```

Before marking a task done, run `npm run typecheck && npm run lint && npm test`.

### A toolchain bundle for development

For development without a package, build a development bundle from spike 002's output with `npm run dev-bundle` and set `aquascope.toolchainPath` to the folder it prints. The first run also builds the standard library that Aquascope's interpreter needs, which takes about 15 seconds and needs rustup's pinned nightly with the `miri` and `rust-src` components; without them the bundle serves the permissions view only. `npm test` finds that bundle on its own.

## Building a package

`npm run package` builds the VSIX for the machine it runs on: darwin-arm64 on a Mac with Apple silicon, and win32-x64 on 64-bit Windows. A package is built on a machine of its own platform. It needs rustup, git, Node and npm, a C linker, and the network while it builds.

On Windows (feature 012) it needs, besides those:

- the 64-bit Windows 11 host the package was verified on (a Windows 10 host is untested), with rustup's default host `x86_64-pc-windows-msvc`;
- Visual Studio 2022 or its Build Tools, with the **Desktop development with C++** workload (x64), which provides `link.exe`;
- [Git for Windows](https://git-scm.com/download/win), whose Bash runs the packaging script: `npm run package` starts `scripts/package.mjs`, which uses the Bash beside `git` on PATH, because the `bash` on PATH may be the one from WSL. Set `AQUASCOPE_BASH` to a `bash.exe` to use another.

Run `npm run package` from PowerShell or Git Bash in a checkout whose path is short; the Windows package is about 160 MB (505 MB unpacked). `npm run package -- bundle` stops after the third stage and leaves the bundle in `build/bundle`, which is enough to run the test suite against it with `AQUASCOPE_REQUIRE_TOOLCHAIN=1 AQUASCOPE_TEST_TOOLCHAIN=<repository>/build/bundle npm test`. The test stage on Windows keeps VS Code's test user-data folder under the temporary folder, because the linker's 260-character path limit fails for a build script's output in the repository's own `.vscode-test` folder. The test suite checks out its fixtures with LF line endings (`.gitattributes`), so it needs no `core.autocrlf` setting. It works through five stages and stops with a message if any fails:

1. It checks that the Aquascope checkout in `build/aquascope-src` matches the pin in `spikes/002-toolchain-bundling/pin.env`. After the pin changes, delete that folder so the new tag is cloned.
2. It installs the pinned nightly and builds Aquascope. The pin names a fork of Aquascope with the changes ADR 0004 lists, such as keeping a function's markers when its tables cannot be worked out, and running a program with its arguments and its library.
3. It assembles the trimmed toolchain with its licence files, and the standard library built for Miri, which Aquascope's interpreter needs.
4. It runs the full test suite against exactly that toolchain.
5. It writes `aquascope-vscode-extension-<platform>-<version>.vsix` (`darwin-arm64` or `win32-x64`) at the repository root, checks its contents, including that no file holds your home folder's path, and prints its path and size (about 185 MB).

The first run downloads the nightly and Aquascope's dependencies, about 1 GB, and takes a few minutes; later runs take under a minute. All the work happens in `build/`, which git ignores and which can be deleted at any time to free several GB.

## Publishing to the Marketplace

Pushing a version tag releases the extension. The workflow in `.github/workflows/publish.yml` builds the darwin-arm64 and win32-x64 packages with `npm run package` on GitHub's macOS and Windows runners, so each is built and tested on its own platform, then attaches both to the tag's GitHub release, creating the release if there is none, and publishes them to the VS Code Marketplace under the `psyquy` publisher. To release, merge the new version in `package.json` to `main`, then tag that commit and push the tag: `git tag v<version> origin/main && git push origin v<version>`. A tag that does not match `package.json`'s version stops the run before anything is built. Both packages come from the same commit, so they always carry the same version, and nothing is released or published unless both build and pass their tests. The Marketplace refuses a version it already has, so every release needs a new version; a package already on the Marketplace is skipped, so re-running a run that failed part-way publishes only what is missing.

Running the workflow by hand, from the Actions tab or with `gh workflow run publish.yml --ref <branch>`, is a dry run: it builds and tests both packages and keeps them as the run's artifacts, and releases and publishes nothing. It checks a change to the packaging on both platforms, and it gives a Windows package without a Windows machine. The runners differ from the machines the packages were verified on: the Windows one is Windows Server 2022 with Visual Studio 2022, not Windows 11, and the macOS one is macOS 15. Every run starts from nothing, so it downloads the nightly and builds Aquascope each time.

The workflow signs in with the Marketplace's Trusted Publishing instead of a token. That needs a policy, created once on the `psyquy` publisher's page at marketplace.visualstudio.com/manage under **Trusted Publishing**, naming the repository owner `phamquy`, the repository `aquascope-vscode-extension` and the workflow `publish.yml`, with no environment. Renaming the workflow file breaks the policy.
