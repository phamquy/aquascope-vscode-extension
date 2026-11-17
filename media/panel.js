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

  if (document.body.dataset.kind === 'trace') {
    // Feature 007: one memory diagram and one step marker in the code per drawn step, and a red marker for
    // a step that reached undefined behaviour. The notes above the diagram are reported with them.
    const steps = Number(embed.dataset.steps);
    const notes = [...document.querySelectorAll('.aquascope-note')].map((n) => n.textContent);
    const counts = () => ({
      steps: document.querySelectorAll('.interpreter .step').length,
      markers: document.querySelectorAll('.cm-editor .step-marker').length,
      failed: document.querySelectorAll('.step-header .step-marker.fail').length,
    });
    // The embed draws the arrows of pointers once the diagrams are on the page, and an error there removes
    // every diagram (issue #83), so the report waits for the arrows and counts the diagrams again.
    reportWhenDrawn(counts, (now) => now.steps === steps && now.markers === steps, () => ({ type: 'trace', notes }), 300);
    return;
  }

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
  reportWhenDrawn(
    counts,
    (now) => now.stepWidgets === expected.stepWidgets && now.boundaryMarkers === expected.boundaryMarkers,
    () => ({ type: 'rendered' }),
  );

  // The embed draws on load, and React fills in the widgets shortly after, so report as soon as the page
  // holds what it should. Timers are throttled to about one a second while the window is in the
  // background, so the timer only bounds a page that never matches, and then reports what it has. With
  // `settleMs`, the report is sent that long after the page first matches, with the counts it has then.
  function reportWhenDrawn(counts, drawn, fields, settleMs = 0) {
    let sent = false;
    let fallback;
    let settling;
    const observer = new MutationObserver(() => {
      if (!drawn(counts())) return;
      if (settleMs === 0) send();
      else settling ??= setTimeout(send, settleMs);
    });
    const send = () => {
      if (sent) return;
      sent = true;
      observer.disconnect();
      clearTimeout(fallback);
      clearTimeout(settling);
      vscode.postMessage({ ...fields(), renderId, code, ...counts(), theme: theme(), problems });
    };
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', () => {
      fallback = setTimeout(send, 3000);
    });
  }
})();
