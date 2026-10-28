import { test, expect } from "@playwright/test";
import { mockWeekly } from "./support/weekly";
import type { ComparisonData } from "../../src/comparison";
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
test("comparison requires mutual sharing, charts fit both screens, and pink persists across dialogs", async ({
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
  const snapshot = {
    month,
    current_period_exists: true,
    period_exists: true,
    accounts: [
      {
        id: "account",
        name: "เงินรวม",
        kind: "bank",
        balance: "12000",
        opening_balance: "12000",
      },
    ],
    categories: [
      { id: "food", name: "อาหาร", icon: "🍜", tag: "need", envelope: null },
    ],
    envelopes: [],
    goals: [],
    contributions: [],
    income: "20000",
    expenses: "8000",
    cash: "12000",
    savings: "0",
    transactions: [],
    transaction_count: 40,
  };
  await page.route("**/rest/v1/profiles*", (r) =>
    r.fulfill({
      json: {
        display_name: "Tape",
        onboarding_completed_at: today + "T00:00:00Z",
      },
    }),
  );
  await page.route("**/rest/v1/rpc/moneyspace_snapshot", (r) =>
    r.fulfill({ json: snapshot }),
  );
  await mockWeekly(page);
  let mine = false,
    peer = false,
    version = "v1",
    reads = 0,
    failRead = false;
  let detailsMine = false,
    detailsPeer = false;
  const consents: boolean[] = [];
  const people = (
    [
      { key: "tape", name: "Tape" },
      { key: "pat", name: "Pat" },
    ] as const
  ).map((p, index) => ({
    ...p,
    daily: Array.from({ length: Number(today.slice(8)) }, (_, i) => {
      const food = i % 5 === 0 ? 0 : 60 + (i % 4) * 20 + index * 15,
        drink = i % 3 === 0 ? 45 + index * 10 : 0,
        other = i % 7 === 0 ? 450 + index * 120 : 0;
      return {
        date: month.slice(0, 7) + "-" + String(i + 1).padStart(2, "0"),
        net: String(food + drink + other),
        food: String(food),
        drink: String(drink),
        count: Number(food > 0) + Number(drink > 0) + Number(other > 0),
        food_count: Number(food > 0),
        drink_count: Number(drink > 0),
        refund_count: 0,
      };
    }),
  }));
  const enriched = people.map((p, i) => ({
    ...p,
    recent_daily: Array.from({ length: 7 }, (_, j) => {
      const d = new Date(today + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - 6 + j);
      return {
        date: d.toISOString().slice(0, 10),
        net: String(100 + j * 10 + i * 20),
        count: 1,
      };
    }),
    categories:
      i === 0
        ? [
            {
              name: "อาหาร",
              icon: "🍜",
              net: "2000",
              gross: "2000",
              refund: "0",
              count: 22,
            },
            {
              name: "เครื่องดื่ม",
              icon: "☕",
              net: "500",
              gross: "500",
              refund: "0",
              count: 7,
            },
          ]
        : [
            {
              name: "อาหารและเครื่องดื่ม",
              icon: "🍽️",
              net: "3000",
              gross: "3100",
              refund: "100",
              count: 20,
            },
            {
              name: "เดินทาง",
              icon: "🚆",
              net: "700",
              gross: "700",
              refund: "0",
              count: 5,
            },
          ],
    total_money: i === 0 ? "12000" : "15000",
  }));
  const recentFrom = enriched[0].recent_daily[0].date;
  await page.route(
    "**/rest/v1/rpc/moneyspace_comparison_details",
    async (r) => {
      const body = r.request().postDataJSON();
      expect(body.p_version).toBe(version);
      detailsMine = body.p_enabled;
      version = "details-" + String(detailsMine);
      await r.fulfill({ json: { confirmed: true } });
    },
  );
  await page.route("**/rest/v1/rpc/moneyspace_comparison", async (r) => {
    reads++;
    if (failRead) {
      await r.fulfill({ status: 500, json: { message: "try later" } });
      return;
    }
    const response: ComparisonData = {
      status: mine && peer ? "ready" : "waiting",
      mine_enabled: mine,
      peer_enabled: peer,
      version,
      details_mine_enabled: detailsMine,
      details_peer_enabled: detailsPeer,
      details_ready: detailsMine && detailsPeer,
      ...(mine && peer
        ? {
            month,
            through: today,
            recent_from: recentFrom,
            recent_through: today,
            money_as_of: today,
            people: enriched.map((p) => {
              if (detailsMine && detailsPeer) return p;
              return {
                key: p.key,
                name: p.name,
                daily: p.daily,
                recent_daily: p.recent_daily,
              };
            }),
          }
        : {}),
    };
    await r.fulfill({ json: response });
  });
  await page.route(
    "**/rest/v1/rpc/moneyspace_comparison_consent",
    async (r) => {
      const data = r.request().postDataJSON();
      expect(data.p_version).toBe(version);
      mine = data.p_enabled;
      consents.push(mine);
      version = "v" + (consents.length + 1);
      await r.fulfill({ json: { confirmed: true } });
    },
  );
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByText("หลังเผื่อบิลรอจ่าย", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "รายการโปรด", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "เปรียบเทียบ", exact: true }).click();
  await expect(
    page.getByText("กราฟพร้อมเมื่อเราสองคนเปิดแชร์", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "กราฟรายจ่าย 7 วันล่าสุด Tape และ Pat",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "เปิดแชร์ยอดสรุปของฉัน", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "หยุดแชร์ของฉัน", exact: true }),
  ).toBeVisible();
  peer = true;
  await page
    .getByRole("button", { name: "ตรวจสถานะอีกครั้ง", exact: true })
    .click();
  await expect(
    page.getByRole("img", {
      name: "กราฟรายจ่าย 7 วันล่าสุด Tape และ Pat",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "กราฟเส้นรายจ่ายสะสมทั้งเดือน Tape และ Pat",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page
      .locator('[data-testid^="comparison-"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid"))),
  ).toEqual([
    "comparison-recent",
    "comparison-month",
    "comparison-categories",
    "comparison-wealth",
  ]);
  await expect(
    page.getByRole("img", {
      name: "กราฟแท่งเงินรวมปัจจุบันรวมเงินออม Tape และ Pat",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "แชร์หมวดและเงินรวมของฉัน", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "หยุดแชร์หมวดและเงินรวม", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "กราฟรายจ่ายสะสมแยกหมวด Pat", exact: true }),
  ).toHaveCount(0);
  detailsPeer = true;
  await page.getByRole("button", { name: "เดือนก่อน", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "กราฟรายจ่ายสะสมแยกหมวด Pat", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "เดือนถัดไป", exact: true }).click();
  await expect(
    page.getByRole("img", {
      name: "กราฟแท่งเงินรวมปัจจุบันรวมเงินออม Tape และ Pat",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("comparison-wealth")).toContainText(
    "12,000.00",
  );
  await expect(page.getByTestId("comparison-categories")).toContainText(
    "อาหารและเครื่องดื่ม",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/${test.info().project.name}-comparison-light.png`,
    fullPage: true,
    animations: "disabled",
  });
  failRead = true;
  await page.getByRole("button", { name: "เดือนก่อน", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "โหลดกราฟเปรียบเทียบไม่สำเร็จ",
  );
  await expect(page.locator(".comparison-chart")).toHaveCount(0);
  failRead = false;
  await page
    .getByRole("button", { name: "โหลดเปรียบเทียบใหม่", exact: true })
    .click();
  await expect(page.locator(".comparison-chart").first()).toBeVisible();
  await page.getByRole("button", { name: "เดือนถัดไป", exact: true }).click();
  await expect(page.locator(".comparison-chart").first()).toBeVisible();
  await page.getByRole("button", { name: "Tape", exact: true }).click();
  await page.getByRole("button", { name: "ชมพู", exact: false }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "pink");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "pink");
  await page
    .getByRole("button", { name: "เพิ่มรายจ่าย", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => getComputedStyle(el).getPropertyValue("--mint").trim()),
  ).toBe("#b83e79");
  await page.getByRole("button", { name: "ปิด", exact: true }).click();
  await page.getByRole("button", { name: "เปรียบเทียบ", exact: true }).click();
  await expect(page.locator(".comparison-chart").first()).toBeVisible();
  await page.screenshot({
    path: `artifacts/${test.info().project.name}-comparison-pink.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "หยุดแชร์ของฉัน", exact: true })
    .click();
  await expect(page.locator(".comparison-chart")).toHaveCount(0);
  expect(consents).toEqual([true, false]);
  expect(reads).toBeGreaterThan(3);
});

test("reminders can be configured, dismissed and do not appear as push notifications", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(today + "T14:00:00Z") });
  const id = "00000000-0000-4000-8000-000000000456",
    month = today.slice(0, 7) + "-01";
  const jwt = [
    btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    btoa(
      JSON.stringify({
        sub: id,
        exp: Math.floor(new Date(today + "T14:00:00Z").getTime() / 1000) + 3600,
        aud: "authenticated",
        role: "authenticated",
      }),
    ),
    "mock",
  ].join(".");
  await page.addInitScript(
    ({ id, jwt, today }) => {
      localStorage.setItem(
        "sb-mfdttuvsvplbrfmjxxqs-auth-token",
        JSON.stringify({
          access_token: jwt,
          refresh_token: "mock",
          token_type: "bearer",
          expires_in: 3600,
          expires_at:
            Math.floor(new Date(today + "T14:00:00Z").getTime() / 1000) + 3600,
          user: {
            id,
            aud: "authenticated",
            role: "authenticated",
            email: "tape@moneyspace.invalid",
            app_metadata: {},
            user_metadata: {},
            created_at: today + "T00:00:00Z",
          },
        }),
      );
      if (!localStorage.getItem("moneyspace-appearance:" + id))
        localStorage.setItem(
          "moneyspace-appearance:" + id,
          JSON.stringify({
            dailyReminder: true,
            weeklyReview: false,
            budgetAlerts: false,
            reminderTime: "20:00",
          }),
        );
    },
    { id, jwt, today },
  );
  await mockWeekly(page);
  await page.route("**/rest/v1/profiles*", (r) =>
    r.fulfill({
      json: {
        display_name: "Tape",
        onboarding_completed_at: today + "T00:00:00Z",
      },
    }),
  );
  await page.route("**/rest/v1/rpc/moneyspace_snapshot", (r) =>
    r.fulfill({
      json: {
        month,
        current_period_exists: true,
        period_exists: true,
        accounts: [
          {
            id: "a",
            name: "เงินรวม",
            kind: "bank",
            balance: "1000",
            opening_balance: "1000",
          },
        ],
        categories: [],
        envelopes: [],
        goals: [],
        contributions: [],
        income: "0",
        expenses: "0",
        cash: "1000",
        savings: "0",
        transactions: [],
        transaction_count: 0,
      },
    }),
  );
  await page.route("**/rest/v1/rpc/moneyspace_reminder_context", (r) =>
    r.fulfill({ json: { today, has_expense: false } }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "การแจ้งเตือน 1 รายการ", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("ไม่มี push");
  await expect(
    page.getByRole("heading", { name: "แวะจดวันของคุณสักนิด", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "ปิดข้อความ แวะจดวันของคุณสักนิด",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "ตอนนี้ไม่มีเรื่องที่ต้องเตือน",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "ตั้งค่าการเตือน →", exact: true })
    .click();
  await expect(
    page.getByLabel("เวลาเตือนจดรายจ่าย", { exact: true }),
  ).toHaveValue("20:00");
  await page.getByLabel("เวลาเตือนจดรายจ่าย", { exact: true }).fill("19:30");
  await page.getByLabel("ชวนจดรายจ่ายช่วงเย็น", { exact: false }).uncheck();
  await page.reload();
  await page.getByRole("button", { name: "Tape", exact: true }).click();
  await expect(
    page.getByLabel("ชวนจดรายจ่ายช่วงเย็น", { exact: false }),
  ).not.toBeChecked();
  await expect(
    page.getByLabel("เวลาเตือนจดรายจ่าย", { exact: true }),
  ).toHaveValue("19:30");
});
