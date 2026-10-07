import { expect, test } from "@playwright/test";

const image = {
  name: "evidence.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64"),
};

test("maintenance requires real Before/After evidence and internal acceptance", async ({ page }) => {
  await page.goto("/maintenance/new?assetId=wardah-glow-pavilion");
  await page.getByLabel("Reason / scope of work").fill("Repair surface finish");
  await page.getByRole("button", { name: "Create maintenance" }).click();
  await expect(page.getByRole("heading", { name: "Glow Pavilion 4×6" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start work" })).toBeDisabled();
  await page.locator(".hero-select").filter({ hasText: "Registered Vendor" }).locator("button").click();
  await page.getByRole("option", { name: "Vendor Prima" }).click();
  await page.getByRole("button", { name: "Assign Vendor" }).click();
  await expect(page.getByRole("button", { name: "Start work" })).toBeDisabled();
  await page.getByLabel("Upload Before Photo").setInputFiles(image);
  await expect(page.getByRole("button", { name: "Start work" })).toBeEnabled();
  await page.getByRole("button", { name: "Start work" }).click();
  await page.getByLabel("Vendor completion reported by").fill("Vendor representative");
  await expect(page.getByRole("button", { name: "Mark Vendor work completed" })).toBeDisabled();
  await page.getByLabel("Upload After Photo").setInputFiles(image);
  await page.getByRole("button", { name: "Mark Vendor work completed" }).click();
  await expect(page.getByRole("button", { name: "Accept maintenance" })).toBeDisabled();
  await page.locator(".hero-select").filter({ hasText: "Condition after" }).locator("button").click();
  await page.getByRole("option", { name: "Good" }).click();
  await page.getByRole("button", { name: "Accept maintenance" }).click();
  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "AH-BO-014" }).click();
  await expect(page.getByRole("link", { name: /MNT-/ })).toBeVisible();
});

test("Return handoff offers Maintenance only after a confirmed receipt", async ({ page }) => {
  await page.goto("/requests/REQ-2026-030/return");
  await expect(page.getByRole("link", { name: "Create maintenance for this returned Asset" }).first()).toBeVisible();
});

test("rejected Vendor work stays blocked and requires new After Photo", async ({ page }) => {
  await page.goto("/maintenance/new?assetId=wardah-glow-pavilion");
  await page.getByLabel("Reason / scope of work").fill("Repair panel");
  await page.getByRole("button", { name: "Create maintenance" }).click();
  await page.locator(".hero-select").filter({ hasText: "Registered Vendor" }).locator("button").click();
  await page.getByRole("option", { name: "Vendor Prima" }).click();
  await page.getByRole("button", { name: "Assign Vendor" }).click();
  await page.getByLabel("Upload Before Photo").setInputFiles(image);
  await page.getByRole("button", { name: "Start work" }).click();
  await page.getByLabel("Upload After Photo").setInputFiles(image);
  await page.getByLabel("Vendor completion reported by").fill("Vendor representative");
  await page.getByRole("button", { name: "Mark Vendor work completed" }).click();
  await page.getByLabel("Send-back reason").fill("Finish is uneven");
  await page.getByRole("button", { name: "Send back for rework" }).click();
  await expect(page.getByText("On hold", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Resume work/ }).click();
  await page.getByLabel("Vendor completion reported by").fill("Vendor representative");
  await expect(page.getByRole("button", { name: "Mark Vendor work completed" })).toBeDisabled();
  await page.getByLabel("Upload After Photo").setInputFiles(image);
  await page.getByRole("button", { name: "Mark Vendor work completed" }).click();
  await expect(page.getByText("Work completed", { exact: true })).toBeVisible();
});
