import { expect, test } from "@playwright/test";

test("Super Admin creates, edits, and inactivates a multi-role User with an audit trail", async ({ page }) => {
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "People / Users" })).toBeVisible();
  await page.getByRole("button", { name: "Add user" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Test Operator");
  await page.getByLabel("Email", { exact: true }).fill("test.operator@example.com");
  await page.getByRole("checkbox", { name: "Requester" }).check();
  await page.getByRole("checkbox", { name: "StoreDev" }).check();
  await page.getByRole("checkbox", { name: "Wardah" }).check();
  await page.getByRole("checkbox", { name: "Kahf" }).check();
  await page.getByRole("checkbox", { name: "Current Booth" }).check();
  await page.getByRole("checkbox", { name: "DC Jakarta" }).check();
  await page.getByRole("button", { name: "Save user" }).click();
  const row = page.locator(".grid > [data-slot=card]").filter({ hasText: "Test Operator" });
  await expect(row).toContainText("Requester");
  await expect(row).toContainText("StoreDev");
  await expect(row).toContainText("Wardah");
  await expect(row).toContainText("Kahf");
  await row.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("checkbox", { name: "Emina" }).check();
  await page.getByRole("button", { name: "Save user" }).click();
  await row.getByRole("button", { name: "Inactivate" }).click();
  await expect(row).toContainText("Inactive");
  await page.locator(".admin-screen__quick-nav").getByRole("link", { name: "Audit Trail" }).click();
  await expect(page.getByText("Inactivated Test Operator")).toBeVisible();
  await expect(page.getByText("Updated Test Operator:", { exact: false })).toBeVisible();
  await expect(page.getByText("Created Test Operator", { exact: false })).toBeVisible();
  await expect(page.locator("[data-slot=card]").filter({ hasText: "Inactivated Test Operator" })).toContainText("Raihan Pradana");
});

test("existing Maintenance Vendor assignment writes central audit without changing workflow", async ({ page }) => {
  await page.goto("/maintenance/new?assetId=wardah-glow-pavilion");
  await page.getByLabel("Reason / scope of work").fill("Repair surface");
  await page.getByRole("button", { name: "Create maintenance" }).click();
  await page.locator(".hero-select").filter({ hasText: "Registered Vendor" }).locator("button").click();
  await page.getByRole("option", { name: "Vendor Prima" }).click();
  await page.getByRole("button", { name: "Assign Vendor" }).click();
  await expect(page.getByText("Vendor assigned", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "← Operations" }).click();
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.getByRole("banner").getByRole("link", { name: "View your profile" }).click();
    await page.getByRole("link", { name: /Audit Trail/ }).click();
  } else {
    await page.getByRole("link", { name: "Master Data" }).click();
    await page.locator(".admin-screen__quick-nav").getByRole("link", { name: "Audit Trail" }).click();
  }
  await expect(page.getByText("Assigned Vendor vendor-prima")).toBeVisible();
  await expect(page.getByText("Created maintenance for Glow Pavilion 4×6")).toBeVisible();
});

test("non-Super-Admin prototype user cannot see global Audit Trail surface", async ({ page }) => {
  await page.goto("/me");
  await page.locator(".hero-select").filter({ hasText: "Current prototype user" }).locator("button").click();
  await page.getByRole("option", { name: /Nadia Prasetyo/ }).click();
  await page.getByRole("link", { name: "Administration" }).click();
  await expect(page.getByRole("link", { name: /Audit Trail/ })).toHaveCount(0);
});
