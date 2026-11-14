import { test, expect } from "@playwright/test";

const publicRoutes = ["/ppdb", "/spmb/lacak", "/spmb/tes"];

for (const route of publicRoutes) {
  test(`${route} renders successfully`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).not.toContainText("Application error");
  });
}

test("tracking status API rejects unauthenticated access", async ({ request }) => {
  const response = await request.get("/api/spmb/track/status");
  expect(response.status()).toBe(401);
});

test("admin test page is reachable without exposing server errors", async ({ page }) => {
  const response = await page.goto("/spmb/tes/admin");
  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).not.toContainText("Application error");
});
