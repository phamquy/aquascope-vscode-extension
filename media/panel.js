// Runs in the Aquascope panel, before the embed (feature 004, R10). It reports what the page shows to
// the extension, which is the only way tests can see inside a webview, together with any content
// security policy violation or script error, which is how Q1 was settled.
(function () {
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
    window.addEventListener('load', () => vscode.postMessage({ type: 'message', renderId, text, problems }));
    return;
  }

  // Read before the embed starts: it renames the element's class once it has taken the data.
  const code = JSON.parse(document.querySelector('.aquascope-embed').dataset.code);
  const counts = () => ({
    // One per entry in the result's steps; React fills them in shortly after the embed starts.
    stepWidgets: document.querySelectorAll('.perm-step-widget').length,
    // One per distinct boundary location.
    boundaryMarkers: document.querySelectorAll('.permission-stack').length,
  });

  // The embed draws on the same load event, after this listener; wait until the counts stop changing.
  window.addEventListener('load', () => {
    let last = '';
    let unchanged = 0;
    let checks = 0;
    const check = () => {
      const now = counts();
      const key = JSON.stringify(now);
      unchanged = key === last ? unchanged + 1 : 0;
      last = key;
      checks += 1;
      if (unchanged >= 5 || checks >= 100) {
        vscode.postMessage({ type: 'rendered', renderId, code, ...now, problems });
      } else {
        setTimeout(check, 30);
      }
    };
    setTimeout(check, 0);
  });
})();
