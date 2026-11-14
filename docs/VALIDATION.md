# Validation

## Automated

- `npm test`: domain and mocked Gnani contracts.
- `npm run typecheck`: TypeScript.
- `npm run build`: production build.
- `npm run test:integration`: real local HTTP flow, session isolation and checkout replay.
- `npm audit`: dependency audit.

Mocked contracts are not evidence of live speech access, quality or latency.

## Live speech acceptance check

1. Configure `GNANI_API_KEY` with STT/TTS scopes in `.env.local`; restart. A configured key alone does not prove provider access.
2. Opt in to audio processing, start recording, allow the browser microphone yourself, speak a short request, and stop.
3. Verify the returned transcript, basket quantities and audible Timbre reply. Check the speech requests in browser developer tools for provider errors.
4. Repeat in Hindi and English. Test silence, denied permission, the 25-second limit and audio stop.
5. Verify actual provider request IDs. If unavailable, check account credits/scopes; never present text fallback as live Gnani voice.

## Manual browser check

Run `npm run test:ui` for desktop and phone coverage of search, categories, basket edits, review, receipt, board, themes, recording/error recovery, and overflow. Screenshots are saved in `.preview/screenshots/`; browser test output is in `.preview/test-results/`. See [the current test report](TEST-REPORT.md) for measured coverage and limits.

Run `npm run test:voice:live` to check English, Hindi and Hinglish through real Gnani services using synthetic microphone audio. This opt-in check consumes provider credits. Physical microphone and noisy-environment checks still need manual testing.

## Hosting

Set `SESSION_SECRET` and durable `DATABASE_URL` on serverless hosts. Check HTTPS cookies, persistence across restarts, duplicate confirmation and isolation across two browsers. Real merchant identity, inventory reservation, distributed rate limits, payments and delivery are beyond this demo's scope.
