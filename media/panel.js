// Runs in the Aquascope panel, before the embed (feature 004). It follows VS Code's theme (R7), and it
// reports what the page shows to the extension, which is the only way tests can see inside a webview,
// together with any content security policy violation or script error, which is how Q1 was settled (R10).
(function () {
  // The embed's light and dark variants hang off mdBook's theme classes on the root element; VS Code
  // marks its theme on the body, and changes that class when the user switches theme.
  const theme = () => {
    const body = document.body.classList;
    const dark = body.contains('vscode-dark') || (body.contains('vscode-high-contrast') && !body.contains('vscode-high-contrast-light'));
    document.documentElement.classList.toggle('coal', dark);
    document.documentElement.classList.toggle('light', !dark);
    return dark ? 'dark' : 'light';
  };
  theme();
  new MutationObserver(theme).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  const vscode = acquireVsCodeApi();
  const renderId = Number(document.body.dataset.renderId);
  const problems = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    problems.push(`blocked by ${e.effectiveDirective}: ${e.blockedURI || 'inline'}`);
  });
  window.addEventListener('error', (e) => problems.push(`error: ${e.message}`));
  window.addEventListener('unhandledrejection', (e) => problems.push(`unhandled rejection: ${e.reason}`));

  if (document.body.dataset.kind === 'message') {
    const text = document.querySelector('.aquascope-message')?.textContent ?? '';
    window.addEventListener('load', () => vscode.postMessage({ type: 'message', renderId, text, theme: theme(), problems }));
    return;
  }

  // Read before the embed starts: it renames the element's class once it has taken the data.
  const embed = document.querySelector('.aquascope-embed');
  const code = JSON.parse(embed.dataset.code);
  const [entry] = JSON.parse(embed.dataset.responses).permissions;
  // What the embed should draw: one step widget per step, and one marker per distinct boundary location.
  const expected = entry.Ok
    ? {
        stepWidgets: entry.Ok.steps.length,
        boundaryMarkers: new Set(entry.Ok.boundaries.map((b) => `${b.location.line}:${b.location.column}`)).size,
      }
    : { stepWidgets: 0, boundaryMarkers: 0 };
  const counts = () => ({
    stepWidgets: document.querySelectorAll('.perm-step-widget').length,
    boundaryMarkers: document.querySelectorAll('.permission-stack').length,
  });

  // The embed draws on load, and React fills in the step widgets shortly after, so report as soon as the
  // page holds what it should. Timers are throttled to about one a second while the window is in the
  // background, so the timer only bounds a page that never matches, and then reports what it has.
  let sent = false;
  let fallback;
  const observer = new MutationObserver(() => {
    const now = counts();
    if (now.stepWidgets === expected.stepWidgets && now.boundaryMarkers === expected.boundaryMarkers) send();
  });
  const send = () => {
    if (sent) return;
    sent = true;
    observer.disconnect();
    clearTimeout(fallback);
    vscode.postMessage({ type: 'rendered', renderId, code, ...counts(), theme: theme(), problems });
  };
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', () => {
    fallback = setTimeout(send, 3000);
  });
})();
