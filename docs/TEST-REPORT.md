# Functional test report — 14 November 2026

Status: all exercised functionality passes after the fixes below. This report records the local audit, which completed before publication. VYRA was subsequently deployed at https://vyra-gnani.vercel.app; see [deployment details](DEPLOYMENT.md) for the cloud verification results.

## Results

| Check | Result |
| --- | --- |
| Unit and mocked provider tests | 16 passed |
| Browser tests | 30 passed in the full post-reorganization regression run |
| HTTP integration | Passed against the production server through localhost and 127.0.0.1 |
| TypeScript | Passed |
| Optimized production build | Passed |
| Dependency audit | 0 reported vulnerabilities |
| Live English speech | Passed with real Gnani requests and synthetic microphone audio |
| Live Hindi speech | Passed with real Gnani requests and synthetic microphone audio |
| Live Hinglish speech | Passed with real Gnani requests and synthetic microphone audio |

Browser coverage includes nine viewport sizes from 320×740 to 1440×900, both themes and saved preferences, blocked storage, search in English/Hindi, categories, empty search, sold-out products, maximum quantities, basket removal/restoration, a full-capacity mobile basket, review/confirmation, Escape dismissal, receipt downloads, order fulfilment, browser-session isolation and the legacy admin redirect.

Error-path coverage includes a failed shopping request, failed speech service, consent and microphone denial, pending microphone permission, double Stop, the 25-second recording cap, empty transcription, mute during a delayed speech response, and clearing active audio.

HTTP coverage includes signed/tampered reviews, explicit confirmation, duplicate checkout, prices, delivery, unavailable and fractional quantities, session isolation, order transitions, malformed JSON/multipart/WAV, cross-origin rejection, oversized requests and the shop/speech rate limits. Provider unit tests mock authentication failures, transient HTTP retries and invalid upstream JSON; these are separate from the live checks.

## Bugs fixed

1. **Production requests from 127.0.0.1 returned 403.** Next's internal URL used localhost while the browser sent a 127.0.0.1 Origin. Both API routes now compare the Origin with the actual request Host. Cross-origin requests remain rejected. Text, speech validation and checkout are tested through both local addresses.
2. **Muted speech could still start after a slow response.** Pending speech requests are aborted, and stale responses cannot create audio players.
3. **Clearing the conversation left its audio playing.** Clear now stops playback. Switching workspaces also stops audio rather than hiding its Stop control.
4. **Navigation remained enabled while microphone permission was pending.** Navigation stays locked until recording/request handling is finished or rejected.
5. **Double-clicking Stop raised an uncaught recorder error.** Stop now checks the recorder state before stopping. Track cleanup and the recording cap have regression coverage.
6. **Failed shopping requests erased the typed request.** Failed commerce requests restore the text for retry; a speech failure after a successful basket update does not restore it and risk adding items twice.
7. **Malformed audio uploads incorrectly appeared to be provider failures.** Invalid multipart uploads now return a recoverable 400 response.
8. **Malformed provider JSON was misclassified as invalid client JSON.** Upstream transcript errors now return a sanitized 502; transient provider 502 responses retry once.

Transcript scrolling also respects reduced-motion preferences.

## Live speech evidence

Each check generated a short synthetic utterance with Timbre, recorded it through Chromium's fake microphone, converted it to mono 16 kHz PCM, sent it to Prisma, updated the basket, received a Timbre reply, and exercised Stop playback. Prisma and the reply synthesis each returned HTTP 200.

| Language | Returned transcript | Basket total |
| --- | --- | --- |
| English | two litres milk and one kilo rice | ₹235 |
| Hindi | 2 लीटर दूध और एक किलो चावल। | ₹235 |
| Hinglish | do literate doodh aur ek kilo chaval | ₹235 |

The Hinglish transcription contained a wording error, but extracted the correct two milk packs and one rice pack. This does not establish perfect recognition. Request IDs and statuses are saved locally in `.preview/reports/live-speech-results.json`; no credentials are included.

## Remaining limits

- Physical microphones, background noise, accents and real-user speech were not exercised. Live checks used synthetic audio. Audible quality was not evaluated by a human listener.
- Chromium was tested. Other browser engines and physical mobile devices were not tested.
- Optional LLM and Neon database credentials are absent, so those integrations were not verified live. The configured local parser and in-memory order store were tested.
- Orders in memory reset on server restart. Stock is a per-order demo limit. There are no real payments or deliveries.
- The local intent parser supports a bounded vocabulary. These tests do not establish that every possible phrase will be understood.

## Reproduce

Run `npm test`, `npm run typecheck`, `npm run build` and `npm audit`. With the production server running, run `npm run test:integration` and `npm run test:ui`. Repeat integration with `TEST_BASE_URL=http://127.0.0.1:3000`.

`npm run test:voice:live` is an opt-in acceptance test that makes real Gnani requests using synthetic speech and consumes provider credits. It is not part of the default mocked test suite.

## Folder reorganization verification

Application files now live in `src/`; tests are grouped into `tests/unit/`, `tests/integration/` and `tests/e2e/`. Generated files are grouped inside the ignored `.preview/` folder. Npm command names and application URLs are unchanged.

SHA-256 comparisons confirmed that all 24 original application and environment/configuration files were preserved byte-for-byte, including the dependency lockfile. Only test imports, command paths, aliases, output locations and documentation needed updates. Unused empty folders were archived without deleting files.

After the moves, 16 unit tests, all 30 browser tests, API integration, TypeScript and the production build passed. The production server was restarted locally. Integrity results are saved in `.preview/reports/reorganization-integrity.json`.
