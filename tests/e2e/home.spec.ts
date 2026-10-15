import { expect, test } from "@playwright/test";

test("home searches inventory with Enter, clear, and the search action", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByRole("search", { name: "Inventory search" });
  const input = search.getByRole("searchbox", { name: "Find an asset" });
  await input.fill("Wardah");
  await search.getByRole("button", { name: "Clear inventory search" }).click();
  await expect(input).toHaveValue("");
  await input.fill("Kahf");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/assets\?q=Kahf$/);
  await expect(
    page.getByRole("textbox", { name: "Search assets", exact: true }),
  ).toHaveValue("Kahf");
  await expect(page.locator(".inventory-results .asset-card")).toHaveCount(1);
  await page.goto("/");
  await input.fill("Pro Studio");
  await search.getByRole("button", { name: "Search inventory" }).click();
  await expect(page).toHaveURL(/\/assets\?q=Pro%20Studio$/);
  await expect(page.locator(".inventory-results .asset-card")).toHaveCount(1);
});

test("home exposes operational follow-up, asset details, and the request entry", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hello, Raihan." }),
  ).toBeVisible();
  const attention = page.getByRole("region", { name: "Needs attention" });
  await expect(attention).toContainText("Return due");
  await expect(attention).toContainText("1 open issue");
  await attention.getByRole("link", { name: /Colorfit Roadshow/ }).click();
  await expect(page).toHaveURL(/\/requests\/REQ-2026-030$/);
  await page.goto("/");
  await page
    .getByRole("region", { name: "Ready to reuse" })
    .locator('a[href="/assets/wardah-glow-pavilion"]')
    .click();
  await expect(page).toHaveURL(/\/assets\/wardah-glow-pavilion$/);
  await page.goto("/");
  await page
    .getByRole("button", { name: /New request|Create request/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/request\/new$/);
  await expect(
    page.getByRole("heading", { name: "Build a request" }),
  ).toBeVisible();
});

test("home keeps one bounded search and removes duplicate page menus", async ({
  page,
}) => {
  await page.goto("/");
  const bounds = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(bounds.content).toBeLessThanOrEqual(bounds.width);
  const search = await page
    .getByRole("search", { name: "Inventory search" })
    .boundingBox();
  const attention = await page
    .getByRole("region", { name: "Needs attention" })
    .boundingBox();
  expect(search!.y).toBeLessThan(attention!.y);
  expect(search!.width).toBeLessThanOrEqual(672);
  await expect(page.getByRole("region", { name: "Quick actions" })).toHaveCount(
    0,
  );
  await expect(
    page
      .getByRole("banner")
      .getByRole("textbox", { name: "Search assets and requests" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Requests in motion" }),
  ).not.toContainText("Completed");
  await expect(
    page
      .getByRole("region", { name: "Recent submissions" })
      .getByRole("link")
      .first(),
  ).toContainText("REQ-2026-022");
});

test("home review follow-up comes from the assigned Person, not a role label", async ({
  page,
}) => {
  await page.goto("/requests/REQ-2026-022");
  await page
    .getByRole("button", { name: "Manage approval", exact: true })
    .click();
  await page
    .locator(".hero-select")
    .filter({ hasText: "Assign reviewer" })
    .locator("button")
    .click();
  await page.getByRole("option", { name: /Dian Rahma/ }).click();
  await page
    .getByRole("button", { name: "Assign reviewer", exact: true })
    .click();
  await expect(page.getByText("Pending review")).toBeVisible();
  for (const [name, firstName, expected] of [
    ["Dian Rahma", "Dian", 1],
    ["Nadia Prasetyo", "Nadia", 0],
  ] as const) {
    await page
      .getByRole("banner")
      .getByRole("link", { name: "View your profile" })
      .click();
    await page
      .locator(".hero-select")
      .filter({ hasText: "Current prototype user" })
      .locator("button")
      .click();
    await page.getByRole("option", { name: new RegExp(name) }).click();
    // Keyboard navigation also avoids the Next dev indicator covering mobile Today.
    const home = page.getByRole("link", { name: "Today", exact: true });
    await home.focus();
    await home.press("Enter");
    await expect(
      page.getByRole("heading", { name: `Hello, ${firstName}.` }),
    ).toBeVisible();
    const attention = page.getByRole("region", { name: "Needs attention" });
    await expect(
      attention.getByRole("link", { name: /Wardah Colorfit Preview/ }),
    ).toHaveCount(expected);
    await expect(
      attention.getByRole("link", { name: /Approval inbox/ }),
    ).toHaveCount(expected);
  }
});
