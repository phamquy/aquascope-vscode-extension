import * as assert from 'assert';
import * as vscode from 'vscode';
import { selectAtCursor } from '../../analysis/select';
import { embedInput, EmbedInput } from '../../visualization/embedInput';
import { contentSecurityPolicy, EMBED_CONFIG, PageContent, pageResources, panelPage, PageResources, TRACE_CONFIG } from '../../visualization/page';
import { traceInput } from '../../visualization/traceInput';
import { capturedTrace, fixtureData, fixtureText } from './harness';

const EXTENSION_ID = 'psyquy.aquascope-vscode-extension';
const RESOURCES: PageResources = {
  cspSource: 'https://file+.vscode-resource.example',
  embedScript: 'https://res.example/media/aquascope-embed/embed.iife.js',
  embedStyle: 'https://res.example/media/aquascope-embed/style.css',
  pageScript: 'https://res.example/media/panel.js',
  pageStyle: 'https://res.example/media/panel.css',
};

/** The embed input for a cursor in a captured fixture. */
function inputAt(name: string, line: number, character: number): EmbedInput {
  const source = fixtureText(`${name}.rs`);
  const s = selectAtCursor(fixtureData(`${name}.json`), source, { line, character });
  assert.ok(s.kind === 'selected');
  return embedInput(s.output, source);
}

/** The decoded value of a `data-*` attribute in the page. */
function dataAttr(html: string, name: string): string | undefined {
  const raw = new RegExp(`data-${name}="([^"]*)"`).exec(html)?.[1];
  return raw?.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

interface Report {
  type: 'rendered' | 'message';
  renderId: number;
  theme: 'light' | 'dark';
  code?: string;
  text?: string;
  stepWidgets?: number;
  boundaryMarkers?: number;
  problems: string[];
}

/** Shows a page in a real webview, as the panel will, and returns the report its script posts back. */
async function render(content: PageContent): Promise<Report> {
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(ext);
  const panel = vscode.window.createWebviewPanel('aquascope.test', 'Aquascope test', vscode.ViewColumn.One, {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(ext.extensionUri, 'media')],
  });
  try {
    const report = new Promise<Report>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('the page posted no report within 20 s')), 20_000);
      panel.webview.onDidReceiveMessage((m: Report) => {
        clearTimeout(timer);
        resolve(m);
      });
    });
    panel.webview.html = panelPage(content, pageResources(panel.webview, ext.extensionUri), 7);
    return await report;
  } finally {
    panel.dispose();
  }
}

/** The theme the page should follow for VS Code's active colour theme. */
const vscodeTheme = (): 'light' | 'dark' =>
  [vscode.ColorThemeKind.Dark, vscode.ColorThemeKind.HighContrast].includes(vscode.window.activeColorTheme.kind) ? 'dark' : 'light';

/** Switches VS Code's colour theme and waits until it is active. */
async function useColorTheme(name: string | undefined): Promise<void> {
  const changed = new Promise<void>((resolve) => {
    const sub = vscode.window.onDidChangeActiveColorTheme(() => {
      sub.dispose();
      resolve();
    });
    setTimeout(resolve, 3000); // the theme may already be the active one
  });
  await vscode.workspace.getConfiguration('workbench').update('colorTheme', name, vscode.ConfigurationTarget.Global);
  await changed;
}

const distinctBoundaries = (input: EmbedInput): number => {
  const [entry] = input.response;
  assert.ok('Ok' in entry);
  return new Set(entry.Ok.boundaries.map((b) => `${b.location.line}:${b.location.column}`)).size;
};

suite('panel page (004 R2, R6, R10)', () => {
  test("allows only the webview's own files, plus inline styles", () => {
    const csp = contentSecurityPolicy(RESOURCES.cspSource);
    assert.match(csp, /^default-src 'none'; /);
    assert.match(csp, /script-src https:\/\/file\+\.vscode-resource\.example(;|$)/, 'scripts only from the webview source');
    assert.match(csp, /style-src https:\/\/file\+\.vscode-resource\.example 'unsafe-inline'/);
    assert.match(csp, /; img-src data:$/, 'images only as data URIs, for the stylesheet\'s SVG filter');
    assert.doesNotMatch(csp, /unsafe-eval|connect-src|font-src|http:|\*/);
  });

  test('passes the embed its code, response and configuration, read-only', () => {
    const input = inputAt('05_method_mut_borrow', 18, 4);
    const html = panelPage({ kind: 'analysis', input }, RESOURCES, 3);
    assert.strictEqual(JSON.parse(dataAttr(html, 'code') ?? ''), input.code);
    assert.deepStrictEqual(JSON.parse(dataAttr(html, 'responses') ?? ''), { permissions: input.response });
    assert.deepStrictEqual(JSON.parse(dataAttr(html, 'operations') ?? ''), ['permissions']);
    assert.deepStrictEqual(JSON.parse(dataAttr(html, 'config') ?? ''), EMBED_CONFIG);
    assert.strictEqual(dataAttr(html, 'no-interact'), 'true');
    assert.strictEqual(dataAttr(html, 'render-id'), '3');
    const policy = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1];
    assert.strictEqual(policy?.replace(/&#39;/g, "'"), contentSecurityPolicy(RESOURCES.cspSource));
    // Every script is a file; the page has no inline script and no bug reporter.
    assert.deepStrictEqual(html.match(/<script[^>]*>/g), [`<script src="${RESOURCES.pageScript}">`, `<script src="${RESOURCES.embedScript}">`]);
    assert.doesNotMatch(html, /show-bug-reporter|server-url/);
  });

  test('escapes code that contains quotes and markup', () => {
    const input = { ...inputAt('05_method_mut_borrow', 18, 4), code: `let s = "<b>&'x'</b>";` };
    const html = panelPage({ kind: 'analysis', input }, RESOURCES, 1);
    assert.strictEqual(JSON.parse(dataAttr(html, 'code') ?? ''), input.code);
    assert.ok(!html.includes('<b>'));
  });

  test('writes the notes of an analysis above the embed, and none when there are none (feature 011, R1, R3)', () => {
    const input = inputAt('05_method_mut_borrow', 18, 4);
    const without = panelPage({ kind: 'analysis', input: { ...input, notes: [] } }, RESOURCES, 1);
    assert.doesNotMatch(without, /aquascope-note/);
    const html = panelPage({ kind: 'analysis', input: { ...input, notes: ['The step table could not be computed.'] } }, RESOURCES, 1);
    assert.ok(html.includes('<p class="aquascope-note">The step table could not be computed.</p>'));
    assert.ok(html.indexOf('class="aquascope-note"') < html.indexOf('class="aquascope-embed"'), 'the note comes first');
  });

  test('escapes the notes above an analysis (feature 011, AC5)', () => {
    const input = { ...inputAt('05_method_mut_borrow', 18, 4), notes: ['a <b> & "c"'] };
    assert.ok(panelPage({ kind: 'analysis', input }, RESOURCES, 1).includes('<p class="aquascope-note">a &lt;b&gt; &amp; "c"</p>'));
  });

  test('passes a trace to the interpreter view with its step count, notes before the diagram (feature 007 R4)', () => {
    const source = fixtureText('i4_use_after_free.rs');
    const input = traceInput(capturedTrace('i4_use_after_free'), source);
    const html = panelPage({ kind: 'trace', input }, RESOURCES, 3);
    assert.strictEqual(dataAttr(html, 'operations'), '["interpreter"]');
    assert.deepStrictEqual(JSON.parse(dataAttr(html, 'responses') ?? ''), { interpreter: input.response });
    assert.strictEqual(JSON.parse(dataAttr(html, 'code') ?? ''), input.code);
    assert.strictEqual(dataAttr(html, 'config'), JSON.stringify(TRACE_CONFIG));
    assert.strictEqual(dataAttr(html, 'steps'), '4');
    assert.strictEqual(dataAttr(html, 'no-interact'), 'true');
    assert.match(html, /data-kind="trace"/);
    assert.ok(html.indexOf('class="aquascope-note"') < html.indexOf('class="aquascope-embed"'), 'the note comes first');
    assert.ok(html.includes(`<script src="${RESOURCES.embedScript}"></script>`));
  });

  test('escapes the notes above a trace', () => {
    const input = { ...traceInput(capturedTrace('01_move_string'), fixtureText('01_move_string.rs')), notes: ['a <b> & "c"'] };
    assert.ok(panelPage({ kind: 'trace', input }, RESOURCES, 1).includes('<p class="aquascope-note">a &lt;b&gt; &amp; "c"</p>'));
  });

  test('shows a message without loading the embed', () => {
    const html = panelPage({ kind: 'message', text: 'No function at <the> cursor & "here"' }, RESOURCES, 2);
    assert.ok(html.includes('No function at &lt;the&gt; cursor &amp; "here"'));
    assert.ok(!html.includes(RESOURCES.embedScript));
    assert.ok(!html.includes('aquascope-embed"'));
  });
});

suite('panel page in a real webview (004 Q1, R10)', function () {
  this.timeout(60_000);

  // The captured n3_early_return result, from fork tag v0.4.0-vscode.1, has boundaries but no steps (issue #31,
  // ADR 0004); it is kept as a sample of that shape, which the current pin no longer gives for it (feature 010).
  for (const [name, line, character] of [['05_method_mut_borrow', 18, 4], ['05_method_mut_borrow', 8, 8], ['n2_nested', 7, 25], ['n1_non_ascii', 2, 50], ['n3_early_return', 9, 8]] as const) {
    test(`draws ${name} at ${line}:${character} with no policy violation or script error`, async () => {
      const input = inputAt(name, line, character);
      const report = await render({ kind: 'analysis', input });
      assert.deepStrictEqual(report.problems, []);
      assert.strictEqual(report.type, 'rendered');
      assert.strictEqual(report.renderId, 7);
      assert.strictEqual(report.code, input.code);
      const [entry] = input.response;
      assert.ok('Ok' in entry);
      assert.strictEqual(report.stepWidgets, entry.Ok.steps.length, 'one step widget per step');
      assert.strictEqual(report.boundaryMarkers, distinctBoundaries(input), 'one marker per boundary location');
    });
  }

  test('shows a message', async () => {
    const report = await render({ kind: 'message', text: 'There is no function at the cursor.' });
    assert.deepStrictEqual(report, { type: 'message', renderId: 7, text: 'There is no function at the cursor.', theme: vscodeTheme(), problems: [] });
  });

  test("follows VS Code's light and dark themes", async () => {
    const original = vscode.workspace.getConfiguration('workbench').inspect<string>('colorTheme')?.globalValue;
    try {
      for (const [name, expected] of [['Default Light Modern', 'light'], ['Default Dark Modern', 'dark']] as const) {
        await useColorTheme(name);
        assert.strictEqual(vscodeTheme(), expected, `VS Code did not switch to ${name}`);
        const report = await render({ kind: 'analysis', input: inputAt('05_method_mut_borrow', 18, 4) });
        assert.strictEqual(report.theme, expected, name);
        assert.deepStrictEqual(report.problems, []);
      }
    } finally {
      await useColorTheme(original);
    }
  });
});
