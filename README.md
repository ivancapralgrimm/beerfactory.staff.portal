# BeerFactory Staff Portal

Production-oriented mobile-first portal shell for bar/brewery staff.

## Run
Node 24.x. Install with `npm ci`, then `npm run dev`.
Validate with `npm test`, `npm run typecheck` and `npm run build`.
Publish the generated `dist` directory through the existing release process.

## Data
- Production Knowledge reads from Supabase RPCs; the article editor writes to the same source of truth.
- `VITE_KNOWLEDGE_SOURCE=legacy` is retained only as a temporary emergency rollback while the old static Knowledge files still exist.
- Attestation reads the online bank from Supabase and keeps an offline cache in IndexedDB/localStorage.
- Menu tries the configured Cloudflare Worker and falls back to local demo data.

## Important
The frontend contains no NocoDB secret. The API token belongs in the Cloudflare Worker environment only.
