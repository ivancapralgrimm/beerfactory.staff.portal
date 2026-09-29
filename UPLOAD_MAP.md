# Upload / replacement map

## Add
- `src/features/feed/types.ts`
- `src/features/feed/feed-api.ts`
- `src/features/feed/use-feed.ts`
- `src/features/feed/FeedPostCard.tsx`
- `src/features/feed/FeedPage.tsx`
- `src/features/feed/DashboardFeedSection.tsx`
- `supabase/migrations/20260928230000_bfstaff_feed_shift_megapack.sql`

## Replace
- `src/features/shift/types.ts`
- `src/features/shift/shift-api.ts`
- `src/features/shift/ShiftPage.tsx`
- `src/features/admin/AdminAuditPanel.tsx`
- `supabase/functions/handover-push/index.ts`
- `supabase/functions/handover-push/deno.json`

## Patch existing
- `src/app/App.tsx`
- `src/components/layout/AppShell.tsx`
- `src/pages/DashboardPage.tsx`

For the three patched files, the safest route is to run:
`tools/apply_megapack.py`

`INTEGRATION_PATCH.diff` is included for manual review. The Python installer uses exact anchors from the verified target HEAD and refuses to continue if they do not match.
