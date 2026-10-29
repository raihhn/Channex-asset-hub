import { expect, test } from "@playwright/test";

test("transfer evidence and receiving owner gate an audited transfer plan", async ({
  page,
}) => {
  await page.goto("/transfers");
  const submit = page.getByRole("button", {
    name: "Submit for confirmation",
    exact: true,
  });
  await expect(submit).toBeDisabled();
  await page
    .locator(".hero-select")
    .filter({ hasText: "Destination" })
    .locator("button")
    .click();
  const destination = page.getByRole("option").first();
  await expect(destination).toBeVisible();
  await destination.click();
  await page.getByLabel("Responsible party").fill("Receiving PIC UI check");
  for (const view of ["Front", "Left side", "Detail"]) {
    await page
      .locator(".transfer-evidence__item")
      .filter({ hasText: view })
      .click();
  }
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(3);
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByLabel(/^Transfer transfer-/)).toContainText(
    "Awaiting dispatch",
  );
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page
      .getByRole("banner")
      .getByRole("link", { name: "View your profile" })
      .click();
    await page.getByRole("link", { name: /Audit Trail/ }).click();
  } else {
    await page.getByRole("link", { name: "Master Data" }).click();
    await page
      .locator(".admin-screen__quick-nav")
      .getByRole("link", { name: "Audit Trail" })
      .click();
  }
  await expect(
    page.getByText(/Submitted .*receiving party Receiving PIC UI check/),
  ).toBeVisible();
});

test("mobile selected-assets modal closes with Escape and restores focus", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile selection dock only");
  await page.goto("/request/new?assets=wardah-glow-pavilion");
  await page.getByLabel("WBS code (optional)").fill("UI-CHECK");
  await page.getByRole("button", { name: /Add reference/ }).click();
  await page.getByLabel("Budget code (required)").fill("UI-CHECK");
  await page.getByRole("button", { name: /Choose assets/ }).click();
  const trigger = page.locator(".mobile-selection-dock__count");
  await trigger.click();
  await expect(
    page.getByRole("dialog", { name: "Selected assets" }),
  ).toBeVisible();
  await expect(page.locator(".modal__container[data-entering]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
