import { expect, test } from "@playwright/test";

test("requests include every booking state with usable filters and bounded search", async ({
  page,
}, testInfo) => {
  await page.goto("/requests");
  await expect(
    page.getByRole("link", { name: /^View request REQ-/ }),
  ).toHaveCount(9);
  await page.getByRole("tab", { name: /Use & returns/ }).click();
  await expect(
    page.getByRole("link", { name: "View request REQ-2026-030" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View request REQ-2026-031" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View request REQ-2026-032" }),
  ).toBeVisible();
  await page.getByLabel("Search requests").fill("Lighting");
  await expect(
    page.getByRole("link", { name: /^View request REQ-/ }),
  ).toHaveCount(1);
  await page.getByLabel("Search requests").fill("");
  await page.getByRole("tab", { name: /All requests/ }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/assethub-requests-${testInfo.project.name}.png`,
  });
});

test("return notifications link directly to the existing booking, with forms closed initially", async ({
  page,
}, testInfo) => {
  await page.goto("/requests");
  await page
    .getByRole("button", { name: "Operational alerts", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Return notifications" });
  await expect(dialog).toContainText("Colorfit Roadshow");
  await dialog.getByRole("link", { name: /Colorfit Roadshow/ }).click();
  await expect(page).toHaveURL(/REQ-2026-030\/return/);
  await expect(
    page.getByRole("heading", { name: "Return tracking", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Upload Loading-out letter")).toBeHidden();
  const pending = page
    .locator(".return-item-card")
    .filter({ hasText: "Colorfit Product Wall" });
  await pending
    .getByRole("button", { name: "Prepare return", exact: true })
    .click();
  await expect(pending.getByLabel("Upload Loading-out letter")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/assethub-return-${testInfo.project.name}.png`,
  });
});

test("transfer tracking stays separate and location updates only after actual arrival", async ({
  page,
}, testInfo) => {
  await page.goto("/requests/REQ-2026-031/return");
  await page
    .getByRole("button", { name: "Inspect returned asset", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark inspection clear", exact: true })
    .click();
  await expect(page.locator(".return-item-card")).toContainText(
    "Inspection completed",
  );
  if (testInfo.project.name === "mobile")
    await page
      .getByRole("banner")
      .getByRole("link", { name: "View your profile" })
      .click();
  await page
    .getByRole("link", { name: /Transfers|Transfer \/ handover/ })
    .click();
  await page
    .locator(".hero-select")
    .filter({ hasText: "Asset" })
    .getByRole("button")
    .click();
  await page.getByRole("searchbox", { name: "Search Asset", exact: true }).fill("Roadshow Consultation Counter");
  await page
    .getByRole("option", { name: /Roadshow Consultation Counter/ })
    .click();
  await page
    .locator(".hero-select")
    .filter({ hasText: "Destination" })
    .getByRole("button")
    .click();
  await page.getByRole("searchbox", { name: "Search Destination", exact: true }).fill("ofsorts jakarta");
  await page
    .getByRole("option", { name: /Ofsorts — Jakarta/ })
    .click();
  await page.getByLabel("Responsible party").fill("Planned receiver");
  for (const view of ["Front", "Left side", "Detail"])
    await page
      .locator(".transfer-evidence__item")
      .filter({ hasText: view })
      .click();
  await page
    .getByRole("button", { name: "Submit for confirmation", exact: true })
    .click();
  const transfer = page.getByLabel(/^Transfer transfer-/);
  await expect(transfer).toContainText("Awaiting dispatch");
  await transfer
    .getByRole("button", { name: "Confirm transfer dispatch", exact: true })
    .click();
  await page.getByLabel("Transfer sending PIC").fill("Sending PIC");
  await page
    .getByRole("button", { name: "Confirm dispatched transfer", exact: true })
    .click();
  await expect(transfer).toContainText("In transit");
  await page.getByLabel("Transfer receiving PIC").fill("Warehouse receiver");
  await page
    .getByRole("button", { name: "Confirm received transfer", exact: true })
    .click();
  await expect(transfer).toContainText("Warehouse receiver");
  await expect(
    transfer.getByRole("button", { name: /Confirm transfer/ }),
  ).toHaveCount(0);
  await page.screenshot({
    path: `/tmp/assethub-transfer-${testInfo.project.name}.png`,
  });
  if (testInfo.project.name === "mobile")
    await page
      .getByRole("banner")
      .getByRole("link", { name: "View your profile" })
      .click();
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await page
    .getByRole("link", { name: /Roadshow Consultation Counter/ })
    .click();
  await expect(
    page.getByText("Ofsorts — Jakarta", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Warehouse receiver", { exact: true }),
  ).toBeVisible();
});

test("direct return tracking renders receipt timestamps and closed forms without hydration errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/requests/REQ-2026-030/return");
  await expect(
    page.locator(".return-item-card").filter({ hasText: "Colorfit Pavilion" }),
  ).toContainText("3 Oct 2026");
  await expect(page.getByLabel("Upload Loading-out letter")).toHaveCount(0);
  expect(errors).toEqual([]);
});
