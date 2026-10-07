import { expect, test } from "@playwright/test";

test("active application routes render and the retired UI option redirects", async ({
  page,
}) => {
  const routes = [
    "/",
    "/request/new",
    "/requests",
    "/operations",
    "/assets",
    "/transfers",
    "/requests/REQ-2026-021",
    "/assets/wardah-glow-pavilion",
    "/admin/events",
  ];
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status(), `${route} should render`).toBeLessThan(400);
    await expect(page.locator("body")).not.toContainText("Application error");
  }

  const requesterRoute = await page.goto("/requester");
  expect(requesterRoute?.status()).toBe(404);
  await page.goto("/operations");
  await expect(
    page.getByRole("heading", { name: "Operational calendar" }),
  ).toBeVisible();

  await page.goto("/ui-option-2");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading").first()).toBeVisible();

  await page.goto("/request/wardah-glow-pavilion");
  await expect(page).toHaveURL(/\/request\/new\?assets=wardah-glow-pavilion$/);
  await expect(
    page.getByRole("button", { name: /Choose assets/ }),
  ).toBeDisabled();
  await page.getByLabel("WBS code (optional)").fill("REQ-DETAIL-001");
  await page.getByRole("button", { name: /Add reference/ }).click();
  await page.getByLabel("Budget code (required)").fill("BUD-DETAIL-001");
  await page.getByRole("button", { name: /Choose assets/ }).click();
  await expect(
    page
      .locator(".request-asset.is-selected")
      .filter({ hasText: "Glow Pavilion 4×6" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Add Play Modular 2×2 to request",
      exact: true,
    })
    .click();
  await expect(
    page
      .locator(".request-asset.is-selected")
      .filter({ hasText: "Play Modular 2×2" }),
  ).toBeVisible();
});

test("Custom Booth passes the existing four-step flow without a physical Asset", async ({
  page,
}) => {
  await page.goto("/request/new");
  await page.getByRole("button", { name: "Ad-hoc Event" }).click();
  await page.getByLabel("Project name").fill("Wardah local content shoot");
  await page
    .getByLabel("Project-site PIC (name and contact)")
    .fill("Dian · 0812 3456 7890");
  await page.getByLabel("Length").fill("6");
  await page.getByLabel("Width").fill("4");
  await page.getByLabel("Height").fill("3");
  await page
    .getByLabel("Other event / venue details")
    .fill("Access from loading bay B");
  await page.getByLabel("Upload Loading-in letter").setInputFiles({
    name: "loading-in.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 prototype attachment"),
  });
  await page.getByLabel("Budget code (required)").fill("BUD-ADHOC-001");
  await expect(page.getByLabel("WBS code (optional)")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Choose assets/ }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /Choose assets/ }).click();
  await page
    .locator(".request-inventory__filters .hero-select")
    .filter({ hasText: "Booth requirement" })
    .locator("button")
    .click();
  await page.getByRole("option", { name: "Custom Booth" }).click();
  await expect(page.getByText(/No existing Asset is required/)).toBeVisible();
  await page.getByRole("button", { name: /Continue to fulfillment/ }).click();
  await page
    .getByRole("button", { name: "Review request →", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Submit request/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/requests\/REQ-2026-/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Wardah local content shoot",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Custom Booth · no existing Asset required"),
  ).toBeVisible();
  await expect(page.getByText("Dian · 0812 3456 7890")).toBeVisible();
  await expect(page.getByText("BUD-ADHOC-001")).toBeVisible();
  await expect(page.getByText("loading-in.pdf")).toBeVisible();
  await expect(page.getByText(/6 × 4 × 3 m/)).toBeVisible();
  await expect(page.getByText("Access from loading bay B")).toBeVisible();
  await expect(page.getByRole("link", { name: /View asset/ })).toHaveCount(0);
});

test("booth requirement is integrated with asset filters and master Events support parent-child records", async ({
  page,
}) => {
  await page.goto("/request/new");
  await expect(page.getByLabel("WBS code (optional)")).toBeVisible();
  await page.getByLabel("Budget code (required)").fill("BUD-BOOTH-001");
  await page.getByRole("button", { name: /Choose assets/ }).click();
  await page
    .locator(".request-inventory__filters .hero-select")
    .filter({ hasText: "Booth requirement" })
    .locator("button")
    .click();
  await page.getByRole("option", { name: "Regular Booth" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Select at least one available Booth asset" })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Continue to fulfillment/ }),
  ).toBeDisabled();

  await page.goto("/admin/events");
  const eventForm = page.locator(".event-master-form__grid");
  await eventForm.locator("input").nth(0).fill("Wardah Festival — Yogyakarta");
  await eventForm.locator("select").nth(0).selectOption({ label: "Wardah" });
  await eventForm.locator("input").nth(1).fill("Beauty Festival");
  await eventForm.locator("input").nth(2).fill("Pakuwon Mall Jogja");
  await eventForm.locator("input").nth(3).fill("Yogyakarta");
  await eventForm.locator("input").nth(4).fill("2026-09-20");
  await eventForm.locator("input").nth(5).fill("2026-09-22");
  await page
    .getByLabel("Parent event")
    .selectOption({ label: "Wardah Beauty Festival 2026" });
  await page.getByRole("button", { name: "Save event" }).click();
  await expect(
    page.getByText("Wardah Festival — Yogyakarta", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Wardah Festival — Yogyakarta" })
      .getByText("↳ Wardah Beauty Festival 2026", { exact: true }),
  ).toBeVisible();
});

test("Flow A: an available physical Asset submits with separate usage and logistics dates", async ({
  page,
}) => {
  await page.goto("/request/new");
  await page.getByLabel("Budget code (required)").fill("BUD-OPS-AVAILABLE");
  await page.getByRole("button", { name: /Choose assets/ }).click();
  await page
    .getByRole("button", {
      name: "Add Glow Pavilion 4×6 to request",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: /Continue to fulfillment/ }).click();
  await expect(
    page.getByText("Usage dates remain separate", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review request →", exact: true })
    .click();
  await expect(page.getByText("Loading in", { exact: true })).toBeVisible();
  await expect(page.getByText("Loading out", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/requests\/REQ-2026-/);
  await expect(page.getByText("Operational reservation")).toBeVisible();
  await expect(page.getByText("Glow Pavilion 4×6").first()).toBeVisible();
});

test("Flow B: a conflicting operational reservation is unavailable in Select Assets", async ({
  page,
}) => {
  await page.goto("/request/new");
  const eventPicker = page
    .locator(".request-context-card__fields .hero-select")
    .filter({ hasText: "Event / activation" });
  await eventPicker.locator("button").click();
  await page.getByRole("option", { name: /Gandaria City/ }).click();
  await page.getByLabel("Budget code (required)").fill("BUD-OPS-CONFLICT");
  await page.getByRole("button", { name: /Choose assets/ }).click();
  const glowCard = page
    .locator(".request-asset")
    .filter({ hasText: "Glow Pavilion 4×6" });
  await expect(glowCard).toContainText(
    "Reserved for Wardah Colorfit — Gandaria City",
  );
  await expect(
    glowCard.getByRole("button", { name: "Add Glow Pavilion 4×6 to request" }),
  ).toBeDisabled();
});

test("Flow D: changing Fulfillment dates surfaces a selected conflict and blocks review", async ({
  page,
}) => {
  await page.goto("/request/new");
  const eventPicker = page
    .locator(".request-context-card__fields .hero-select")
    .filter({ hasText: "Event / activation" });
  await eventPicker.locator("button").click();
  await page.getByRole("option", { name: /Kelapa Gading/ }).click();
  await page.getByLabel("Budget code (required)").fill("BUD-OPS-EDITED");
  await page.getByRole("button", { name: /Choose assets/ }).click();
  await page
    .getByRole("button", {
      name: "Add Glow Pavilion 4×6 to request",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: /Continue to fulfillment/ }).click();
  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByLabel("Loading-in date").fill("2026-10-14");
  await page.getByLabel("Loading-in time").fill("09:00");
  await page.getByLabel("Loading-out date").fill("2026-10-23");
  await page.getByLabel("Loading-out time").fill("17:00");
  await expect(
    page.getByText(
      /selected Asset now conflicts with another operational reservation/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review request →", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await expect(
    page.locator(".request-asset.is-selected.is-conflicted").filter({
      hasText: "Glow Pavilion 4×6",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue to fulfillment →" }),
  ).toBeDisabled();
});
