ship — independent source and affected-control visual review; no confirmed regression.

Reviewed the sole product diff in `src/components/layout/AppShell.tsx`, surrounding shell logic and route configuration. Read `AGENTS.md`, Unslop, Hallmark and Hallmark's finish-review prompt. Scope is the authorized homepage-only removal in the existing Warm Hall app, with no redesign.

- Home: `atHome` checks React Router's `location.pathname === '/'`, so the button is absent on `/` and on home with any query string, regardless of scroll position. Hash-router home queries retain pathname `/`.
- Other routes: `!atHome` is true, leaving the prior `showTop && !examActive` gate, scroll threshold, accessible label, click behavior and reduced-motion handling intact.
- Exam mode: `!examActive` remains mandatory on every route; source behavior is preserved.
- Scope: one conditional expression changed. No CSS, content, backend or additional product files changed.

Personally viewed the scrolled native-viewport screenshots `chromium-home.png`, `chromium-recipes.png`, `webkit-home.png` and `webkit-recipes.png` in `/workspace/bfstaff-home-top-evidence`. Home has no floating scroll-to-top control in both engines. Recipes retain the bottom-right control with a clearly visible focus outline in both engines; the supplied screenshots show no new clipping, horizontal overflow or visual layout regression. Existing Warm Hall presentation is preserved. No visual finding is owed for this change.

Read `results.json`: all ten recorded browser cases pass across actual Chromium and Linux WebKit, covering scrolled home, home query parameters, accessible working recipes scroll-to-top, working article scroll-to-top and return-home removal. These recorded interaction outcomes supplement my own screenshot inspection; I did not personally rerun the browser script.

Preserve the existing non-home scroll-to-top control and exam suppression.

Limitations: these are mobile viewport screenshots using long-content fixture transport. Linux WebKit is not a physical Safari/device check. Exam suppression was checked in source, not through a newly observed exam interaction. The real Hallmark checker and wider build/unit/e2e results are maintained by the implementing agent; this review does not independently claim their outcomes.
