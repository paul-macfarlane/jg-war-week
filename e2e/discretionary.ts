import { type Locator, type Page, expect } from "@playwright/test";

/** Opens the Give Discretionary points Sheet on its page; returns its form. */
export async function openGiveForm(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Give Discretionary points" }).click();
  const form = page.getByRole("form", { name: "New Discretionary points" });
  await expect(form).toBeVisible();
  return form;
}

/**
 * Fills the Sheet's form the way a person does: the target by typing its
 * name and choosing the option, then the points and the reason.
 */
export async function fillDiscretionary(
  page: Page,
  form: Locator,
  {
    target,
    points,
    reason,
  }: { target: string; points: string; reason: string },
) {
  await form.getByRole("combobox", { name: /Participant$/ }).fill(target);
  await page.getByRole("option", { name: new RegExp(`^${target}`) }).click();
  await form.getByLabel("Points", { exact: true }).fill(points);
  await form.getByLabel("Reason", { exact: true }).fill(reason);
}
