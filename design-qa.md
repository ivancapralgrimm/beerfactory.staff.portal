# BFStaff — auth concept fidelity QA

## Target and evidence

- Source visual truth: `qa/r407/evidence/auth-concept/reference.jpg`, supplied concept (640×1280). Supplied separate 1254×1254 emblem is represented by its optimized local asset, `assets/auth/portal-emblem.webp` (896×896), not redrawn.
- Implementation: `login-390-final.png`, `register-390-final.png`, `recovery-390-final.png`, `setup-390-final.png` under the same evidence directory.
- CSS viewport: 390×780, device scale factor 1. Original concept normalized by 390/640 to 390×780 before comparison. Login full-page capture is approximately 390×782; the extra bottom background is expected safe padding, not missing/hidden controls.
- State: login empty fields, name field focused, reduced motion enabled. Register/recovery empty initial forms; no device or browser chrome simulated.
- Full-view comparison: `comparison-1.png`, `comparison-2.png`, final `comparison-final.png`. These are actual paired source + browser images, not separate-view claims.
- Focused form comparison: `comparison-form-final.png`, matching source/implementation crop (16,404)–(374,752). Additional widths: 375,430,768,1280, recorded screenshots.
- Verification used Playwright/Chromium in the cloud executor, existing compiled production app and synthetic transport fixtures. The standalone Product Design browser/Sites workflow and optional referenced override file were unavailable; this is existing-app implementation and browser verification, not a Sites prototype handoff.

## Comparison history / fixes

1. **[P1] Repeated paper crop produced visible vertical bands.** Seen in `comparison-1.png`. Replaced small repeated crop with a uniform generated paper texture; final comparison shows no block seams. No UI elements are rasterized into the page background.
2. **[P2] Display heading was too light and narrow.** Seen in iteration 1. A local official Geist weight900 WOFF instance is now used only for auth headings. Full and focused comparisons show the intended bold hierarchy; the rest of the app keeps its fonts.
3. **[P2] Primary button face appeared flat against the source.** Reused an unlettered copper surface crop from the selected concept as a small background asset and preserved CSS inset/drop shadows. Button label, interaction and pending states remain real HTML.
4. **[P2] CTA was narrower and its label smaller than the source.** Focused form comparison identified this. Final revision extends the button 4px beyond each input edge and uses a24px bold label; recaptured below.
5. Final full-view and focused captures were opened and inspected after the CTA correction; they rechecked the corrected paper, heading and button face. No actionable P0/P1/P2 issues remain.

## Required fidelity surfaces

- **Typography:** Local Geist regular/semibold for controls; dedicated Geist Black900 for headings. Source font is inferred visually, not claimed to be identified exactly. Visible labels 17px and input font17px; no text truncation or iOS small-input zoom. Heading weights, wrapping and Cyrillic rendering inspected. Recovery's longer title intentionally wraps on narrow screens.
- **Spacing/layout:** At 390px the login emblem is about267px wide, top28px; form x16px, y404px, width358px, approximately348px tall. These closely follow the normalized source. Forms retain 44px link targets and ≥48px inputs, rounded surfaces and soft shadows. Register/recovery use a smaller220px emblem and natural page scrolling for their real field sets.
- **Colors/tokens:** Deep brown display text and button, cream form, gold input focus and underline, fine paper material. Texture is generated to match the source direction, not pixel-extracted wholesale. Minor natural texture/color differences are acceptable P3 artistic variation. Shared portal colors outside auth are unchanged.
- **Image fidelity:** User-supplied second image preserved as one real illustration; no hand-drawn substitute, code art, stock imagery, or text overlays on the illustration. CSS circular display clipping/multiply blends its white exterior into paper. All form controls/text are real DOM. Asset generation limited to plain paper material. Images/WOFF remain local and are in PWA precache.
- **Copy/content:** Login exactly uses the concept's key title/labels/links and 4–12 digit password hint. Existing product requirements are preserved: separate first/last name at registration and recovery, password confirmations and recovery-code confirmations. Short guidance on secret code remains on those forms. The concept does not provide separate registration/recovery layouts; consistent variants are intentional.

## Functional/browser checks

- 19/19 focused checks across 375/390/430/768/1280: all three pages' visible labels, readable inputs, complete illustration, loaded display font, no horizontal overflow, keyboard order, links, illustration-failure fallback, recovery setup and asset precache.
- Full normal compiled-app regression: 21/21, including failed/successful login, registration mismatch/error/success, recovery failure/success and setup gate. All API writes are fixture-only.
- Local CI113/113 and production build/typecheck pass. Initial auth states have no uncaught JS or console errors. Simulated server rejection scenarios retain the existing diagnostic logging; they are expected failures, not claimed console-clean production checks.
- Real production login, hosted Supabase/RLS, physical iPhone/VoiceOver/keyboard and deployed push have not been tested here. No SQL/production backend writes made. Existing RC1 server restrictions remain.

## Follow-up polish

- P3: Exact original mock font and paper grain are not identifiable from the raster. Closely matched self-hosted typography/materials are used.
- P3: Physical iOS/Safari and assistive technology confirmation remains a separate device check; no claim of device PASS.

## Implementation checklist

- [x] Preserve provided emblem and real editable form content.
- [x] Match composition, visible labels, copper button and underlined navigation.
- [x] Correct observed texture/font/button issues and recompare source + browser.
- [x] Preserve all auth handlers, validation, error/pending states and recovery setup.
- [x] Mobile/desktop, keyboard, reduced motion, image failure and offline assets checked.
- [x] Keep backend, main branch and production deployment unchanged.

final result: passed
