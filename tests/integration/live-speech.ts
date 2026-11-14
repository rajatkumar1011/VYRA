// Opt-in acceptance test: makes real, billable Gnani requests using synthetic speech.
import assert from "node:assert/strict";
import { chromium, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const cases = [
  { language: "en-IN", text: "Two litres milk and one kilo rice." },
  { language: "hi-IN", text: "दो लीटर दूध और एक किलो चावल।" },
  { language: "hi-en", text: "Do litre doodh aur ek kilo chawal." },
];

function wavDuration(buffer: Buffer) {
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
  assert.equal(buffer.toString("ascii", 8, 12), "WAVE");
  let byteRate = 0;
  for (let at = 12; at + 8 <= buffer.length;) {
    const size = buffer.readUInt32LE(at + 4);
    const kind = buffer.toString("ascii", at, at + 4);
    if (kind === "fmt ") byteRate = buffer.readUInt32LE(at + 16);
    // Timbre streams WAV with 0xffffffff length placeholders; use received bytes.
    if (kind === "data") { assert.ok(byteRate); return Math.min(size, buffer.length - at - 8) / byteRate; }
    at += 8 + size + size % 2;
  }
  throw new Error("No WAV audio data returned.");
}

async function main() {
  assert.equal((await (await fetch(`${base}/api/shop`)).json()).speech, true, "Configure Gnani before running a live test.");
  await Promise.all([
    mkdir(".preview/audio", { recursive: true }),
    mkdir(".preview/reports", { recursive: true }),
  ]);
  const results: object[] = [];
  for (const item of cases) {
    let browser;
    let page: Page | undefined;
    try {
      const synthesized = await fetch(`${base}/api/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      assert.equal(synthesized.status, 200, `Synthetic ${item.language} speech failed: ${await (!synthesized.ok ? synthesized.text() : Promise.resolve(""))}`);
      const wav = Buffer.from(await synthesized.arrayBuffer());
      const seconds = wavDuration(wav);
      assert.ok(seconds > 0 && seconds < 23, "Use a short, non-empty fixture.");
      // The fake microphone expects a finalized WAV rather than a streaming header.
      if (wav.readUInt32LE(4) === 0xffffffff) wav.writeUInt32LE(wav.length - 8, 4);
      if (wav.toString("ascii", 36, 40) === "data" && wav.readUInt32LE(40) === 0xffffffff)
        wav.writeUInt32LE(wav.length - 44, 40);
      const fixture = path.resolve(`.preview/audio/live-${item.language}.wav`);
      await writeFile(fixture, wav);
      browser = await chromium.launch({
        args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${fixture}%noloop`],
      });
      page = await browser.newPage();
      console.log(`Testing live ${item.language}: ${seconds.toFixed(2)}s synthetic fixture.`);
      const speech: { status: number; type?: string; transcript?: string; requestId?: string }[] = [];
      page.on("response", async (response) => {
        if (!response.url().endsWith("/api/speech")) return;
        const type = response.headers()["content-type"];
        const data = type?.includes("json") ? await response.json() : {};
        speech.push({ status: response.status(), type, transcript: data.transcript, requestId: data.requestId });
      });
      await page.goto(base);
      await page.getByLabel("Conversation language").selectOption(item.language);
      await page.getByLabel("Allow voice clips").check();
      await page.getByRole("button", { name: "Talk to VYRA", exact: true }).click();
      await expect(page.getByRole("button", { name: /^Stop ·/ })).toBeVisible();
      // This is audio fixture playback time, not a readiness wait.
      await page.waitForTimeout(Math.ceil(seconds * 1000) + 350);
      await page.getByRole("button", { name: /^Stop ·/ }).click();
      await page.waitForFunction(() => document.querySelector(".message.you, .error-banner"), undefined, { timeout: 45_000 });
      await expect(page.locator(".error-banner")).toHaveCount(0);
      await expect(page.locator(".message.you")).toBeVisible();
      await expect(page.getByRole("button", { name: "Talk to VYRA", exact: true })).toBeEnabled({ timeout: 45_000 });
      const transcript = await page.locator(".message.you p").innerText();
      await expect(page.locator(".basket-line")).toHaveCount(2);
      await expect(page.locator(".total-row")).toContainText("₹235");
      await expect(page.locator(".error-banner")).toHaveCount(0);
      assert.deepEqual(speech.map((response) => response.status), [200, 200]);
      await expect(page.getByRole("button", { name: "Stop audio playback" })).toBeVisible();
      await page.getByRole("button", { name: "Stop audio playback" }).click();
      await expect(page.getByRole("button", { name: "Stop audio playback" })).not.toBeVisible();
      results.push({ language: item.language, passed: true, transcript, total: 235, speech });
      console.log(`PASS live ${item.language}: ${transcript} → ₹235, spoken reply and Stop verified.`);
    } catch (e) {
      const alerts = page ? await page.locator(".error-banner").allTextContents().catch(() => []) : [];
      results.push({ language: item.language, passed: false, alerts, error: e instanceof Error ? e.message : String(e) });
      console.error(`FAIL live ${item.language}: ${e instanceof Error ? e.message : String(e)}`);
      if (alerts.length) console.error(`Browser: ${alerts.join(" ")}`);
      process.exitCode = 1;
    } finally { await browser?.close(); }
  }
  await writeFile(".preview/reports/live-speech-results.json", JSON.stringify(results, null, 2));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
