#!/usr/bin/env node
// Entry point of `npm run package` (features 005 and 012): runs scripts/package-platform.sh with a Bash.
//
//   npm run package [-- bundle]
//
// On macOS and Linux that is the `bash` on PATH. On Windows, `bash` on PATH may be the WSL launcher, which
// cannot build a Windows package, so the Bash that ships with Git for Windows is used instead: the one
// named by AQUASCOPE_BASH, else the one beside the `git` on PATH. Arguments are passed to the script.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'package-platform.sh');

function gitBash() {
  if (process.env.AQUASCOPE_BASH) return process.env.AQUASCOPE_BASH;
  const git = spawnSync('git', ['--exec-path'], { encoding: 'utf8' });
  if (git.status === 0) {
    // <Git for Windows>/mingw64/libexec/git-core, and the Bash is at <Git for Windows>/bin/bash.exe.
    const bash = path.resolve(git.stdout.trim(), '..', '..', '..', 'bin', 'bash.exe');
    if (existsSync(bash)) return bash;
  }
  console.error('package: Git for Windows\' Bash was not found; install Git for Windows or set AQUASCOPE_BASH to its bash.exe');
  process.exit(1);
}

const bash = process.platform === 'win32' ? gitBash() : 'bash';
const result = spawnSync(bash, [script, ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) {
  console.error(`package: could not run ${bash}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
