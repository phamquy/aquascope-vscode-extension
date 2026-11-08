"""Summarises probe.sh's results: one line per program with exit code, time, output size, what the
interpreter returned, the step count, the trace's result, the lines the steps sit on, and the compiler
error codes when there was no trace."""
import json
import sys
from pathlib import Path

results = Path(sys.argv[1])
rows = [line.split('\t') for line in (results / 'summary.tsv').read_text().splitlines()]
print(f"{'program':28} {'exit':>4} {'ms':>6} {'bytes':>9}  returned")
for name, code, ms, size in rows:
    out = (results / f'{name}.json').read_text().strip()
    try:
        data = json.loads(out) if out else None
    except json.JSONDecodeError:
        data = 'unparsable'
    if data is None:
        what = 'no output'
    elif data == 'unparsable':
        what = 'unparsable output'
    elif 'Ok' in data:
        trace = data['Ok']
        steps = trace['steps']
        result = trace['result']
        res = result['type'] if result['type'] == 'Success' else f"Error {json.dumps(result['value'])}"
        lines = [s['stack']['frames'][-1]['location']['start']['line'] + 1 for s in steps]
        frames = max((len(s['stack']['frames']) for s in steps), default=0)
        shown = lines if len(lines) <= 12 else lines[:6] + ['…'] + lines[-3:]
        what = f"Ok, {len(steps)} steps, result {res}, deepest stack {frames}, lines {shown}"
    else:
        what = f"Err {json.dumps(data['Err'])}"
    check = results / f'{name}.check.jsonl'
    if check.exists():
        codes = []
        for line in check.read_text().splitlines():
            msg = json.loads(line)
            if msg.get('reason') == 'compiler-message' and msg['message'].get('level') == 'error':
                code_ = msg['message'].get('code')
                codes.append(code_['code'] if code_ else 'no code')
        what += f"; cargo check errors: {codes or 'none'}"
    log = (results / f'{name}.log').read_text()
    for marker in ('panicked', 'timed out', 'Undefined Behavior', 'unsupported operation'):
        if marker in log:
            what += f"; stderr mentions '{marker}'"
    print(f'{name:28} {code:>4} {ms:>6} {size:>9}  {what}')
