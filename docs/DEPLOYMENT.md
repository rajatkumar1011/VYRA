# Vercel deployment

## Published deployment — 14 November 2026

- Public URL: https://vyra-gnani.vercel.app
- Project: `vyra-gnani`, under `rajat-kumars-projects-7e08c486` on the Hobby plan.
- Deployment: `dpl_3rfRSASm6dTBSR89hQadoQ6HPedE`, production, READY.
- Orders: Neon `vyra-orders`, Free plan, connected to the production environment.
- Speech: production Gnani key configured as a secret; Prisma v2.5 and Timbre exercised live.
- Session signing uses a separate production secret. No credential values are stored in this document or uploaded with the source.

Public access was verified without authentication or a protection bypass: the homepage and `/api/shop` returned HTTP 200. The API reports `storage: postgres` and speech enabled.

Live verification passed text shopping, prices, explicit review/confirmation, duplicate checkout, receipts, packing/ready transitions, persistence after refresh, separate-browser isolation, themes and mobile layout. English, Hindi and Hinglish synthetic microphone tests all returned the expected ₹235 basket and a spoken reply. Hinglish transcription had a minor wording error but the basket was correct. No physical microphone or human audio-quality evaluation is claimed.

The local-only test report predates publication. Deployment-specific artifacts are in `.preview/reports/vercel-deployment.json` and `.preview/reports/vercel-live-speech-results.json`; screenshots are in `.preview/screenshots/production-*`.

## Source and setup

Deploy from the project root. The app uses Next.js route handlers and requires a Node.js runtime; do not export it as a static-only site.

## Production settings

| Variable | Setting |
| --- | --- |
| `SESSION_SECRET` | A unique production secret, generated from at least 32 random bytes. Store as a Vercel Secret. |
| `GNANI_API_KEY` | The configured Gnani speech key. Store as a Vercel Secret. |
| `GNANI_STT_MODEL` | `prisma-v2.5` unless deliberately changed. |
| `DATABASE_URL` | A durable Neon-compatible Postgres connection. Required for reliable serverless order storage. |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | Optional; otherwise the existing local intent parser is used. |

Set production variables through Vercel's environment settings or CLI stdin. Do not pass secret values in command arguments or commit environment files. Environment changes require a subsequent deployment.

The existing order store creates only its `vyra_orders` table. Without a database, memory-backed demo orders can disappear after a cold start or differ between function instances.

## Deploy

1. Authenticate to the intended Vercel account and choose the project/team.
2. Link this folder to the Vercel project.
3. Configure production secrets and connect persistent storage.
4. Review `vercel deploy --dry --json` to confirm the uploaded file list.
5. Deploy with `vercel deploy --prod` and wait for a successful build.
6. Verify the public production URL without relying on a deployment-protection bypass.

`vercel.json` specifies the Next.js framework, `npm ci`, and `npm run build`. `.vercelignore` excludes local environment files, dependencies, build artifacts, recordings, screenshots, test code and documentation. This supports direct CLI deployment without publishing a Git repository.

## Verify the live deployment

- Check the storefront and `/api/shop` return HTTP 200.
- Confirm configured speech and durable storage status without exposing secret values.
- Test text shopping from the actual HTTPS origin, review, confirmation, refresh, receipt and shopkeeper transitions.
- Check that a separate browser session cannot see another session's orders.
- Exercise one synthetic speech round trip against the deployed speech endpoint.
- Verify theme persistence, mobile layout and browser console errors.

Run the HTTP integration script against the returned URL using `TEST_BASE_URL`. Set `TEST_RATE_LIMITS=0` for remote functional tests: Vercel replaces forwarded client-IP headers, so the local rate-limit isolation technique does not apply. Production throttling was observed returning 429 after the shared quota was reached; deterministic capacity tests remain enabled for local runs.

```powershell
$env:TEST_BASE_URL = 'https://vyra-gnani.vercel.app'
$env:TEST_RATE_LIMITS = '0'
npm run test:integration
# Optional; makes real provider calls:
npm run test:voice:live
```

The opt-in live speech test uses the same base URL and consumes Gnani credits.
