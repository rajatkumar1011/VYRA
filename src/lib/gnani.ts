import type { Language } from "./catalog";
const BASE = "https://api.vachana.ai";
export class SpeechError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function speechConfigured() {
  return Boolean(process.env.GNANI_API_KEY);
}
export async function gnaniFetch(
  path: string,
  init: RequestInit,
): Promise<Response> {
  if (!speechConfigured())
    throw new SpeechError(
      503,
      "Voice is not connected. Add GNANI_API_KEY to enable Prisma and Timbre. Text ordering still works.",
    );
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...init.headers, "X-API-Key-ID": process.env.GNANI_API_KEY! },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) return response;
    if ([429, 500, 502, 503, 504].includes(response.status) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 700));
      continue;
    }
    const message =
      response.status === 401 || response.status === 403
        ? "Gnani rejected the API key or service scope. Check the key in your server settings."
        : response.status === 429
          ? "Gnani is busy. Please wait a moment and try again."
          : "Gnani could not process this request. Try a shorter recording or use text.";
    throw new SpeechError(response.status === 429 ? 429 : 502, message);
  }
  throw new SpeechError(502, "Speech service unavailable.");
}
export async function transcribe(file: File, language: Language) {
  const form = new FormData();
  form.append("audio_file", file, "utterance.wav");
  const model =
    process.env.GNANI_STT_MODEL === "prisma-v3.0"
      ? "prisma-v3.0"
      : "prisma-v2.5";
  form.append("model", model);
  form.append("language_code", language === "hi-en" ? "en-IN" : language);
  form.append("format", "transcribe");
  const response = await gnaniFetch("/stt/v3", { method: "POST", body: form });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new SpeechError(502, "Gnani returned an invalid transcript response. Please try again.");
  }
  if (!data || data.success === false || typeof data.transcript !== "string")
    throw new SpeechError(
      502,
      "Gnani did not return a transcript. Please try again.",
    );
  return {
    transcript: data.transcript.trim(),
    model: data.model || model,
    requestId: data.request_id,
  };
}
export async function synthesize(text: string, language: Language) {
  const voices = { "hi-IN": "Nalini", "en-IN": "Pranav", "hi-en": "Poorvi" };
  return gnaniFetch("/api/v1/tts/inference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voice: voices[language],
      model: "timbre-v2.5",
      language,
      speed: 1,
      audio_config: {
        sample_rate: 24000,
        num_channels: 1,
        sample_width: 2,
        encoding: "linear_pcm",
        container: "wav",
      },
    }),
  });
}
