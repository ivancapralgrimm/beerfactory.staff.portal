# Unslop/Hallmark — scoped finish audit

Approved Warm Hall stays unchanged. Scope:profile avatar66px (+4px),login form submission state,live knowledge source. Unslop credit:Damir Sokolovsky/@heydamir,CC BY4.0;Hallmark:MIT. Sources and licenses remain in skills/.

- Avatar/name/card geometry compared at320,375,390,430,768 in actual Chromium/LinuxWebKit,normal and long names. All20 pairs preserve card/name/job rectangles and avatar centre;visual gap remains11px. No page overflow. Six additional desktop screenshots cover1440px profile,article and loginerror in both engines.
- Unslop spacing/colour/icons/copy/type/layout/details/visual/motion pass:change confined to the requested optical nudge;approved assets,palette,type,compact navigation and order retained. No new ornament or product copy. No new animation.
- Hallmark real runner:0FAIL,0openREFLEX,0WARN,1acceptedwaiver24b. The only off-scale spacing is -3px to centre a66px avatar in its existing60px slot;this preserves the user's exact+4px request and text layout.
- First checker invocation lacked the global interaction CSS and falsely reported missing focus/pressed/disabled styles. Confirmed existing shared styles at src/styles/interaction-safety.css and warm.css. Final run includes the actual interaction CSS;no invented local pseudo-rules were added to silence it.
- Real render tier:15shots including375/1280/1440/1920;mobile focus,error/pending and exact layout checked through compiled app suite. Raw results:hallmark.json/log.
- Browser suite first found an ambiguous test selector after search:the same article appears as both a result and a reading suggestion. Scoped selector to the real search region;application unchanged. Raw first result preserved separately. Final18/18;uncaught0,unknown fixture endpoints0.
- Root-layout relocation left two older SQL test paths pointing outside repository. Fixed paths only and executed original assertions:shift/feed5/5 and materialSQL9/9. No checks dropped.
- New actual Edge handler cases include persistent401 stayingclosed503,actual false429 without retry,recovery401→allowed inside one request,and no token issuance on refusal. This is a prepared server fix,not an applied production change.
- Independent fresh-context finish review:`ship`;report in independent-review.md. Reviewer personally inspected mobile screenshots and Chromium1440;desktopWebKit was captured separately by parent. Original long-surname wrapping at375 matches baseline;no unrelated typography redesign made.

Compiled app tests use isolated synthetic HTTP/WS,not live permissions/storage. DOM autofill simulation is not an OS password manager or physicaliPhone check. Technical source/feature connection inventory and unapplied release plan:docs/CONNECTIONS_2026-11-03.md.
