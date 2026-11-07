# Paths inside the bundled toolchain, shared by the packaging script and the VSIX check (feature 005,
# R4 and plan Appendix C). Sourced with $host set to the rustup host triple. Patterns are relative to
# the toolchain folder and may contain globs.

# Removed after copying: tools that `cargo check` never uses on darwin-arm64 (spike 002, measure-bundle.sh).
TRIM=(
  'share'
  'etc'
  'libexec'
  'bin/rustdoc'
  'bin/rust-gdb'
  'bin/rust-gdbgui'
  'bin/rust-lldb'
  'lib/librustc-nightly_rt.*'
  "lib/rustlib/$host/bin"
)

# Kept from share/ despite the trim: the toolchain's licence files (R4, R7). rust-std ships none; the
# rustc component's files cover the standard library.
KEEP=(
  'share/doc/rust/COPYRIGHT.html'
  'share/doc/rust/COPYRIGHT-library.html'
  'share/doc/rust/licenses'
  'share/doc/cargo/LICENSE-APACHE'
  'share/doc/cargo/LICENSE-MIT'
  'share/doc/cargo/LICENSE-THIRD-PARTY'
)
