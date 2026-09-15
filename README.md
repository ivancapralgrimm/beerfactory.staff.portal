# BeerFactory Staff Portal

Production-oriented mobile-first portal shell for bar/brewery staff.

## Run
Serve this directory as static files. For local development:

`python3 -m http.server 8080`

Then open `http://localhost:8080`.

## Data
- `assets/training-data.json` powers Knowledge.
- `assets/questions.txt` powers Attestation.
- Menu tries the configured Cloudflare Worker and falls back to local demo data.

## Important
The frontend contains no NocoDB secret. The API token belongs in the Cloudflare Worker environment only.
