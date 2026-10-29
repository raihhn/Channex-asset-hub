import { expect, test } from "@playwright/test";
test("database inventory survives reload and displays source photos and corrected warehouses", async ({
  page,
  request,
}) => {
  const api = await request.get("/api/assets", {
    headers: { "x-prototype-actor-id": "dev-user" },
  });
  expect(api.ok()).toBe(true);
  const { assets } = await api.json();
  expect(assets).toHaveLength(1073);
  const wall = assets.find(
    (asset: { importInfo: { sheet: string; row: number } }) =>
      asset.importInfo.sheet === "ALL BRAND (Gd.Internal)" &&
      asset.importInfo.row === 2,
  );
  const vendor = assets.find(
    (asset: { importInfo: { sheet: string; row: number } }) =>
      asset.importInfo.sheet === "ALL BRAND (Storedev)" &&
      asset.importInfo.row === 4,
  );
  expect(vendor.location).toBe("Dua Garis Imagi — Jatim");
  expect((await request.get("/api/assets")).status()).toBe(403);
  expect((await request.get(wall.photos[0].url)).status()).toBe(200);
  expect(
    (
      await request.get(
        wall.photos[0].url.replace(
          /signature=[a-f0-9]+/,
          "signature=" + "0".repeat(64),
        ),
      )
    ).status(),
  ).toBe(403);
  await page.goto("/assets");
  await expect(page.getByText("1073", { exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search assets", exact: true })
    .fill("Totem Skybridge");
  await page
    .getByRole("link", { name: "View Totem Skybridge — WALL A", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Totem Skybridge — WALL A",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Source details/ }).click();
  await expect(
    page.getByText("Event / collection: BST-2025", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".asset-gallery img")).toBeVisible();
  expect(
    await page
      .locator(".asset-gallery img")
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Totem Skybridge — WALL A",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto(`/assets/${vendor.id}`);
  await page.getByRole("button", { name: /Source details/ }).click();
  await expect(
    page.getByText("Warehouse: Dua Garis Imagi — Jatim", { exact: true }),
  ).toBeVisible();
});
