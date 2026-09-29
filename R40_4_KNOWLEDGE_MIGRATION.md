# BeerFactory Staff Portal · r40.4 Knowledge migration

## Scope

Phase 3 moves Knowledge from legacy DOM code to React without changing the content source.

Source of truth remains:
- `assets/training-data.txt`
- `assets/service-images/*`

The old demo `assets/training-data.json` is deliberately not used.

## Design basis

Live Refero research is currently unavailable because the connected subscription is inactive, so the implementation uses the approved fallback:

1. r40.3 Knowledge as the primary product reference.
2. BeerFactory's locked dark industrial/copper design system.
3. Refero bundled craft guidance for semantic links/buttons, focus-visible states, 44px+ touch targets, URL-backed state, restrained cards, reduced motion and long-list rendering.
4. Existing project requirement: ordinary articles, not accordions.

## Reference lock

Preserve:
- dark brown / graphite canvas
- copper only for active/action hierarchy
- article-first reading flow
- full-text search
- category filters
- reading time
- read-state
- service images
- deep links
- share/copy
- local progress fallback
- Supabase `training_progress` synchronization

Reject:
- dashboard card soup
- demo JSON as source
- fake/generated training content
- decorative animation
- breaking existing `lesson-*` progress IDs

## Compatibility

### Stable article IDs

The parser deliberately keeps legacy sequential IDs:
`lesson-1`, `lesson-2`, ...

That preserves existing `training_progress` rows.

### Legacy routes

- `#/training` redirects to `#/knowledge`
- `#/article/lesson-N` redirects to `#/knowledge/lesson-N`

### Offline

`training-data.txt` and local service images are copied to Vite public assets and matched by the existing PWA Workbox glob.

Read-state continues using:
`bf-learning-r18:<userId>`

If Supabase is unavailable, local read-state remains visible.

### URL-backed browse state

- `#/knowledge?q=виски`
- `#/knowledge?cat=Сервис`
- `#/knowledge/lesson-12`

Back therefore restores search/category context naturally.

## QA gate

After the build is green:
1. Login on r40.4 Preview.
2. Open Knowledge.
3. Verify categories including `Сервис`.
4. Search for `виски`.
5. Open a result and return.
6. Confirm query/category context remains.
7. Open a Service article with an image.
8. Open and close the image viewer.
9. Mark article read.
10. Return and confirm `Прочитано`.
11. Reload and confirm read-state remains.
12. Refresh a direct article deep link.
13. Check legacy `#/training`.
14. Check legacy `#/article/lesson-N`.
15. Temporary offline check after one online load.
