# Profile date: follow-up after real iPhone feedback

Base:07a885e, redesign/r40.7-warm-hall-v3. The user supplied a real iPhone screenshot showing the right edge of the date field cut off while rendering a long Russian date. The previous intrinsic-width guard did not solve that device case. Linux browser geometry alone was insufficient evidence; no physical iPhone PASS is claimed.

## Change

The visible date border/background/radius now belong to an ordinary span within the existing label. Its width follows the form, with min-width0 and a44px height. The native input is positioned inside, uses appearance:none, no border or shadow, reduced internal padding and clipped painting. Its intrinsic renderer cannot enlarge the frame. The frame supplies the inset brown hover/focus/press outline through focus-within; the input's redundant outline is explicitly replaced. Disabled styling remains disabled. Date value, type, min/max, autocomplete, onChange, validation, save handler and ISO payload are unchanged; no custom calendar or dependency added.

The earlier interaction test now inspects the visible date frame when focus is delegated, retaining all geometry/ring assertions. This reflects the new composite control; it does not remove the focus requirement.

## Unslop / Hallmark

Polish in the approved Warm Hall system. Direction remains warm, collected, friendly; content, order, local fonts, images and wiring stay. Spacing: preserve44px control height and surrounding positions. Colour: existing paper/stroke/cocoa tokens. Icons/copy/type: unchanged. Layout: remove the native date renderer from grid sizing. Details: separate whole border and delegated inset ring. Visuals/motion: no new assets or animation, immediate focus. No new art direction.

Upstream skills used:Unslop by Damir Sokolovsky/@heydamir (CC BY4.0), pinned source in skills/unslop; Hallmark by Hallmark contributors (MIT), pinned source in skills/hallmark. Licenses and credits remain. Actual sloplint --scope app --render checked ProfilePage.tsx and interaction-safety.css plus two actual-browser DOM snapshots:0FAIL,0REFLEX,0WARN, render ran. This is a scoped result, not global certification of the existing app stylesheet.

Fresh-context Hallmark finish reviewer inspected all six new screenshots and code:ship, no confirmed scoped defects. See qa/r407/evidence/profile-date-ios/independent-review.md.

## Verification

- Production build including TypeScript and PWA build:success.
- Project tests:113/113.
- Normal compiled-app e2e:21/21, including profile update/rejection/reload, permissions and other route families; all remote APIs are fixtures.
- Shared interaction regression:24/24 in Chromium/WebKit, including delegated date focus; no uncaught errors or unknown fixture endpoints. Existing assertions were preserved.
- Targeted mobile date checks:28/28, actual Chromium and Linux WebKit, ru-RU locale, iPhone user-agent, touch/mobile viewport. Staff/owner, widths320/375/390/430/768, both borders/frame/input bounds and focus, editing/saving/reloading ISO value, visible label, autocomplete and keyboard Tab. No uncaught errors or unknown fixture endpoints.
- Actual screenshots show complete frames at320/375/390 in both engines. Chromium displays03/27/1994 and Linux WebKit27.03.1994. These are real renderer results, not images altered to mimic native iOS.

## Limits

The long native iOS date string from the user's screenshot cannot be reproduced by Linux WebKit's date implementation. A mobile viewport, iPhone UA and touch do not make it physical iOS. Native iPhone picker, VoiceOver/system text size remain unverified. The repair addresses the failure structurally by separating the visible border from native input painting. Production/RLS, real account writes and device PWA are not claimed PASS. Main, SQL, Worker, Supabase/NocoDB and production are untouched.

Evidence:qa/r407/evidence/profile-date-ios/. Tests:qa/r407/tests/profile-date-ios-browser.mjs. Existing global interface assertions still verify the visible ring; no handler or permission assertions removed.
