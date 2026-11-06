---
id: T-025
title: "Build the panel page and settle Q1"
status: review
priority: medium
feature: "004-render-visualization-webview"
created: 2026-11-06
---

# T-025 Build the panel page and settle Q1

Spec: [[specs/features/004-render-visualization-webview/spec.md]]

## Done when

- [x] unit tests cover the page's policy, attributes and escaping, a test renders captured fixture 05 in a real webview and receives a report with its code, step widgets, boundary markers and no policy violations, the counted class names are confirmed against the vendored build, and Q1 is a decision in the spec; R2, R6, R9, R10

## Notes

- `src/visualization/page.ts`: `panelPage(content, resources, renderId)` builds the page for an analysis (the `.aquascope-embed` element with HTML-escaped `data-code`, `data-operations`, `data-responses`, the D3 config and `data-no-interact`) or for a message (no embed loaded); `pageResources(webview, extensionUri)` gives the webview URIs; `contentSecurityPolicy(cspSource)` the policy. No inline script.
- `media/panel.js`: records `securitypolicyviolation` events, script errors and unhandled rejections from the start; reads the code before the embed renames its element; after load, polls every 30 ms until the counts of `.perm-step-widget` and `.permission-stack` are unchanged five times (capped at 100 checks), then posts `{type: 'rendered', renderId, code, stepWidgets, boundaryMarkers, problems}`; message pages post `{type: 'message', renderId, text, problems}`. A trace showed the step widgets appear one check after the boundaries (React fills them asynchronously), which is why it waits for stable counts.
- `media/panel.css`: minimal for now; T-027 adds the theme.
- Q1, settled (spec D7): four captured results (05 `main` and `grow`, the `n2` closure, the `n1` emoji line) render with no violation or error and the expected counts. Removing `'unsafe-inline'` makes every render report `style-src-elem` and `style-src-attr` violations, so it is required and the detector is shown to work. Removing `font-src` and `img-src` changed nothing; the stylesheet declares no fonts and uses one `data:` SVG filter, so the policy keeps `img-src data:` only. The embed's one `fetch` is its server call, unreachable with `data-no-interact` and blocked by the policy.
- Class names confirmed in the vendored build: `perm-step-widget`, `permission-stack` (counts equal `steps.length` and the distinct boundary locations).
- One render took 4.6 s once; two reruns took about 0.2 s, so it was a one-off (likely the first emoji font load), not the page.
- R9: `dist/extension.js` is still 22 KB and contains none of the embed.
- `src/test/suite/page.test.ts`: 4 unit tests and 5 real-webview tests; 81 passing in total.

