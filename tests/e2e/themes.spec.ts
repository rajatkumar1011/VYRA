import { test, expect } from "@playwright/test";

test("theme follows the system until a saved preference overrides it", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkAccent = await page.locator("body").evaluate((el) => getComputedStyle(el).getPropertyValue("--accent"));
  await page.getByRole("button", { name: "Light theme", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const lightAccent = await page.locator("body").evaluate((el) => getComputedStyle(el).getPropertyValue("--accent"));
  expect(lightAccent).not.toBe(darkAccent);
  await page.emulateMedia({ colorScheme: "light" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.getByRole("button", { name: "Light theme", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await page.getByRole("button", { name: "Shopkeeper", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

for (const theme of ["light", "dark"] as const) {
  test(`${theme} theme stays readable across desktop and phone layouts`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByRole("button", { name: "Talk to VYRA", exact: true })).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const smallText = await page.locator("main").evaluate((root) =>
        [...root.querySelectorAll<HTMLElement>("*")].filter((el) =>
          el.getClientRects().length > 0 &&
          getComputedStyle(el).visibility !== "hidden" &&
          !el.closest("svg, .sr-only, [aria-hidden='true']") &&
          [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) &&
          parseFloat(getComputedStyle(el).fontSize) < 16
        ).map((el) => el.className),
      );
      expect(smallText).toEqual([]);
      if (width !== 320) await page.screenshot({ path: `.preview/screenshots/modern-${theme}-${width}.png` });
    }
    await page.getByRole("textbox", { name: "Search products" }).fill("milk");
    await page.getByRole("button", { name: "Add Fresh milk", exact: true }).click();
    await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
    await expect(page.locator(".mobile-basket")).toBeVisible();
    await page.locator(".mobile-basket").click();
    await expect(page.locator(".mobile-basket")).not.toBeVisible();
    await page.getByRole("button", { name: "Review order", exact: true }).click();
    await expect(page.locator("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm demo order", exact: true })).toBeVisible();
    await page.screenshot({ path: `.preview/screenshots/modern-${theme}-review.png` });
  });
}
