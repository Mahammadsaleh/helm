import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function shot(page: Page, name: string) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `qa/screenshots/${test.info().project.name}/${name}.png` });
}

/** The scrollable app area; on desktop it sits inside the phone frame. */
const app = (page: Page) => page.locator("#helm-main");

const tab = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: new RegExp(`^${name}`) });

async function open(page: Page, query: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(`/?${query}`);
  await page.locator("[data-hydrated]").waitFor();
  await expect(app(page).getByRole("heading", { level: 1 })).toBeVisible();
  return errors;
}

async function expectNoSeriousA11y(page: Page) {
  const results = await new AxeBuilder({ page }).include("#helm-main").analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const main = document.getElementById("helm-main")!;
    return { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, main: main.scrollWidth - main.clientWidth };
  });
  expect(overflow.doc).toBeLessThanOrEqual(0);
  expect(overflow.main).toBeLessThanOrEqual(0);
}

test("08:30 morning brief: plan, overlaps and suggestions", async ({ page }) => {
  const errors = await open(page, "t=0830");
  await expect(app(page).getByText("Morning brief, analysed at")).toBeVisible();
  await expect(app(page).getByText(/overlaps ahead/).first()).toBeVisible();
  await expect(app(page).getByText("Suggested:").first()).toBeVisible();
  await shot(page, "01-today-0830");
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousA11y(page);
  expect(errors).toEqual([]);
});

test("10:05 interpreter cancels: call kit in three languages", async ({ page }) => {
  const errors = await open(page, "t=1005");
  await app(page).getByRole("button", { expanded: false }).filter({ hasText: "Call kit" }).click();
  await app(page).getByRole("button", { name: "Open Call Kit" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Machine translation.")).toBeVisible();
  await dialog.getByRole("button", { name: "Русский" }).click();
  await expect(dialog.getByRole("button", { name: "Русский" })).toHaveAttribute("aria-pressed", "true");
  await shot(page, "02-callkit-1005");
  await dialog.getByRole("button", { name: /Send Pre-read/ }).click();
  await expect(dialog.getByText(/Pre-read sent at/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});

test("13:16 press inquiry: infeasible deadline gets fixed by Make Time", async ({ page }) => {
  const errors = await open(page, "t=1316");
  const alert = app(page).getByText(/No time before 15:00/);
  await expect(alert).toBeVisible();
  await shot(page, "03-today-1316-infeasible");
  await app(page).getByRole("button", { name: "Make Time" }).first().click();
  await expect(alert).toBeHidden();
  await expect(app(page).getByText("Added by Helm").first()).toBeVisible();
  await shot(page, "04-today-1316-fixed");
  expect(errors).toEqual([]);
});

test("13:16 decide: confirm the press decision and send a delegation", async ({ page }) => {
  const errors = await open(page, "t=1316&tab=decide");
  await expect(app(page).getByRole("heading", { name: "Needs you" })).toBeVisible();
  await shot(page, "05-decide-1316");
  await expectNoSeriousA11y(page);
  const first = app(page).getByRole("article").first();
  const title = await first.getByRole("heading").textContent();
  await first.getByRole("button", { name: "Confirm" }).click();
  await expect(app(page).getByRole("heading", { name: "Decided today" })).toBeVisible();
  await expect(app(page).getByRole("list").getByText(title!).first()).toBeVisible();
  const drafts = app(page).getByRole("heading", { name: "Drafted for others" });
  if (await drafts.isVisible()) {
    await app(page).getByRole("button", { name: "Send" }).first().click();
    await expect(page.getByText(/\(simulated\)/).first()).toBeVisible();
  }
  await shot(page, "06-decide-1316-after");
  expect(errors).toEqual([]);
});

test("15:20 one-pager: CFO correction replaces the stale $18M figure", async ({ page }) => {
  const errors = await open(page, "t=1520&tab=onepager");
  await expect(app(page).getByText(/Replaced at 15:12/).first()).toBeVisible();
  const struck = app(page).locator(".strike-old", { hasText: "$18M" });
  await expect(struck.first()).toBeVisible();
  await expect(app(page).getByText("$18.6M").first()).toBeVisible();
  await shot(page, "07-onepager-1520");
  await expectNoSeriousA11y(page);
  await app(page).getByRole("button", { name: /Review and Send|Send to Richard/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^Send/ }).click();
  await expect(app(page).getByText(/Sent to Richard Voss at/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("15:12 feed: triage filter and audio digest", async ({ page }) => {
  const errors = await open(page, "t=1512&tab=feed");
  await expect(app(page).getByRole("heading", { name: "Reading backlog, as audio" })).toBeVisible();
  await app(page).getByRole("button", { name: /^For You/ }).click();
  await expect(app(page).getByText("Noise", { exact: true })).toHaveCount(0);
  await shot(page, "08-feed-1512-for-you");
  await app(page).getByRole("button", { name: /^Sam Reyes/ }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Reporter, TechInsight");
  await shot(page, "09-source-sheet");
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("without Helm at 17:00 the chasers appear and the overlaps remain", async ({ page }) => {
  const errors = await open(page, "t=1700&path=default&tab=feed");
  await expect(app(page).getByText("Only happens without Helm").first()).toBeVisible();
  await tab(page, "Today").click();
  await expect(app(page).getByText(/nobody re-planning the day/)).toBeVisible();
  await shot(page, "10-without-helm-1700");
  expect(errors).toEqual([]);
});

test("Maya's delegate view is scoped", async ({ page }) => {
  const errors = await open(page, "t=1316&as=maya");
  await expect(app(page).getByText(/Hidden from Maya/)).toBeVisible();
  await expect(app(page).getByText("Asks from the CEO")).toBeVisible();
  await shot(page, "11-maya-1316");
  await expectNoSeriousA11y(page);
  expect(errors).toEqual([]);
});

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("today and one-pager stay readable", async ({ page }) => {
    const errors = await open(page, "t=1316");
    await shot(page, "13-dark-today-1316");
    await expectNoSeriousA11y(page);
    await tab(page, "One-pager").click();
    await expect(app(page).getByText(/verified/).first()).toBeVisible();
    await shot(page, "14-dark-onepager-1316");
    await expectNoSeriousA11y(page);
    expect(errors).toEqual([]);
  });
});

test("clock controls move through checkpoints and keep the URL in sync", async ({ page }) => {
  const errors = await open(page, "t=0800");
  await expect(app(page).getByText("Before the first analysis")).toBeVisible();
  const next = page.getByRole("button", { name: /Jump to 08:30/ }).locator("visible=true");
  await next.click();
  await expect(app(page).getByText("Morning brief, analysed at")).toBeVisible();
  await expect(page).toHaveURL(/t=0830/);
  await shot(page, "12-clock-0830");
  expect(errors).toEqual([]);
});
