import { expect, test } from "@playwright/test";

test("renders the foundation shell with intentional navigation composition", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Operational clarity, before operational features.",
    }),
  ).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await expect(page.getByLabel("Mobile primary navigation")).toBeVisible();
    await expect(page.getByLabel("Desktop navigation")).toBeHidden();
  } else {
    await expect(page.getByLabel("Desktop navigation")).toBeVisible();
    await expect(page.getByLabel("Mobile primary navigation")).toBeHidden();
  }
});
