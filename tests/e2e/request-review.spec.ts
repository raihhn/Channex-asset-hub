import { expect, test, type Page } from "@playwright/test";

const requestId = "REQ-2026-022";

async function assign(page: Page, reviewer: string) {
  await page.goto(`/requests/${requestId}`);
  await page.locator(".hero-select").filter({ hasText: "Assign reviewer" }).locator("button").click();
  await page.getByRole("option", { name: new RegExp(reviewer) }).click();
  await page.getByRole("button", { name: "Assign reviewer", exact: true }).click();
  await expect(page.getByText(`Pending review`)).toBeVisible();
}

async function switchUser(page: Page, name: string) {
  await page.locator(".app-header").getByRole("link", { name: "View your profile" }).click();
  await page.locator(".hero-select").filter({ hasText: "Current prototype user" }).locator("button").click();
  await page.getByRole("option", { name: new RegExp(name) }).click();
  await page.getByRole("link", { name: "My requests" }).click();
  await page.getByRole("link", { name: `View request ${requestId}` }).click();
}

test("manual review approval records canonical reviewer and audit", async ({ page }) => {
  await assign(page, "Dian Rahma");
  await switchUser(page, "Dian Rahma");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("heading", { name: "Approval / Review" })).toBeVisible();
  await expect(page.getByLabel("Request review")).toContainText("Approved");
  await expect(page.getByLabel("Request review")).toContainText("Dian Rahma");
  await page.locator(".app-header").getByRole("link", { name: "View your profile" }).click();
  await page.locator(".hero-select").filter({ hasText: "Current prototype user" }).locator("button").click();
  await page.getByRole("option", { name: /Raihan Pradana/ }).click();
  await page.getByRole("link", { name: /Audit Trail/ }).click();
  await expect(page.getByText(`Approved ${requestId} by Dian Rahma`)).toBeVisible();
});

test("reassignment retains previous reviewer and non-assignee cannot decide", async ({ page }) => {
  await assign(page, "Dian Rahma");
  await page.locator(".hero-select").filter({ hasText: "Reassign reviewer" }).locator("button").click();
  await page.getByRole("option", { name: /Nadia Prasetyo/ }).click();
  await page.getByRole("button", { name: "Reassign reviewer", exact: true }).click();
  await expect(page.getByLabel("Request review")).toContainText("Previous reviewer: Dian Rahma");
  await switchUser(page, "Dian Rahma");
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(page.getByLabel("Request review")).toContainText("Only Nadia Prasetyo can decide");
});

test("Reject requires reason and remains non-blocking after decision", async ({ page }) => {
  await assign(page, "Dian Rahma");
  await switchUser(page, "Dian Rahma");
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByLabel("Request review").getByRole("alert")).toContainText("requires a reason");
  await page.getByLabel("Decision note").fill("Insufficient logistics information");
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByLabel("Request review")).toContainText("Rejected");
  await expect(page.getByLabel("Request review")).toContainText("Insufficient logistics information");
});

test("Needs Update reopens the same Request with its selections and review history", async ({ page }) => {
  await assign(page, "Dian Rahma");
  await switchUser(page, "Dian Rahma");
  await page.getByLabel("Decision note").fill("Clarify the venue address");
  await page.getByRole("button", { name: "Needs Update" }).click();
  await expect(page.getByLabel("Request review")).toContainText("Revision required");
  await page.getByRole("link", { name: "Edit and resubmit this Request" }).click();
  await expect(page.getByLabel("Project name")).toHaveValue("Wardah Colorfit Preview");
  await page.getByLabel("Project name").fill("Wardah Colorfit Preview — revised");
  await page.getByLabel("Budget code (required)").fill("BUD-001");
  if ((page.viewportSize()?.width ?? 0) < 768) await page.getByRole("button", { name: "Choose assets" }).click();
  else await page.getByRole("button", { name: "Select assets", exact: true }).first().click();
  await expect(page.getByText("Glow Pavilion 4×6").first()).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).first().click();
  await page.getByRole("button", { name: /Review request/ }).first().click();
  await page.getByRole("button", { name: "Submit request" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/requests/${requestId}$`));
  await expect(page.getByLabel("Request review")).toContainText("Cycle 2");
  await expect(page.getByLabel("Request review")).toContainText("Clarify the venue address");
  await expect(page.getByLabel("Request review")).toContainText("Reviewer assignment required");
});
