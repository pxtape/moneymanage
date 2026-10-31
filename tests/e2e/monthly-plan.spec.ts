import { mockWeekly } from "./support/weekly";
import { mockHome } from "./support/home";
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await mockWeekly(page);
});
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
test("monthly liquidity plan separates forecasts from money and persists monthly sources, savings and deficits", async ({
  page,
}) => {
  const id = "00000000-0000-4000-8000-000000000456",
    month = today.slice(0, 7) + "-01";
  const jwt = [
    btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    btoa(
      JSON.stringify({
        sub: id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: "authenticated",
        role: "authenticated",
      }),
    ),
    "mock",
  ].join(".");
  await page.addInitScript(
    ({ id, jwt }) =>
      localStorage.setItem(
        "sb-mfdttuvsvplbrfmjxxqs-auth-token",
        JSON.stringify({
          access_token: jwt,
          refresh_token: "mock",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: {
            id,
            aud: "authenticated",
            role: "authenticated",
            email: "tape@moneyspace.invalid",
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        }),
      ),
    { id, jwt },
  );
  const state = {
    month,
    current_period_exists: true,
    period_exists: true,
    accounts: [
      {
        id: "account",
        name: "เงินรวม",
        kind: "bank",
        balance: "8000",
        opening_balance: "10000",
      },
    ],
    categories: [],
    envelopes: [
      {
        id: "food",
        name: "อาหาร",
        cadence: "daily",
        rollover: "none",
        allocated: "6000",
        carried: "0",
        spent: "1000",
        remaining: "5000",
      },
      {
        id: "bills",
        name: "ค่าไฟ",
        cadence: "bill",
        rollover: "none",
        allocated: "2000",
        carried: "0",
        spent: "1000",
        remaining: "1000",
      },
      {
        id: "home",
        name: "ที่อยู่",
        cadence: "flexible",
        rollover: "none",
        allocated: "0",
        carried: "0",
        spent: "0",
        remaining: "0",
      },
    ],
    goals: [],
    contributions: [],
    income: "0",
    expenses: "2000",
    cash: "8000",
    savings: "1000",
    transactions: [],
    transaction_count: 0,
  };
  type Plan = {
    month: string;
    incomes: { name: string; amount: string }[];
    savings_target: string;
    updated_at: string;
  };
  const plans: Record<string, Plan> = {};
  const keys: string[] = [];
  const seen = new Set<string>();
  let reject = true;
  await page.route("**/rest/v1/profiles*", (r) =>
    r.fulfill({
      json: {
        display_name: "tape",
        onboarding_completed_at: today + "T00:00:00Z",
      },
    }),
  );
  await page.route("**/rest/v1/rpc/moneyspace_snapshot", (r) => {
    const m = r.request().postDataJSON().p_month;
    return r.fulfill({
      json: {
        ...state,
        month: m,
        monthly_plan: plans[m] || null,
        previous_month_plan: null,
      },
    });
  });
  await mockHome(page, () => state);
  await page.route("**/rest/v1/rpc/moneyspace_write", async (route) => {
    const b = route.request().postDataJSON();
    expect(b.p_action).toBe("save_month_plan");
    keys.push(b.p_key);
    if (!seen.has(b.p_key)) {
      expect(b.p_data.version).toBe(plans[b.p_data.month]?.updated_at || null);
      plans[b.p_data.month] = {
        month: b.p_data.month,
        incomes: b.p_data.incomes,
        savings_target: b.p_data.amount,
        updated_at: today + `T0${seen.size + 1}:00:00Z`,
      };
      seen.add(b.p_key);
    }
    if (reject) {
      reject = false;
      await route.abort("failed");
      return;
    }
    await route.fulfill({
      json: { confirmed: true, id: "plan", action: b.p_action },
    });
  });
  if (test.info().project.name === "desktop")
    await page.setViewportSize({ width: 1873, height: 891 });
  await page.goto("/");
  await expect(page.getByTestId("actual-spendable")).toContainText("7,000.00");
  await page.getByRole("tab", { name: "รายเดือน", exact: true }).click();
  await expect(
    page.locator(".home-budget-list article").filter({ hasText: "ค่าไฟ" }),
  ).toContainText("เหลือ ฿1,000.00");
  await expect(page.getByTestId("actual-cash")).toBeVisible();
  await page.getByRole("button", { name: "งบรายเดือน", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "ตั้งรายได้ประจำ", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByTestId("plan-reserve")).toContainText("—");
  await page
    .getByRole("button", { name: "เริ่มวางแผนเดือนนี้", exact: true })
    .click();
  await page.getByLabel("ยอดคาดแหล่งที่ 1", { exact: true }).fill("30000");
  await page
    .getByRole("button", { name: "เพิ่มแหล่งรายได้", exact: true })
    .click();
  await page.getByLabel("แหล่งรายได้ 2", { exact: true }).fill("งานเสริม");
  await page.getByLabel("ยอดคาดแหล่งที่ 2", { exact: true }).fill("5000.25");
  await page
    .getByLabel("ตั้งใจออมเดือนนี้ (บาท)", { exact: true })
    .fill("10000");
  await expect(page.getByRole("dialog")).toContainText(
    "เงินสำรองตามแผน ฿17,000.25",
  );
  await page
    .getByRole("button", { name: "บันทึกแผนเดือนนี้", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("ยังไม่ได้ยืนยัน");
  await expect(page.getByTestId("plan-reserve")).toContainText("—");
  await page
    .getByRole("button", { name: "บันทึกแผนเดือนนี้", exact: true })
    .click();
  expect(keys[0]).toBe(keys[1]);
  await expect(page.getByTestId("plan-income")).toContainText("35,000.25");
  await expect(page.getByTestId("plan-expenses")).toContainText("8,000.00");
  await expect(page.getByTestId("plan-savings")).toContainText("10,000.00");
  await expect(page.getByTestId("plan-reserve")).toContainText("17,000.25");
  await expect(page.getByTestId("actual-cash")).toContainText("8,000.00");
  await expect(page.getByTestId("actual-income")).toContainText("0.00");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".dialog-overlay")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: `artifacts/${test.info().project.name}-monthly-plan-home.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.screenshot({
    path: `artifacts/${test.info().project.name}-daily-overview-viewport.png`,
    animations: "disabled",
  });
  await expect(page.getByTestId("plan-reserve")).toContainText("17,000.25");
  await expect(page.locator(".cashflow-details")).toContainText("งานเสริม");
  await expect(page.locator(".cashflow-details")).toContainText("อาหาร");
  await page.screenshot({
    path: `artifacts/${test.info().project.name}-monthly-plan-budgets.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "แก้แผนเดือนนี้", exact: true })
    .click();
  await page
    .getByRole("button", { name: "ลบแหล่งรายได้ 2", exact: true })
    .click();
  await page.getByLabel("แหล่งรายได้ 1", { exact: true }).fill("รายได้หลัก");
  await page.getByLabel("ยอดคาดแหล่งที่ 1", { exact: true }).fill("10000");
  await page
    .getByLabel("ตั้งใจออมเดือนนี้ (บาท)", { exact: true })
    .fill("5000");
  await page
    .getByRole("button", { name: "บันทึกแผนเดือนนี้", exact: true })
    .click();
  await expect(page.locator(".cashflow-card.deficit")).toContainText(
    "แผนยังขาด",
  );
  await expect(page.getByTestId("plan-reserve")).toContainText("3,000.00");
  await expect(page.locator(".cashflow-details")).not.toContainText("งานเสริม");
  await expect(page.getByTestId("actual-cash")).toContainText("8,000.00");
  await page.reload();
  await page.getByRole("button", { name: "งบรายเดือน", exact: true }).click();
  await expect(page.getByTestId("plan-reserve")).toContainText("3,000.00");
  await page.getByRole("button", { name: "เดือนก่อน", exact: true }).click();
  await expect(page.getByTestId("plan-income")).toContainText("ยังไม่ได้ตั้ง");
  await page.getByRole("button", { name: "เดือนถัดไป", exact: true }).click();
  await expect(page.getByTestId("plan-reserve")).toContainText("3,000.00");
  await page.getByRole("button", { name: "สลับธีม", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/${test.info().project.name}-monthly-plan-light.png`,
    fullPage: true,
    animations: "disabled",
  });
});
