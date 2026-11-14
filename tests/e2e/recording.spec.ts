import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__stops = 0;
    (window as any).__trackStops = 0;
    navigator.mediaDevices.getUserMedia = async () => ({
      getTracks: () => [{ stop: () => { (window as any).__trackStops++; } }],
    }) as unknown as MediaStream;
    (window as any).MediaRecorder = class {
      state = "inactive";
      mimeType = "audio/webm";
      onstop?: () => void;
      start() { this.state = "recording"; }
      stop() {
        if (this.state !== "recording") throw new DOMException("Already stopped", "InvalidStateError");
        this.state = "inactive";
        (window as any).__stops++;
        setTimeout(() => this.onstop?.(), 100);
      }
    };
  });
});

test("double-clicking Stop is safe and releases the microphone", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Allow voice clips").check();
  await page.getByRole("button", { name: "Talk to VYRA", exact: true }).click();
  await page.getByRole("button", { name: /^Stop ·/ }).dblclick();
  await expect(page.getByRole("button", { name: "Talk to VYRA", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__stops)).toBe(1);
  expect(await page.evaluate(() => (window as any).__trackStops)).toBe(1);
  expect(errors).toEqual([]);
});

test("the 25-second cap stops recording and releases the microphone", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByLabel("Allow voice clips").check();
  await page.getByRole("button", { name: "Talk to VYRA", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Stop ·/ })).toBeVisible();
  await page.clock.runFor(25_200);
  await expect(page.getByRole("button", { name: "Talk to VYRA", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__stops)).toBe(1);
  expect(await page.evaluate(() => (window as any).__trackStops)).toBe(1);
});

test("an empty transcription shows a recoverable message without changing the basket", async ({ page }) => {
  await page.addInitScript(() => {
    // Isolate the empty-provider-response path; real encoding is covered by live speech.
    (window as any).AudioContext = class {
      async decodeAudioData() { return { duration: 0.1 }; }
      async close() {}
    };
    (window as any).OfflineAudioContext = class {
      destination = {};
      createBufferSource() { return { buffer: null, connect() {}, start() {} }; }
      async startRendering() { return { getChannelData: () => new Float32Array(1600) }; }
    };
  });
  await page.route("**/api/speech", (route) => route.fulfill({ json: { transcript: "" } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Add Fresh milk", exact: true }).click();
  await page.getByLabel("Allow voice clips").check();
  await page.getByRole("button", { name: "Talk to VYRA", exact: true }).click();
  await page.getByRole("button", { name: /^Stop ·/ }).click();
  await expect(page.locator(".error-banner")).toContainText("I didn’t catch any speech");
  await expect(page.getByRole("button", { name: "Talk to VYRA", exact: true })).toBeEnabled();
  await expect(page.locator(".total-row")).toContainText("₹80");
  await expect(page.locator(".message.you")).toHaveCount(0);
});
