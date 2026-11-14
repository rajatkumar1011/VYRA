import { test, expect } from "@playwright/test";

test("voice consent is required before opening the microphone", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to VYRA", exact: true }).click();
  await expect(page.locator(".error-banner")).toContainText(
    "Please allow sending your voice clip",
  );
  await expect(
    page.getByRole("button", { name: "Talk to VYRA", exact: true }),
  ).toBeEnabled();
});

test("microphone rejection is recoverable and text remains usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied for test", "NotAllowedError");
    };
  });
  await page.goto("/");
  await page.getByLabel("Allow voice clips").check();
  await page.getByRole("button", { name: "Talk to VYRA", exact: true }).click();
  await expect(page.locator(".error-banner")).toContainText(
    "Microphone permission was denied",
  );
  await expect(
    page.getByRole("textbox", { name: "Message VYRA" }),
  ).toBeEnabled();
});

test("a speech provider failure preserves the successful basket update", async ({
  page,
}) => {
  await page.route("**/api/speech", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "Speech service unavailable for test." }),
    }),
  );
  await page.goto("/");
  await page.getByRole("textbox", { name: "Message VYRA" }).fill("1 milk");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".error-banner")).toContainText(
    "Speech service unavailable for test",
  );
  await expect(page.locator(".total-row")).toContainText("₹80");
  await expect(
    page.getByRole("button", { name: "Review order", exact: true }),
  ).toBeEnabled();
});

test("browser refresh restores the basket", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add Fresh milk", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".basket-line")).toHaveCount(1);
  await expect(page.locator(".total-row")).toContainText("₹80");
});
