# BeerFactory Staff Portal

Production-oriented mobile-first portal shell for bar/brewery staff.

## Run
Node 24.x. Install with `npm ci`, then `npm run dev`.
Validate with `npm test`, `npm run typecheck` and `npm run build`.
Publish the generated `dist` directory through the existing release process.

## Data
- `assets/training-data.txt` powers Knowledge until verified Supabase cutover.
- r40.5 article editor uses Supabase RPCs and private Storage; see
  [integration and verification instructions](R40_5_EDITOR_INTEGRATION.md).
- `assets/questions.txt` powers Attestation.
- Menu tries the configured Cloudflare Worker and falls back to local demo data.

## Important
The frontend contains no NocoDB secret. The API token belongs in the Cloudflare Worker environment only.
