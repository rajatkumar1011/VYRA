import { test, expect } from "@playwright/test";

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1280, 720],
  [1024, 768],
  [960, 600],
  [900, 700],
  [768, 1024],
  [390, 844],
  [320, 740],
]) {
  test(`storefront fits ${width} × ${height}, with a full basket`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(() =>
      localStorage.setItem(
        "vyra-basket",
        JSON.stringify({
          milk: 2,
          bread: 1,
          rice: 1,
          atta: 1,
          dal: 1,
          oil: 1,
          tomato: 1,
          onion: 1,
          sugar: 1,
          eggs: 1,
          potato: 1,
        }),
      ),
    );
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Review order", exact: true }),
    ).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const copy = await page.locator(".voice-copy").boundingBox();
    if (await page.locator(".voice-orbit").isVisible()) {
      const orb = await page.locator(".voice-orbit").boundingBox();
      expect(copy!.x + copy!.width).toBeLessThanOrEqual(orb!.x);
    }
    const controls = await page.locator(".voice-controls").boundingBox();
    const hero = await page.locator(".voice-upper").boundingBox();
    expect(controls!.x + controls!.width).toBeLessThanOrEqual(
      hero!.x + hero!.width,
    );
    expect(controls!.y + controls!.height).toBeLessThanOrEqual(
      hero!.y + hero!.height,
    );
    if (await page.locator(".basket").evaluate((el) => getComputedStyle(el).position === "sticky")) {
      await page.locator(".basket-shortcut").click();
      await expect.poll(async () => {
        const basket = await page.locator(".basket").boundingBox();
        return basket!.y + basket!.height;
      }).toBeLessThanOrEqual(height);
    }
    const input = page.getByRole("textbox", { name: "Message VYRA" });
    await input.scrollIntoViewIfNeeded();
    await expect(input).toBeVisible();
    await page
      .getByRole("button", { name: "Review order", exact: true })
      .click();
    await expect(page.locator("dialog")).toBeVisible();
    await page
      .getByRole("button", { name: "Confirm demo order", exact: true })
      .scrollIntoViewIfNeeded();
    const button = await page
      .getByRole("button", { name: "Confirm demo order", exact: true })
      .boundingBox();
    expect(button!.y).toBeGreaterThanOrEqual(0);
    expect(button!.y + button!.height).toBeLessThanOrEqual(height);
    await page.getByRole("button", { name: "Back to basket" }).click();
    await expect(page.locator("dialog")).not.toBeVisible();
    await page.evaluate(() => scrollTo(0, 0));
    if ([1366, 1024, 390].includes(width))
      await page.screenshot({ path: `.preview/screenshots/verified-${width}.png` });
  });
}

test("catalog, conversation, checkout and navigation remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Spoken replies").uncheck();
  await page.getByRole("textbox", { name: "Search products" }).fill("milk");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Add Fresh milk", exact: true })
    .click();
  await expect(page.locator(".basket-line")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Message VYRA" }).fill("2 bread");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".basket-line")).toHaveCount(2);
  await expect(page.locator(".total-row")).toContainText("₹170");
  await page.getByRole("button", { name: "Review order", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm demo order", exact: true })
    .click();
  await expect(page.locator("dialog")).toContainText("Order received");
  await page.getByRole("button", { name: "View in Shopkeeper" }).click();
  await expect(page.locator(".order-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Start packing" }).click();
  await page.getByRole("button", { name: "Mark ready" }).click();
  await expect(
    page.locator(".board-column").last().locator(".order-card"),
  ).toHaveCount(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(1280);
  await page.getByRole("button", { name: "Storefront", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Shop your everyday essentials." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
