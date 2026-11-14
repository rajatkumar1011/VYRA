import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { CATALOG } from "../../src/lib/catalog";

for (const host of ["localhost", "127.0.0.1"]) {
  test(`text ordering and speech validation accept the actual ${host} browser origin`, async ({ page }) => {
    await page.goto(`http://${host}:3000`);
    await page.getByLabel("Spoken replies").uncheck();
    await page.getByRole("textbox", { name: "Message VYRA" }).fill("1 milk");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator(".total-row")).toContainText("₹80");
    const status = await page.evaluate(async () => (await fetch("/api/speech", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "" }),
    })).status);
    expect(status).toBe(400); // Input validation, not an incorrect 403 origin rejection.
    await page.getByRole("button", { name: "Review order", exact: true }).click();
    await page.getByRole("button", { name: "Confirm demo order", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Order received", exact: true })).toBeVisible();
  });
}

test("catalog filters, sold-out items and stock controls work", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Dairy & bread", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(3);
  await page.getByRole("textbox", { name: "Search products" }).fill("दूध");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Search products" }).fill("missing product");
  await expect(page.getByRole("heading", { name: "No essentials found" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".product-card")).toHaveCount(12);
  await expect(page.getByRole("button", { name: "Add Assam chai", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Add Fresh milk", exact: true }).click();
  for (let i = 1; i < 12; i++) await page.getByRole("button", { name: "Add one Fresh milk", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add one Fresh milk", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Increase basket Fresh milk", exact: true })).toBeDisabled();
  await expect(page.locator(".total-row")).toContainText("₹720");
  for (let i = 0; i < 12; i++) await page.getByRole("button", { name: "Decrease basket Fresh milk", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your basket is empty" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review order", exact: true })).toBeDisabled();
});

test("receipt download, dialog dismissal, browser isolation and admin redirect work", async ({ page, browser }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\?view=orders/);
  await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Storefront", exact: true }).click();
  await page.getByRole("button", { name: "Add Fresh milk", exact: true }).click();
  await page.getByRole("button", { name: "Review order", exact: true }).click();
  await page.getByRole("button", { name: "Back to basket" }).press("Escape");
  await expect(page.locator("dialog")).not.toBeVisible();
  await expect(page.locator(".basket-line")).toHaveCount(1);
  await page.getByRole("button", { name: "Review order", exact: true }).click();
  await page.getByRole("button", { name: "Confirm demo order", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Order received", exact: true })).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download receipt", exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^vyra-[\da-f-]+\.txt$/);
  const receipt = await readFile((await download.path())!, "utf8");
  expect(receipt).toContain("Fresh milk (1 litre) x 1 — INR 60");
  expect(receipt).toContain("Total: INR 80");
  expect(receipt).toContain("No payment collected");
  await page.getByRole("button", { name: "View in Shopkeeper" }).click();
  await expect(page.locator(".order-card")).toHaveCount(1);
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await otherPage.goto("/?view=orders");
    await expect(otherPage.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
    await expect(otherPage.locator(".order-card")).toHaveCount(0);
  } finally { await other.close(); }
});

test("a failed chat keeps the shopping request available for retry", async ({ page }) => {
  await page.route("**/api/shop", async (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 503, json: { error: "Temporary test outage." } });
    await route.continue();
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Message VYRA" }).fill("2 milk");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".error-banner")).toContainText("Temporary test outage");
  await expect(page.getByRole("textbox", { name: "Message VYRA" })).toHaveValue("2 milk");
  await expect(page.locator(".basket-line")).toHaveCount(0);
});

test("muting spoken replies cancels a speech response still in flight", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__audioPlayers = 0;
    (window as any).Audio = class {
      onended = null;
      onerror = null;
      constructor() { (window as any).__audioPlayers++; }
      async play() {}
      pause() {}
    };
  });
  let release!: () => void;
  let speechStarted!: () => void;
  const started = new Promise<void>((resolve) => { speechStarted = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/speech", async (route) => {
    speechStarted();
    await held;
    await route.fulfill({ status: 200, contentType: "audio/wav", body: Buffer.alloc(44) });
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Message VYRA" }).fill("1 milk");
  await page.getByRole("button", { name: "Send message" }).click();
  await started;
  await page.getByLabel("Spoken replies").uncheck();
  release();
  await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Talk to VYRA", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__audioPlayers)).toBe(0);
  await expect(page.locator(".total-row")).toContainText("₹80");
});

test("clear conversation stops an active spoken reply", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__paused = false;
    (window as any).Audio = class {
      onended = null;
      onerror = null;
      async play() {}
      pause() { (window as any).__paused = true; }
    };
  });
  await page.route("**/api/speech", (route) => route.fulfill({ status: 200, contentType: "audio/wav", body: Buffer.alloc(44) }));
  await page.goto("/");
  await page.getByRole("textbox", { name: "Message VYRA" }).fill("1 milk");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("button", { name: "Stop audio playback" })).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop audio playback" })).not.toBeVisible();
  expect(await page.evaluate(() => (window as any).__paused)).toBe(true);
  await expect(page.locator(".message")).toHaveCount(1);
});

test("navigation is locked while microphone permission is pending", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => new Promise((_resolve, reject) => {
      (window as any).__denyMic = () => reject(new DOMException("Test denied", "NotAllowedError"));
    });
  });
  await page.goto("/");
  await page.getByLabel("Allow voice clips").check();
  await page.getByRole("button", { name: "Talk to VYRA", exact: true }).click();
  await expect(page.getByRole("button", { name: "Shopkeeper", exact: true })).toBeDisabled();
  await page.evaluate(() => (window as any).__denyMic());
  await expect(page.getByRole("button", { name: "Shopkeeper", exact: true })).toBeEnabled();
});

test("largest valid basket fits a 320px phone including the floating shortcut", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const full = Object.fromEntries(CATALOG.filter((p) => p.stock).map((p) => [p.id, p.stock]));
  await page.addInitScript((cart) => localStorage.setItem("vyra-basket", JSON.stringify(cart)), full);
  await page.goto("/");
  await expect(page.locator(".mobile-basket")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const rects = await page.locator(".mobile-basket").evaluate((el) => ({
    outer: el.getBoundingClientRect().toJSON(),
    children: [...el.children].map((child) => child.getBoundingClientRect().toJSON()),
  }));
  for (const rect of rects.children) {
    expect(rect.right).toBeLessThanOrEqual(rects.outer.right);
    expect(rect.bottom).toBeLessThanOrEqual(rects.outer.bottom);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("unavailable browser storage does not break shopping or theme controls", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException("Blocked", "SecurityError"); };
    Storage.prototype.setItem = () => { throw new DOMException("Blocked", "SecurityError"); };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Add Fresh milk", exact: true }).click();
  await expect(page.locator(".total-row")).toContainText("₹80");
  expect(errors).toEqual([]);
});
