#!/usr/bin/env python3
"""Writes media/aquascope-embed/THIRD-PARTY-NOTICES (feature 005, R7).

    python3 scripts/embed-notices.py [path to Aquascope checkout]

`embed.iife.js` bundles the npm packages that Aquascope's frontend imports at run time, plus its own
copy of Leader Line. This finds those packages and their runtime dependencies at the exact versions in
the pinned frontend's `pnpm-lock.yaml`, fetches each with `npm pack`, and copies its licence files
into the notice. Needs PyYAML, npm and the network. Rerun after every Aquascope upgrade, together
with scripts/vendor-aquascope-embed.sh.
"""
import json
import os
import re
import subprocess
import sys
import tarfile
import tempfile

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHECKOUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'spikes/002-toolchain-bundling/work/src/aquascope')
FRONTEND = os.path.join(CHECKOUT, 'frontend')
OUT = os.path.join(ROOT, 'media/aquascope-embed/THIRD-PARTY-NOTICES')

# The packages the embed and editor sources import at run time (not build tools or type definitions).
RUNTIME_IMPORTS = [
    '@codemirror/commands', '@codemirror/lang-rust', '@codemirror/language', '@codemirror/state', '@codemirror/view',
    '@floating-ui/react-dom', '@fortawesome/fontawesome-svg-core', '@fortawesome/free-solid-svg-icons',
    '@lezer/highlight', 'classnames', 'lodash', 'react', 'react-dom',
]
LICENCE_NAMES = ('license', 'licence', 'copying', 'notice')


def closure(lock):
    """The runtime packages, as (name, version), reachable from RUNTIME_IMPORTS in the lockfile."""
    resolved = {}
    for importer in ('packages/aquascope-editor', 'packages/aquascope-embed'):
        for section in ('dependencies', 'devDependencies'):
            for name, entry in (lock['importers'][importer].get(section) or {}).items():
                if name in RUNTIME_IMPORTS:
                    resolved.setdefault(name, entry['version'])
    missing = sorted(set(RUNTIME_IMPORTS) - set(resolved))
    if missing:
        sys.exit(f'not in the lockfile: {", ".join(missing)}')
    seen, stack = {}, list(resolved.items())
    while stack:
        name, version = stack.pop()
        key = f'{name}@{version}'
        if key in seen:
            continue
        seen[key] = (name, version.split('(')[0])  # drop pnpm's peer-dependency suffix
        snapshot = lock['snapshots'].get(key) or {}
        for dep in ('dependencies', 'optionalDependencies'):
            stack.extend((snapshot.get(dep) or {}).items())
    return sorted(set(seen.values()))


def licence_of(name, version, workdir):
    """The package's declared licence and the texts of its licence files, from its published tarball."""
    out = subprocess.run(['npm', 'pack', f'{name}@{version}', '--json', '--pack-destination', workdir],
                         check=True, capture_output=True, text=True).stdout
    tarball = os.path.join(workdir, json.loads(out)[0]['filename'])
    texts, declared = [], ''
    with tarfile.open(tarball) as tar:
        for member in sorted(tar.getmembers(), key=lambda m: m.name):
            base = os.path.basename(member.name)
            if member.name.count('/') != 1 or not member.isfile():
                continue  # only files at the package root
            if base == 'package.json':
                declared = json.load(tar.extractfile(member)).get('license', '')
            elif base.lower().startswith(LICENCE_NAMES):
                texts.append((base, tar.extractfile(member).read().decode('utf-8', 'replace').strip()))
    return declared, texts


MIT_TEXT = """Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE."""


def leader_line():
    """Leader Line is vendored in Aquascope's frontend; its source header names the copyright holder and the
    MIT licence, whose text follows it here."""
    path = os.path.join(FRONTEND, 'packages/leader-line/src/leader-line.js')
    header = []
    for line in open(path):
        if not re.match(r'\s*(/\*|\*)', line):
            break
        text = re.sub(r'^\s*/?\*+/?\s?', '', line.rstrip()).strip()
        if text and text != '/':
            header.append(text)
    return '\n'.join(header) + '\n\n--- MIT licence text ---\n' + MIT_TEXT


def main():
    lock = yaml.safe_load(open(os.path.join(FRONTEND, 'pnpm-lock.yaml')))
    packages = closure(lock)
    sections, without_text = [], []
    with tempfile.TemporaryDirectory() as workdir:
        for name, version in packages:
            declared, texts = licence_of(name, version, workdir)
            body = '\n\n'.join(f'--- {file} ---\n{text}' for file, text in texts) if texts else ''
            if not texts:
                without_text.append(f'{name}@{version}')
                body = f'The package includes no licence file; its package.json declares the licence "{declared}".'
            sections.append(f'{name} {version} (licence: {declared})\n\n{body}')
    sections.append('Leader Line, as vendored in Aquascope\'s frontend (frontend/packages/leader-line)\n\n' + leader_line())
    head = (
        'Third-party notices for embed.iife.js\n\n'
        'embed.iife.js, Aquascope\'s built frontend (see README.md), bundles the following libraries. '
        'Each entry gives the version from the pinned frontend\'s pnpm-lock.yaml and the licence files '
        'published with that version. React DOM includes a function derived from Modernizr, under the '
        'MIT licence, as marked in the bundle. Generated by scripts/embed-notices.py; do not edit.'
    )
    sep = '\n\n' + '=' * 78 + '\n\n'
    with open(OUT, 'w') as f:
        f.write(head + sep + sep.join(sections) + '\n')
    print(f'wrote {OUT}: {len(packages)} packages and Leader Line')
    if without_text:
        print('no licence file in: ' + ', '.join(without_text))


if __name__ == '__main__':
    main()
