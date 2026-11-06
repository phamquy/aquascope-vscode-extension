// The HTML of the Aquascope panel (feature 004, R2, R6, R9, R10). Everything it loads comes from the
// extension's `media/` folder; the data reaches the embed through HTML-escaped attributes, so the page
// has no inline script.
import * as vscode from 'vscode';
import type { EmbedInput } from './embedInput';

/** What the panel shows: the analysis, or a message in its place (R5). */
export type PageContent = { kind: 'analysis'; input: EmbedInput } | { kind: 'message'; text: string };

/** URIs of the page's files as the webview sees them, and the webview's own source for the policy. */
export interface PageResources {
  cspSource: string;
  embedScript: string;
  embedStyle: string;
  pageScript: string;
  pageStyle: string;
}

/** The embed's configuration (D3): step tables and boundaries, nothing else. */
export const EMBED_CONFIG = { stepper: true, boundaries: true } as const;

/**
 * The panel's content security policy (R6, D7): scripts and stylesheets only from the webview's own
 * files. The embed needs inline styles, both style elements and style attributes (without them every
 * render reports violations), and its stylesheet uses an SVG filter written as a `data:` image. It
 * loads no fonts and makes no requests, so nothing else is allowed.
 */
export function contentSecurityPolicy(cspSource: string): string {
  return ["default-src 'none'", `script-src ${cspSource}`, `style-src ${cspSource} 'unsafe-inline'`, 'img-src data:'].join('; ');
}

/** The webview URIs of the page's files under `<extension>/media/`. */
export function pageResources(webview: vscode.Webview, extensionUri: vscode.Uri): PageResources {
  const media = (...parts: string[]) => webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', ...parts)).toString();
  return {
    cspSource: webview.cspSource,
    embedScript: media('aquascope-embed', 'embed.iife.js'),
    embedStyle: media('aquascope-embed', 'style.css'),
    pageScript: media('panel.js'),
    pageStyle: media('panel.css'),
  };
}

/**
 * The full page. `renderId` identifies this version of the page in the report that `media/panel.js`
 * posts back once it has drawn (R10). A message page does not load the embed.
 */
export function panelPage(content: PageContent, res: PageResources, renderId: number): string {
  const json = (value: unknown) => attr(JSON.stringify(value));
  const body =
    content.kind === 'analysis'
      ? `<div class="aquascope-embed" data-code="${json(content.input.code)}" data-operations="${json(['permissions'])}"` +
        ` data-responses="${json({ permissions: content.input.response })}" data-config="${json(EMBED_CONFIG)}" data-no-interact="true"></div>`
      : `<p class="aquascope-message">${text(content.text)}</p>`;
  const embedScript = content.kind === 'analysis' ? `\n    <script src="${attr(res.embedScript)}"></script>` : '';
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${attr(contentSecurityPolicy(res.cspSource))}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${attr(res.embedStyle)}">
    <link rel="stylesheet" href="${attr(res.pageStyle)}">
  </head>
  <body data-render-id="${renderId}" data-kind="${content.kind}">
    ${body}
    <script src="${attr(res.pageScript)}"></script>${embedScript}
  </body>
</html>
`;
}

function text(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function attr(s: string): string {
  return text(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
