import { expect, test } from "@playwright/test";
test("pending booking shows tracking and opens approval controls only on demand", async ({
  page,
}, testInfo) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  await page.goto("/requests/REQ-2026-022");
  await expect(page.getByLabel("Current request step")).toContainText(
    "Awaiting approval",
  );
  await expect(page.getByLabel("Request review")).toBeHidden();
  await page.screenshot({
    path: `/tmp/assethub-detail-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await expect(page.getByLabel("Financial references")).toBeHidden();
  await page
    .getByRole("button", { name: "Manage approval", exact: true })
    .click();
  await expect(page.getByLabel("Request review")).toBeVisible();
  const disclosure = page.getByRole("button", {
    name: "Budget and references",
    exact: true,
  });
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Financial references")).toBeVisible();
  await disclosure.press("Enter");
  await expect(page.getByLabel("Financial references")).toBeHidden();
  expect(runtimeErrors).toEqual([]);
});
test("approved booking keeps delivery and references behind explicit actions", async ({
  page,
}) => {
  await page.goto("/requests/REQ-2026-014");
  await expect(page.getByLabel("Current request step")).toContainText(
    "Preparing delivery",
  );
  await expect(page.getByLabel("Request outbound")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Manage delivery", exact: true })
    .click();
  await expect(page.getByLabel("Request outbound")).toBeVisible();
  await page
    .getByRole("button", { name: "Review history", exact: true })
    .click();
  await expect(page.getByLabel("Request review")).toBeVisible();
});
test("historical in-use booking shows linked return without invented outbound", async ({
  page,
}) => {
  await page.goto("/requests/REQ-2026-009");
  await expect(page.getByLabel("Request return")).toBeVisible();
  await expect(page.getByLabel("Request outbound")).toHaveCount(0);
  await expect(page.getByLabel("Request return")).toContainText(
    "Receipt evidence unavailable",
  );
});
