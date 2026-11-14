import { NextRequest, NextResponse } from "next/server";
import { SpeechError, transcribe, synthesize } from "@/lib/gnani";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import type { Language } from "@/lib/catalog";
import { isSameOrigin } from "@/lib/request";
export const runtime = "nodejs";
export const maxDuration = 60;
const lang = (v: unknown): Language =>
  v === "hi-IN" || v === "hi-en" ? v : "en-IN";
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Origin not allowed." }, { status: 403 });
  }
  if (!rateLimit(`speech:${clientIp(req)}`, 30, 60_000))
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 },
    );
  try {
    if (Number(req.headers.get("content-length") || 0) > 2_100_000)
      return NextResponse.json(
        { error: "Recording too large." },
        { status: 413 },
      );
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      let form: FormData;
      try {
        form = await req.formData();
      } catch {
        return NextResponse.json(
          { error: "Invalid audio upload. Please record a new clip." },
          { status: 400 },
        );
      }
      const file = form.get("audio");
      if (!(file instanceof File) || file.size <= 44 || file.size > 2_000_000)
        return NextResponse.json(
          { error: "Use a WAV clip under 25 seconds and 2 MB." },
          { status: 400 },
        );
      // Validate the exact PCM WAV format emitted by the browser, including duration.
      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);
      const ascii = (at: number, n: number) =>
        String.fromCharCode(...new Uint8Array(buffer, at, n));
      if (
        ascii(0, 4) !== "RIFF" ||
        view.getUint32(4, true) !== file.size - 8 ||
        ascii(8, 4) !== "WAVE" ||
        ascii(12, 4) !== "fmt " ||
        view.getUint32(16, true) !== 16 ||
        view.getUint16(20, true) !== 1 ||
        view.getUint16(22, true) !== 1 ||
        view.getUint32(24, true) !== 16000 ||
        view.getUint32(28, true) !== 32000 ||
        view.getUint16(32, true) !== 2 ||
        view.getUint16(34, true) !== 16 ||
        ascii(36, 4) !== "data" ||
        view.getUint32(40, true) !== file.size - 44 ||
        (file.size - 44) % 2 !== 0 ||
        (file.size - 44) / 32000 > 26
      )
        return NextResponse.json(
          { error: "Expected mono 16 kHz PCM WAV, maximum 25 seconds." },
          { status: 400 },
        );
      return NextResponse.json(
        await transcribe(file, lang(form.get("language"))),
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const b = await req.json();
    if (typeof b?.text !== "string" || !b.text.trim() || b.text.length > 1800)
      return NextResponse.json(
        { error: "Enter 1–1800 characters." },
        { status: 400 },
      );
    const response = await synthesize(b.text, lang(b.language));
    return new Response(await response.arrayBuffer(), {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
        "X-Voice-Provider": "Gnani Timbre v2.5",
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      return NextResponse.json(
        { error: "Invalid JSON request." },
        { status: 400 },
      );
    return NextResponse.json(
      {
        error:
          error instanceof SpeechError
            ? error.message
            : "Speech request failed. Check your connection and try again.",
      },
      { status: error instanceof SpeechError ? error.status : 502 },
    );
  }
}
