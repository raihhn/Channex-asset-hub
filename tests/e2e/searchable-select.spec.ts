import { expect, test } from "@playwright/test";

test("destination search filters labels without committing text and preserves selection on Escape", async ({
  page,
}) => {
  await page.goto("/transfers");
  const destination = page
    .locator(".hero-select")
    .filter({ hasText: "Destination" });
  await destination.getByRole("button").click();
  const search = page.getByRole("searchbox", {
    name: "Search Destination",
    exact: true,
  });
  await search.fill("ofsorts jatim");
  await expect(
    page.getByRole("option", { name: "Ofsorts — Jatim", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Ofsorts — Jakarta", exact: true }),
  ).toHaveCount(0);
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(destination).toContainText("Ofsorts — Jatim");
  await expect(
    page.getByLabel("Responsible party", { exact: true }),
  ).toHaveValue(/Laura/);
  await destination.getByRole("button").click();
  await expect(search).toHaveValue("");
  await search.fill("nonexistent-warehouse");
  await expect(page.getByText("No matches. Try another search.")).toBeVisible();
  await search.press("Escape");
  await expect(destination).toContainText("Ofsorts — Jatim");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("New Request and Event Master choices use the same popup search", async ({
  page,
}) => {
  await page.goto("/request/new");
  const brand = page.locator(".hero-select").filter({ hasText: "Brand" });
  await brand.getByRole("button").click();
  await page
    .getByRole("searchbox", { name: "Search Brand", exact: true })
    .fill("emina");
  await page.getByRole("option", { name: "Emina", exact: true }).click();
  await expect(brand).toContainText("Emina");
  await page.goto("/admin/events");
  const parent = page
    .locator(".hero-select")
    .filter({ hasText: "Parent event" });
  await expect(parent).toContainText("No parent");
  await parent.getByRole("button").click();
  await page
    .getByRole("searchbox", { name: "Search Parent event", exact: true })
    .fill("colorfit");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(parent).toContainText("No parent");
});
