# BeerFactory Staff Portal · Mobile audit r19

## Target devices
Primary target:
- iPhone / Safari / installed PWA;
- Samsung Galaxy / Chrome;
- Samsung Galaxy / Samsung Internet;
- Xiaomi / HyperOS / Chrome;
- Xiaomi / MI Browser;
- Poco / HyperOS / Chrome;
- ordinary Android Chromium browsers.

Secondary / best-effort:
- Android WebView and in-app browsers. For staff use, prefer normal browser or installed PWA.

## Fixed in r19

### Network / offline
- Added a Service Worker for the application shell.
- Core JS/CSS, Knowledge data and Supabase JS are cached after first successful online load.
- Previously loaded recipes remain available through last-known-good data cache.
- Recipe API is intentionally NOT cached by Service Worker, so there is only one freshness policy for menu data.
- Offline cached data no longer falsely shows “no connection” while the user is merely inside the 5-minute fresh-cache window.

### Browser compatibility
- Removed direct dependency on AbortSignal.timeout() in recipes.js.
- Added AbortController-based timeout fallback.
- Added random recipe ID fallback when crypto.randomUUID() is absent.
- Added vh fallback before svh.
- Added -webkit-backdrop-filter for Safari/iOS.
- Added fixed-position fallbacks for browsers that mishandle inset()/safe-area expressions.

### Mobile layout / interactions
- Added explicit narrow-phone treatment below 380 px.
- Touch targets for chips remain at least approximately 44 px on coarse-pointer devices.
- Tag area no longer becomes an inner scrolling panel inside a 155 px flip card.
- Photo wrapper no longer accidentally flips the recipe card when the user taps empty space around a photo.
- Broken remote photos collapse cleanly instead of leaving a broken-image block.

### Flip-card stability
- Removed one window resize listener PER recipe card.
- There is now one resize handler for the current recipe list.
- This prevents listener accumulation after every search keystroke / category rerender.
- Calculator changes trigger a card height resync.

### Calculator coverage
Added count-like recipe units in addition to ml/l/g/kg/pcs/portions:
- долька / дольки / долек;
- слайс / слайса / слайсов;
- лист / листа / листьев;
- зерно / зерна / зёрен;
- веточка;
- палочка;
- зубчик;
- ломтик;
- кусок;
- штука;
- капля.

Text-only lines such as “по вкусу” remain unchanged instead of being corrupted.

## Tests executed
- node --check recipes.js: PASS
- node --check sw.js: PASS
- recipe unit parser smoke tests: PASS for ml, gr, g, l, slice, leaf, grain, twig, stick, clove, drop and text-only lines.
- static assertions for cache source states, r19 versioning, one resize handler, Service Worker registration and mobile compatibility stylesheet: PASS.

## Remaining issues before Recipe Sprint can be marked Done
1. Real-device test on at least:
   - one iPhone;
   - one Samsung Android;
   - one Xiaomi/Poco Android.
2. Staff UX test with 3 employees and measured recipe lookup time.
3. Decide whether flip-card survives the staff test.
4. PWA manifest currently has no icons. Browser use is fine, but installability/home-screen presentation can vary. Fix later in PWA hardening unless it blocks staff installation.
5. True offline works only after at least one successful online load. An employee who has never loaded the portal cannot magically download it from the void, despite humanity's recurring expectations of networking.
6. Old Android browsers that do not understand modern JavaScript syntax already present in app.js/learning.js are not a supported target. If a real staff device hits this, add a build/transpile step instead of scattering more polyfills.

## Practical support floor for pilot
Use current or reasonably recent versions of Safari, Chrome, Samsung Internet and MI Browser. Do not make embedded Telegram/Instagram/etc. webviews an official staff workflow.
