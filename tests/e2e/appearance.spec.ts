import { test, expect } from "@playwright/test";
import { mockWeekly } from "./support/weekly";
import { mockHome } from "./support/home";
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
test("personal pockets, pinned categories and private weekly cards work without changing money", async ({
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
        balance: "7000",
        opening_balance: "5500",
      },
    ],
    categories: [
      {
        id: "food",
        name: "อาหาร",
        icon: "🍜",
        tag: "need",
        favorite: false,
        envelope: "env",
        updated_at: "v1",
      },
      {
        id: "drink",
        name: "เครื่องดื่ม",
        icon: "☕",
        tag: "want",
        favorite: false,
        envelope: null,
        updated_at: "v1",
      },
      {
        id: "travel",
        name: "เดินทาง",
        icon: "🚆",
        tag: "need",
        favorite: true,
        envelope: null,
        updated_at: "v1",
      },
    ],
    envelopes: [
      {
        id: "env",
        name: "อาหาร",
        rollover: "none",
        allocated: "6000",
        carried: "0",
        spent: "500",
        remaining: "5500",
        updated_at: "v1",
        cadence: "daily",
        color: "#80e6bd",
        icon: "🍜",
        cover: "waves",
      },
    ],
    goals: [{ id: "goal", name: "เงินฉุกเฉิน", target: "10000", saved: "500" }],
    contributions: [],
    income: "2000",
    expenses: "500",
    cash: "7000",
    savings: "500",
    transactions: [],
    transaction_count: 4,
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
    r.fulfill({ json: state }),
  );
  await mockHome(page, () => state);
  await mockWeekly(page, {
    income: "2000.00",
    expenses: "500.00",
    savings_change: "500.00",
    expense_count: 4,
    recorded_days: 1,
  });
  const pins: string[] = [];
  const seen = new Set<string>();
  let rejectPin = true;
  await page.route("**/rest/v1/rpc/moneyspace_write", async (route) => {
    const b = route.request().postDataJSON();
    if (b.p_action === "pin_category") {
      pins.push(b.p_key);
      if (!seen.has(b.p_key)) {
        expect(b.p_data.favorite).toBe(true);
        expect(b.p_data.version).toBe("v1");
        state.categories[1].favorite = true;
        state.categories[1].updated_at = "v2";
        seen.add(b.p_key);
      }
      if (rejectPin) {
        rejectPin = false;
        await route.abort("failed");
        return;
      }
    } else if (b.p_action === "allocate") {
      expect(b.p_data.color).toBe("#8aaeff");
      expect(b.p_data.pocket_icon).toBe("🚀");
      expect(b.p_data.cover).toBe("dots");
      expect(b.p_data.amount).toBe("6000.00");
      state.envelopes[0] = {
        ...state.envelopes[0],
        color: b.p_data.color,
        icon: b.p_data.pocket_icon,
        cover: b.p_data.cover,
        updated_at: "v2",
      };
    } else throw new Error("Unexpected action " + b.p_action);
    await route.fulfill({
      json: { confirmed: true, id: "done", action: b.p_action },
    });
  });
  await page.goto("/");
  expect(
    await page
      .locator(".quick-action-grid")
      .evaluate(
        (el) =>
          el.getBoundingClientRect().width /
          el.parentElement!.getBoundingClientRect().width,
      ),
  ).toBeGreaterThan(0.9);
  await expect(page.getByTestId("actual-spendable")).toContainText("6,500.00");
  await expect(
    page.getByRole("button", { name: "ครอบครัว", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "ซ่อนยอดสรุป", exact: true }).click();
  await expect(page.getByTestId("actual-spendable")).toContainText("••••");
  await page.reload();
  await expect(page.getByTestId("actual-cash")).toContainText("••••");
  await page.getByRole("button", { name: "แสดงยอดสรุป", exact: true }).click();
  await expect(page.getByTestId("actual-cash")).toContainText("7,000.00");
  await page
    .getByRole("button", { name: "จดรายจ่าย", exact: true })
    .first()
    .click();
  await page.getByLabel("จำนวนเงิน (บาท)", { exact: true }).fill("123");
  await page
    .getByRole("button", { name: "ปักหมวด เครื่องดื่ม", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "ยังไม่ได้ยืนยัน",
  );
  await page
    .getByRole("button", { name: "ปักหมวด เครื่องดื่ม", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "เลิกปักหมวด เครื่องดื่ม", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => pins.length).toBe(2);
  expect(pins[0]).toBe(pins[1]);
  await expect(page.getByLabel("จำนวนเงิน (บาท)", { exact: true })).toHaveValue(
    "123",
  );
  await expect(page.locator(".quick-category-choice").first()).toContainText(
    "เครื่องดื่ม",
  );
  await page.getByRole("button", { name: "ปิด", exact: true }).click();
  await page.getByRole("button", { name: "งบรายเดือน", exact: true }).click();
  await page.getByRole("button", { name: "แก้งบ", exact: true }).click();
  await page.getByLabel("ไอคอนกระเป๋า", { exact: true }).fill("🚀");
  await page.getByLabel("ลายปก", { exact: true }).selectOption("dots");
  await page.getByLabel("สีของกระเป๋า", { exact: true }).evaluate((el) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, "#8aaeff");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByRole("button", { name: "บันทึกงบ", exact: true }).click();
  await expect(page.getByTestId("actual-cash")).toContainText("7,000.00");
  await expect(
    page.locator(".envelope-tile .pocket-cover").first(),
  ).toHaveAttribute("data-cover", "dots");
  await expect(
    page.locator(".envelope-tile .pocket-cover").first(),
  ).toContainText("🚀");
  await page.getByRole("button", { name: "ภาพรวม", exact: true }).click();
  await expect(page.getByTestId("actual-spendable")).toContainText("6,500.00");
  await page.getByRole("tab", { name: "รายสัปดาห์", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "สัปดาห์นี้เทียบสัปดาห์ก่อน" }),
  ).toBeVisible();
  await expect(page.locator(".dialog-overlay")).toHaveCount(0);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/${test.info().project.name}-teal-home.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Tape", exact: true }).click();
  await page.getByLabel("เตือนงบใกล้หมดในแอป", { exact: false }).uncheck();
  await page.reload();
  await page.getByRole("button", { name: "Tape", exact: true }).click();
  await expect(
    page.getByLabel("เตือนงบใกล้หมดในแอป", { exact: false }),
  ).not.toBeChecked();
  await expect(
    page
      .locator(".category-mappings")
      .getByRole("button", { name: "เลิกปักหมวด เครื่องดื่ม", exact: true }),
  ).toBeVisible();
});
