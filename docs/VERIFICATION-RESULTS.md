# VYRA verification summary

VYRA is available at [vyra-gnani.vercel.app](https://vyra-gnani.vercel.app).

## Verified functionality

- Grocery search, category filters, quantity controls and stock limits.
- Hindi, English and Hinglish shopping requests.
- Catalog-based pricing, delivery calculation and editable baskets.
- Signed order reviews, explicit confirmation and duplicate-checkout protection.
- Postgres order persistence, browser-session isolation and fulfilment transitions.
- Receipt downloads, theme preferences and responsive layouts.
- Voice consent, recording limits, microphone cleanup and audio playback controls.
- Recoverable request failures, empty transcriptions and invalid-input handling.

## Recorded checks — 14 November 2026

| Check | Result |
| --- | --- |
| Unit and mocked provider tests | 16 passed |
| Browser tests | 30 passed |
| TypeScript validation | Passed |
| Production build | Passed |
| HTTP integration | Passed |
| Public HTTPS deployment | Verified |
| Persistent order storage | Neon Postgres verified |
| Live speech | English, Hindi and Hinglish verified using synthetic microphone audio |

The speech checks produced the expected two-milk, one-rice basket with a total of ₹235. Voice transcription and synthesis returned successful provider responses, and Stop playback was exercised.

## Testing scope

Browser testing used Chromium across nine viewport sizes. Physical microphones, noisy environments, other browser engines and human listening evaluations remain outside the recorded coverage. The optional LLM integration was not verified live.

See the [functional test report](TEST-REPORT.md), [deployment guide](DEPLOYMENT.md) and [validation guide](VALIDATION.md) for technical details.
