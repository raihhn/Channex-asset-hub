import { expect, test, type Page } from "@playwright/test";

async function confirmKahfReturn(page: Page) {
  await page.goto("/requests/REQ-2026-009/return");
  const item = page
    .locator(".return-item-card")
    .filter({ hasText: "Mountain Booth 3×5" });
  await item.getByRole("button", { name: "Start Return" }).click();
  await expect(item).toContainText("Not received");
  await expect(item).toContainText("Jakarta Hub");
  await item
    .getByLabel("Receiving PIC for kahf-mountain-booth")
    .fill("Bima Receiver");
  await item
    .locator(".hero-select")
    .filter({ hasText: "Actual receiving location" })
    .locator("button")
    .click();
  await page
    .getByRole("option", { name: "Cakung Production Workshop · Jakarta Timur" })
    .click();
  await item
    .locator(".hero-select")
    .filter({ hasText: "Condition at receipt" })
    .locator("button")
    .click();
  await page.getByRole("option", { name: "Good" }).click();
  await item.getByRole("button", { name: "Confirm Received" }).click();
  return item;
}

test("normal Return requires initiation and explicit receiver confirmation", async ({
  page,
}) => {
  const item = await confirmKahfReturn(page);
  await expect(item).toContainText("Received · inspection pending");
  await expect(item).toContainText("Bima Receiver");
  await expect(item).toContainText("Cakung Production Workshop");
  await expect(item).not.toContainText("Not received");
  await page.getByRole("link", { name: "← Request detail" }).click();
  await expect(
    page.getByText("Actual inbound ·", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Mountain Booth 3×5" }).click();
  await expect(page.getByText("Bima Receiver", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Cakung Production Workshop", { exact: true }),
  ).toBeVisible();
});

test("partial Return keeps the other physical item overdue and without actual inbound", async ({
  page,
}) => {
  await page.goto("/requests/REQ-2026-030/return");
  const received = page
    .locator(".return-item-card")
    .filter({ hasText: "Colorfit Pavilion 3×3" });
  const outstanding = page
    .locator(".return-item-card")
    .filter({ hasText: "Colorfit Product Wall" });
  await expect(received).toContainText("Received · inspection pending");
  await expect(received).toContainText("3 Oct 2026");
  await expect(outstanding).toContainText("Overdue");
  await expect(outstanding).toContainText("Not received");
  await expect(outstanding).not.toContainText("Missing");
  await page.goto("/requests/REQ-2026-030");
  await expect(
    page.getByText("Received · inspection pending", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Overdue", { exact: true })).toBeVisible();
});

test("calendar shows Inbound Completed only after a linked receipt", async ({
  page,
}) => {
  await page.goto("/operations");
  await page.getByRole("button", { name: "Previous month" }).click();
  await page.getByRole("button", { name: "Previous month" }).click();
  const before = page
    .locator(".operational-calendar__bookings li")
    .filter({ hasText: "Mountain Booth 3×5" });
  await expect(before).toBeVisible();
  await expect(before).not.toContainText("Inbound Completed");

  await confirmKahfReturn(page);
  await page.getByRole("link", { name: "View operations calendar →" }).click();
  const after = page
    .locator(".operational-calendar__bookings li")
    .filter({ hasText: "Mountain Booth 3×5" });
  await expect(after).toContainText("Inbound Completed");
  await expect(after).toContainText("Actual inbound");
});

test("early receipt keeps planned inbound distinct and inspection pending", async ({
  page,
}) => {
  await page.goto("/requests/REQ-2026-031/return");
  const item = page
    .locator(".return-item-card")
    .filter({ hasText: "Roadshow Consultation Counter" });
  await expect(item).toContainText("2026-10-12 · 16:00");
  await expect(item).toContainText("4 Oct 2026");
  await expect(item).toContainText("Inspection pending");
  await page.goto("/assets/return-demo-counter");
  await expect(page.getByText("Not requestable right now")).toBeVisible();
});

test("legacy Completed request stays physically unconfirmed and reserved", async ({
  page,
}) => {
  await page.goto("/requests/REQ-2026-004");
  await expect(
    page.getByText(
      "Receipt evidence unavailable · physical return not confirmed",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Actual inbound ·", { exact: false }),
  ).toHaveCount(0);

  await page.goto("/assets/make-over-studio-counter");
  await expect(
    page.getByText("Receipt unconfirmed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "A completed request has no confirmed physical return receipt.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Request this asset" }),
  ).toHaveCount(0);

  await page.goto("/operations");
  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: "Previous month" }).click();
  }
  const booking = page
    .locator(".operational-calendar__bookings li")
    .filter({ hasText: "Pro Studio Counter" });
  await expect(booking).toContainText("Receipt evidence unavailable");
  await expect(booking).not.toContainText("Inbound Completed");
});
