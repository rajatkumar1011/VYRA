import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./.preview/test-results",
  workers: 1,
  use: { baseURL: "http://localhost:3000", headless: true },
  reporter: "list",
});
