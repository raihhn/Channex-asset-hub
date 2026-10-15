import { expect, test } from "@playwright/test";

test("approved request dispatches a batch and receives its assets independently", async ({
  page,
}) => {
  await page.goto("/requests/REQ-2026-014");
  await page
    .getByRole("button", { name: "Manage delivery", exact: true })
    .click();
  const panel = page.getByLabel("Request outbound");
  await expect(
    panel.getByRole("button", { name: "Confirm dispatched", exact: true }),
  ).toBeDisabled();
  await panel.getByLabel("Sending PIC").fill("Warehouse sender");
  await panel.getByLabel("Upload Loading-in letter").setInputFiles({
    name: "loading-in.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 local loading-in letter"),
  });
  await expect(
    panel.getByRole("link", { name: "loading-in.pdf" }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Confirm dispatched", exact: true })
    .click();
  await expect(panel).toContainText("2/2 dispatched");
  await expect(panel).toContainText("0/2 received");
  await expect(panel).toContainText("In transit · destination receipt pending");
  const receive = panel.getByRole("button", {
    name: "Confirm received at destination",
    exact: true,
  });
  await expect(receive).toBeDisabled();
  await panel.getByLabel("Receiving PIC at destination").fill("Event receiver");
  await panel
    .locator('[data-slot="checkbox-content"]')
    .filter({ hasText: "Portable Lighting Kit" })
    .click();
  await receive.click();
  await expect(panel).toContainText("1/2 received");
  await expect(panel).toContainText("Event receiver · Good");
  await expect(
    panel.getByRole("checkbox", { name: "Daily Glow POSM Kit", exact: true }),
  ).toHaveCount(0);
  await panel
    .getByLabel("Receiving PIC at destination")
    .fill("Second receiver");
  await panel
    .locator('[data-slot="checkbox-content"]')
    .filter({ hasText: "Portable Lighting Kit" })
    .click();
  await receive.click();
  await page
    .getByRole("button", { name: "Handover history", exact: true })
    .click();
  await expect(panel).toContainText("2/2 received");
  await expect(receive).toHaveCount(0);
  await page
    .getByRole("button", { name: "Schedule and routes", exact: true })
    .click();
  await expect(
    page.getByText("Actual outbound ·", { exact: false }).first(),
  ).toBeVisible();
  await page
    .locator(".request-record__items article")
    .filter({ hasText: "Daily Glow POSM Kit" })
    .getByRole("link", { name: "Daily Glow POSM Kit", exact: true })
    .click();
  await expect(
    page.getByText("AEON Mall BSD", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Event receiver", { exact: true }).first(),
  ).toBeVisible();
});

test("pending approval never exposes a dispatch mutation", async ({ page }) => {
  await page.goto("/requests/REQ-2026-022");
  await expect(page.getByLabel("Current request step")).toContainText(
    "Awaiting approval",
  );
  await expect(
    page.getByRole("button", { name: "Confirm dispatched", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Request outbound")).toHaveCount(0);
});
