# VYRA speech integration

VYRA uses Gnani Prisma for transcription and Gnani Timbre for spoken replies. Speech requests run on the server so provider credentials stay out of the browser.

## Request flow

1. The shopper opts in to voice processing and grants microphone access.
2. The browser records a short request, with a 25-second cap, and converts it to mono 16 kHz PCM WAV.
3. Prisma returns a transcript, which passes through the same catalog validation and basket rules as typed input.
4. Timbre synthesizes the reply. The shopper can stop playback or mute replies.
5. The shopper reviews and confirms the basket before an order is saved.

## Configuration

Set `GNANI_API_KEY` in the server environment. Optional model, language and voice settings are listed in the [README environment reference](../README.md#environment-variables). See the [validation guide](VALIDATION.md) for live speech checks and their testing limits.

## API references

- [Documentation index](https://docs.gnani.ai/llms.txt)
- [Speech quickstart](https://docs.gnani.ai/api/introduction/quick-start.md)
- [Speech-to-text REST API](https://docs.gnani.ai/api/STT/speech-to-text.md)
- [Transcription languages](https://docs.gnani.ai/api/STT/languages.md)
- [Transcription limits](https://docs.gnani.ai/api/STT/limits.md)
- [Text-to-speech REST API](https://docs.gnani.ai/api/TTS/tts-inference.md)
- [Voice catalog](https://docs.gnani.ai/api/TTS/available-voices.md)
- [Provider error reference](https://docs.gnani.ai/api/introduction/errors.md)
