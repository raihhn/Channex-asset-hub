import { expect, test } from "@playwright/test";

test("asset registration requires explicit package contents and converts opening stock", async ({
  page,
}) => {
  await page.goto("/assets");
  await page.getByRole("button", { name: "Add asset", exact: true }).click();
  await expect(page).toHaveURL(/\/assets\/new$/);
  await page
    .getByRole("textbox", { name: "Asset name", exact: true })
    .fill("Package conversion review");
  const warehouse = page
    .locator(".hero-select")
    .filter({ hasText: "Warehouse" });
  await warehouse.getByRole("button").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByText("Stock tracked by quantity", { exact: true }).click();
  const unit = page
    .locator(".hero-select")
    .filter({ hasText: "Unit of measure" });
  await unit.getByRole("button").click();
  await page.getByRole("option", { name: "Dus", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Opening quantity" }).fill("5");
  await page
    .getByText("Packaging may be opened; allow borrowing in Pcs", {
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("whole number");
  await page.getByRole("spinbutton", { name: "Pcs per package" }).fill("12");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("5 Dus = 60 Pcs", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Borrowing: Pcs or Dus; 1 Dus = 12 Pcs", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Register asset", exact: true })
    .click();
  await expect(
    page.getByText("Asset registered", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("fixed-unit borrowing shows a quantity without an unnecessary unit picker", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/assets", {
    headers: { "x-prototype-actor-id": "dev-user" },
  });
  const { assets } = await response.json();
  const asset = assets.find(
    (item: {
      supportsQuantity?: boolean;
      availableQuantity?: number;
      availability: string;
    }) =>
      item.supportsQuantity &&
      (item.availableQuantity ?? 0) >= 2 &&
      item.availability === "available",
  ) ?? {
    id: "wardah-lighting-kit",
    name: "Portable Lighting Kit",
    unitPolicy: { stockUnit: "Unit" },
  };
  await page.goto(`/request/new?assets=${asset.id}`);
  await page.getByLabel("Budget code (required)").fill("BUD-UOM");
  await page.getByRole("button", { name: /Choose assets/ }).click();
  await page
    .getByRole("searchbox", { name: "Search assets", exact: true })
    .fill(asset.name);
  const add = page.getByRole("button", {
    name: `Add one ${asset.name}`,
    exact: true,
  });
  await expect(add).toBeVisible();
  await add.click();
  await expect(add.locator("..")).toContainText(
    `2 ${asset.unitPolicy?.stockUnit ?? "Unit"}`,
  );
  await expect(
    page
      .locator(".hero-select")
      .filter({ hasText: `Borrowing unit for ${asset.name}` }),
  ).toHaveCount(0);
});
