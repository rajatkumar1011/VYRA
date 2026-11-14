import assert from "node:assert/strict";
import { test } from "node:test";
import { transcribe, synthesize, SpeechError } from "../../src/lib/gnani";
test("Gnani request contract and error behavior (mocked, no live credits)", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GNANI_API_KEY;
  const originalModel = process.env.GNANI_STT_MODEL;
  try {
    delete process.env.GNANI_API_KEY;
    await assert.rejects(synthesize("hello", "en-IN"), /not connected/);
    process.env.GNANI_API_KEY = "test-key";
    process.env.GNANI_STT_MODEL = "prisma-v2.5";
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "https://api.vachana.ai/stt/v3");
      assert.equal(
        (init!.headers as Record<string, string>)["X-API-Key-ID"],
        "test-key",
      );
      const form = init!.body as FormData;
      assert.equal(form.get("model"), "prisma-v2.5");
      assert.equal(form.get("language_code"), "en-IN");
      assert.equal((form.get("audio_file") as File).name, "utterance.wav");
      return Response.json({
        success: true,
        transcript: "do litre doodh",
        model: "prisma-v2.5",
        request_id: "mock-id",
      });
    };
    const result = await transcribe(
      new File([new Uint8Array(44)], "clip.wav"),
      "hi-en",
    );
    assert.equal(result.transcript, "do litre doodh");
    globalThis.fetch = async (input, init) => {
      assert.equal(
        String(input),
        "https://api.vachana.ai/api/v1/tts/inference",
      );
      const body = JSON.parse(init!.body as string);
      assert.equal(body.voice, "Poorvi");
      assert.equal(body.model, "timbre-v2.5");
      assert.equal(body.language, "hi-en");
      assert.equal(body.audio_config.container, "wav");
      return new Response(new Uint8Array(44), {
        headers: { "Content-Type": "audio/wav" },
      });
    };
    assert.equal((await synthesize("hello", "hi-en")).status, 200);
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ detail: "bad key" }, { status: 401 });
    };
    await assert.rejects(
      synthesize("hello", "en-IN"),
      (e: unknown) => e instanceof SpeechError && e.status === 502,
    );
    assert.equal(calls, 1, "authentication errors must not retry");
    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return calls === 1
        ? new Response("busy", { status: 429 })
        : new Response(new Uint8Array(44));
    };
    await synthesize("hello", "en-IN");
    assert.equal(calls, 2);
    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return calls === 1
        ? new Response("bad gateway", { status: 502 })
        : new Response(new Uint8Array(44));
    };
    await synthesize("hello", "en-IN");
    assert.equal(calls, 2, "transient gateways retry once");
    globalThis.fetch = async () => new Response("not JSON", { headers: { "Content-Type": "application/json" } });
    await assert.rejects(
      transcribe(new File([new Uint8Array(44)], "clip.wav"), "en-IN"),
      (e: unknown) => e instanceof SpeechError && e.status === 502,
    );
    globalThis.fetch = async () => Response.json(null);
    await assert.rejects(
      transcribe(new File([new Uint8Array(44)], "clip.wav"), "en-IN"),
      (e: unknown) => e instanceof SpeechError && e.status === 502,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GNANI_API_KEY;
    else process.env.GNANI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GNANI_STT_MODEL;
    else process.env.GNANI_STT_MODEL = originalModel;
  }
});
