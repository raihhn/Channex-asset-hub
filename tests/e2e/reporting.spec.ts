import { expect, test, type Page } from "@playwright/test";

const evidence = {
  name: "evidence.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64"),
};

async function openReportsWithoutReload(page: Page) {
  const desktopLink = page.getByRole("link", { name: "Reports", exact: true });
  if (await desktopLink.isVisible()) {
    await desktopLink.click();
  } else {
    await page.getByRole("banner").getByRole("link", { name: "View your profile" }).click();
    await page.getByRole("link", { name: /Reports/ }).click();
  }
}

async function applyReport(page: Page, from = "2026-08-01", to = "2026-10-31") {
  const fromInput = page.getByLabel("From Date");
  const toInput = page.getByLabel("To Date");
  await fromInput.fill(from);
  await toInput.fill(to);
  if (await fromInput.inputValue() !== from) await fromInput.fill(from);
  if (await toInput.inputValue() !== to) await toInput.fill(to);
  await expect(fromInput).toHaveValue(from);
  await expect(toInput).toHaveValue(to);
  await page.getByRole("button", { name: "Apply report" }).click();
  await expect(page.getByRole("region", { name: "Operational history results" })).toBeVisible();
}

test("report requires a bounded range and shows newest operational records first", async ({ page }) => {
  await page.goto("/reports");
  await expect(page.getByText("No all-time history or export is available.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export filtered CSV" })).toHaveCount(0);
  await page.getByRole("button", { name: "Apply report" }).click();
  await expect(page.getByText("Choose both From Date and To Date.")).toBeVisible();
  await applyReport(page);
  const rows = page.getByRole("region", { name: "Operational history results" }).getByRole("listitem");
  await expect(page.getByRole("heading", { name: /Activity · \d+ records/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export filtered CSV" })).toBeEnabled();
  await expect(rows.first()).toContainText("Return received");
});

test("brand plus operation filter narrows the bounded result and CSV contains only that result", async ({ page }) => {
  await page.goto("/reports");
  const moreFilters = page.getByRole("button", { name: "More filters" });
  if (await moreFilters.isVisible()) await moreFilters.click();
  await page.locator(".hero-select").filter({ hasText: "Brand" }).locator("button").click();
  await page.getByRole("option", { name: "Emina" }).click();
  await page.locator(".hero-select").filter({ hasText: "Operation type" }).locator("button").click();
  await page.getByRole("option", { name: "Request" }).click();
  await applyReport(page);
  const result = page.getByRole("listitem").filter({ hasText: "Request submitted" });
  await expect(result).toHaveCount(1);
  await expect(result).toContainText("Emina");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export filtered CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("2026-08-01-to-2026-10-31");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv).toContain("Emina School Holiday activation");
  expect(csv).not.toContain("Return received");
  expect(csv).not.toContain("Wardah Colorfit Preview");
});

test("manual Request PR is filterable in Report and writes an Audit Trail mutation", async ({ page }) => {
  await page.goto("/requests/REQ-2026-022");
  await page.getByLabel("Financial reference number").fill("PR-REPORT-E2E");
  await page.getByRole("button", { name: "Add reference" }).click();
  await expect(page.getByLabel("Financial references")).toContainText("PR-REPORT-E2E");
  await openReportsWithoutReload(page);
  await expect(page.getByRole("heading", { name: "Operational history" })).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) < 1024) await page.getByRole("button", { name: "More filters" }).click();
  await page.getByLabel("Reference number filter").fill("PR-REPORT-E2E");
  await applyReport(page, "2026-10-01", "2026-10-31");
  await expect(page.getByRole("heading", { name: "Activity · 2 records" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "PR Number added" })).toContainText("PR-REPORT-E2E");
  const masterData = page.getByRole("link", { name: "Master Data" });
  if (await masterData.isVisible()) await masterData.click();
  else {
    await page.getByRole("banner").getByRole("link", { name: "View your profile" }).click();
    await page.getByRole("link", { name: "Administration" }).click();
  }
  await page.getByRole("link", { name: "Audit Trail", exact: true }).first().click();
  await expect(page.getByText("PR Number added to REQUEST REQ-2026-022")).toBeVisible();
  await page.getByText("View details").press("Enter");
  await expect(page.getByText("value: — → PR-REPORT-E2E")).toBeVisible();
});

test("completed legacy request does not manufacture Return received, but linked receipt does", async ({ page }) => {
  await page.goto("/reports");
  await applyReport(page);
  await expect(page.getByRole("listitem").filter({ hasText: "REQ-2026-004" }).filter({ hasText: "Return received" })).toHaveCount(0);
  await expect(page.getByRole("listitem").filter({ hasText: "REQ-2026-030" }).filter({ hasText: "Return received" })).toHaveCount(1);
});

test("Vendor work completion and internal Maintenance acceptance remain separate report events", async ({ page }) => {
  await page.goto("/maintenance/new?assetId=wardah-glow-pavilion");
  await page.getByLabel("Reason / scope of work").fill("Report lifecycle check");
  await page.getByRole("button", { name: "Create maintenance" }).click();
  await page.locator(".hero-select").filter({ hasText: "Registered Vendor" }).locator("button").click();
  await page.getByRole("option", { name: "Vendor Prima" }).click();
  await page.getByRole("button", { name: "Assign Vendor" }).click();
  await page.getByLabel("Upload Before Photo").setInputFiles(evidence);
  await page.getByRole("button", { name: "Start work" }).click();
  await page.getByLabel("Upload After Photo").setInputFiles(evidence);
  await page.getByLabel("Vendor completion reported by").fill("Vendor representative");
  await page.getByRole("button", { name: "Mark Vendor work completed" }).click();
  await openReportsWithoutReload(page);
  await applyReport(page, "2026-01-01", "2026-12-31");
  const results = page.getByRole("region", { name: "Operational history results" });
  const completed = results.getByRole("listitem").filter({ hasText: "Vendor work completed" });
  await expect(completed).toHaveCount(1);
  await expect(results.getByRole("listitem").filter({ hasText: "Maintenance accepted" })).toHaveCount(0);
  await completed.getByText("Details and references").press("Enter");
  await completed.getByRole("link", { name: "Open Maintenance" }).click();
  await page.locator(".hero-select").filter({ hasText: "Condition after" }).locator("button").click();
  await page.getByRole("option", { name: "Good" }).click();
  await page.getByRole("button", { name: "Accept maintenance" }).click();
  await openReportsWithoutReload(page);
  await applyReport(page, "2026-01-01", "2026-12-31");
  const updated = page.getByRole("region", { name: "Operational history results" });
  await expect(updated.getByRole("listitem").filter({ hasText: "Vendor work completed" })).toHaveCount(1);
  await expect(updated.getByRole("listitem").filter({ hasText: "Maintenance accepted" })).toHaveCount(1);
});
