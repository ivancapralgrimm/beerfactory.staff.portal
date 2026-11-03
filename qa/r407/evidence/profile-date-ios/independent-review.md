ship

No confirmed defect in the scoped Profile date-input patch. This is a local app-control finish review, not physical-iPhone acceptance or a full application audit.

Reviewed the six actual browser screenshots at `qa/r407/evidence/profile-date-ios/{chromium,webkit}-{320,375,390}-focus.png`, `qa/r407/evidence/interaction-polish/before-profile-webkit.png`, the changed component/CSS, browser test source and `results.json`. Applied the repository AGENTS rules, Hallmark app/component polish gates and finish-review prompt, and Unslop signs. No product files were edited.

- Sizing: every supplied after screenshot shows a complete right border and both rounded corners aligned with the surrounding fields. The 320px measurements show a 288px frame within a 288px label and a 286px input inside it; reported document width equals the viewport. The separate frame at `src/styles/interaction-safety.css:64` prevents the input's intrinsic renderer from owning the visible outer edge.
- Focus/accessibility: all six focus screenshots show a complete dark inset ring. `src/styles/interaction-safety.css:95` delegates focus to the frame through `:focus-within`, while `:105` suppresses only the inner duplicate outline. The native `input[type=date]` remains inside its original label at `src/pages/ProfilePage.tsx:122`; no replacement role, overlay text or extra tab stop was introduced. Existing min/max, autocomplete, disabled state, value and handler are retained. The supplied real-browser fixture checks locate it by its Russian label, reach it by Tab, edit the ISO value, save it and retain it on reload in both engines for staff and owner fixtures. Those checks do not establish picker-popup or VoiceOver behavior on iOS.
- Craft/Unslop: the control keeps the surrounding Warm Hall surface, restrained color, radius and typography. No scoped signs of decorative effects, generic marketing copy, arbitrary new iconography or changed hierarchy were introduced. Nothing in this control reads as machine-made.

Evidence limits: `results.json` contains 28 recorded checks, zero errors, zero uncaught errors and zero unknown fixture requests. These are Chromium and Linux WebKit using ru-RU, an iPhone user agent, touch and mobile viewports. The WebKit screenshots render `27.03.1994`; they do not render the reported native iOS string `27 марта 1994 г.`. I did not reproduce the user's physical-iOS defect and did not verify native iOS picker activation, VoiceOver, increased system text size or the long native date renderer. Hover, pressed and pending-disabled behavior are present in the scoped CSS/native input wiring but are not independently demonstrated by these focus-only screenshots. No blanket Safari/device/e2e PASS is justified.

The theme describes the screen: warm paper fields with cocoa text and an unmistakable focus state. No gap appears in the changed control. The old supplied browser capture shows clipped focus edges; it offers no scoped advantage over these after captures. Its fixture date/access values differ, so those are not visual regressions.

Must not be diluted: preserve the native labeled date input, ISO save behavior, complete field boundary and visible focus ring while validating the actual iOS renderer.

Unslop by Damir Sokolovsky (https://heydamir.design/unslop), CC BY 4.0; source skill credits and licenses remain untouched.
