import { test, expect } from "@playwright/test";
import { mockWeekly } from "./support/weekly";
import type { LedgerSnapshot } from "../../src/ledger";
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
test("bills wait for explicit confirmation, retry safely, and favorites open review", async ({
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
  const state: LedgerSnapshot = {
    month,
    current_period_exists: true,
    period_exists: true,
    accounts: [
      {
        id: "account",
        name: "เงินรวม",
        kind: "bank",
        balance: "10000",
        opening_balance: "10000",
      },
    ],
    categories: [
      {
        id: "drink",
        name: "เครื่องดื่ม",
        icon: "☕",
        tag: "want",
        envelope: null,
      },
    ],
    envelopes: [],
    goals: [],
    contributions: [],
    income: "0",
    expenses: "0",
    cash: "10000",
    savings: "0",
    transactions: [],
    transaction_count: 0,
    bills: { pending_total: "0", pending_current: [], items: [], rules: [] },
    expense_templates: [],
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
  await mockWeekly(page, {
    income: "0",
    expenses: "0",
    savings_change: "0",
    expense_count: 0,
    recorded_days: 0,
  });
  const writes: {
    p_action: string;
    p_key: string;
    p_data: Record<string, string>;
  }[] = [];
  const seen = new Set<string>();
  let rejectPay = true;
  await page.route("**/rest/v1/rpc/moneyspace_write", async (r) => {
    const b = r.request().postDataJSON();
    writes.push(b);
    if (!seen.has(b.p_key)) {
      seen.add(b.p_key);
      if (b.p_action === "create_bill") {
        state.bills!.rules = [
          {
            id: "bill",
            name: b.p_data.name,
            amount: b.p_data.amount,
            category_id: "drink",
            envelope_id: null,
            first_month: month,
            due_day: 31,
            updated_at: "v1",
          },
        ];
        const item = {
          rule_id: "bill",
          name: b.p_data.name,
          amount: b.p_data.amount,
          period_start: month,
          due_on: month.slice(0, 7) + "-28",
          paid: false,
          version: "v1",
        };
        state.bills!.items = [item];
        state.bills!.pending_current = [item];
        state.bills!.pending_total = b.p_data.amount;
      } else if (b.p_action === "pay_bill") {
        expect(b.p_data.amount).toBe("499.99");
        state.cash = "9500.01";
        state.expenses = "499.99";
        state.transaction_count = 1;
        state.bills!.pending_total = "0";
        state.bills!.pending_current = [];
        state.bills!.items = [{ ...state.bills!.items[0], paid: true }];
      } else if (b.p_action === "create_template") {
        state.expense_templates = [
          {
            id: "fav",
            name: b.p_data.name,
            amount: b.p_data.amount,
            category_id: "drink",
            updated_at: "v1",
          },
        ];
      } else if (b.p_action === "add_transaction") {
        expect(b.p_data.amount).toBe("55.25");
        expect(b.p_data.category_id).toBe("drink");
        expect(b.p_data.merchant).toBe("กาแฟประจำ");
        state.cash = "9444.76";
        state.expenses = "555.24";
      } else if (b.p_action === "delete_template") {
        state.expense_templates = [];
      } else throw new Error("unexpected action " + b.p_action);
    }
    if (b.p_action === "pay_bill" && rejectPay) {
      rejectPay = false;
      await r.abort("failed");
      return;
    }
    await r.fulfill({ json: { confirmed: true, id: "done" } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "งบรายเดือน", exact: true }).click();
  await page.getByRole("button", { name: "+ ตั้งบิล", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่อบิล", { exact: true }).fill("โทรศัพท์");
  await dialog.getByLabel("ยอดประมาณการ (บาท)", { exact: true }).fill("500.25");
  await dialog.getByLabel("หมวด", { exact: true }).selectOption("drink");
  await dialog.getByLabel("ครบกำหนดวันที่").selectOption("31");
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("actual-cash")).toContainText("10,000.00");
  await page.getByRole("button", { name: "ภาพรวม", exact: true }).click();
  await expect(page.locator(".pending-bill-summary")).toContainText("9,499.75");
  await page.getByRole("button", { name: "ยืนยันจ่าย", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("ยอดจ่ายจริง (บาท)", { exact: true }).fill("499.99");
  await dialog
    .getByRole("button", { name: "ยืนยันจ่ายและบันทึกรายจ่าย", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "ยืนยันจ่ายและบันทึกรายจ่าย", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const payWrites = writes.filter((w) => w.p_action === "pay_bill");
  expect(payWrites).toHaveLength(2);
  expect(payWrites[0].p_key).toBe(payWrites[1].p_key);
  await expect(page.getByTestId("actual-cash")).toContainText("9,500.01");
  await expect(page.locator(".pending-bill-summary")).toContainText("9,500.01");
  await page
    .getByRole("region", { name: "รายการโปรด", exact: true })
    .getByRole("button", { name: "เพิ่ม", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่อรายการโปรด", { exact: true }).fill("กาแฟประจำ");
  await dialog.getByLabel("ยอดที่ใช้บ่อย (บาท)", { exact: true }).fill("50");
  await dialog.getByLabel("หมวด", { exact: true }).selectOption("drink");
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("actual-cash")).toContainText("9,500.01");
  const before = writes.length;
  await page
    .getByRole("button", { name: "☕ กาแฟประจำ ฿50.00", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("จำนวนเงิน (บาท)", { exact: true }),
  ).toHaveValue("50.00");
  expect(writes).toHaveLength(before);
  await dialog.getByRole("button", { name: "ปิด", exact: true }).click();
  expect(writes).toHaveLength(before);
  await page
    .getByRole("button", { name: "☕ กาแฟประจำ ฿50.00", exact: true })
    .click();
  await page.getByLabel("จำนวนเงิน (บาท)", { exact: true }).fill("55.25");
  await page
    .getByRole("button", { name: "บันทึกรายจ่าย", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("actual-cash")).toContainText("9,444.76");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "☕ กาแฟประจำ ฿50.00", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/${test.info().project.name}-bills-favorites.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Tape", exact: true }).click();
  await page
    .getByRole("button", { name: "แก้รายการโปรด กาแฟประจำ", exact: true })
    .click();
  await page.getByRole("button", { name: "ลบรายการโปรด", exact: true }).click();
  await page.getByRole("button", { name: "ยืนยัน", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "แก้รายการโปรด กาแฟประจำ", exact: true }),
  ).toHaveCount(0);
});

test('an already recorded bill can be linked after retrying a failed candidate read',async({page})=>{
 const id='00000000-0000-4000-8000-000000000456',month=today.slice(0,7)+'-01';const jwt=[btoa(JSON.stringify({alg:'HS256',typ:'JWT'})),btoa(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated'})),'mock'].join('.');
 await page.addInitScript(({id,jwt})=>localStorage.setItem('sb-mfdttuvsvplbrfmjxxqs-auth-token',JSON.stringify({access_token:jwt,refresh_token:'mock',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id,aud:'authenticated',role:'authenticated',email:'tape@moneyspace.invalid',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}})),{id,jwt});
 const item={rule_id:'bill',name:'ค่าโทรศัพท์',amount:'500',period_start:month,due_on:today,paid:false,version:'rule-v1'};
 const state:LedgerSnapshot={month,current_period_exists:true,period_exists:true,accounts:[{id:'account',name:'เงินรวม',kind:'bank',balance:'9500',opening_balance:'10000'}],categories:[{id:'phone',name:'โทรศัพท์',icon:'📱',tag:'need',envelope:null}],envelopes:[],goals:[],contributions:[],income:'0',expenses:'500',cash:'9500',savings:'0',transactions:[],transaction_count:1,bills:{pending_total:'500',pending_current:[item],items:[item],rules:[]},expense_templates:[]};
 await page.route('**/rest/v1/profiles*',r=>r.fulfill({json:{display_name:'Tape',onboarding_completed_at:today+'T00:00:00Z'}}));await page.route('**/rest/v1/rpc/moneyspace_snapshot',r=>r.fulfill({json:state}));await mockWeekly(page,{income:'0',expenses:'500',savings_change:'0',expense_count:1,recorded_days:1});
 let candidateReads=0,writes=0;
 await page.route('**/rest/v1/rpc/moneyspace_bill_candidates',async r=>{candidateReads++;expect(r.request().postDataJSON()).toEqual({p_rule_id:'bill',p_month:month});if(candidateReads===1){await r.fulfill({status:500,json:{message:'offline'}});return}await r.fulfill({json:[{id:'tx',merchant:'โทรศัพท์',amount:'500',occurred_on:today,updated_at:'tx-v1'}]})});
 await page.route('**/rest/v1/rpc/moneyspace_write',async r=>{writes++;const body=r.request().postDataJSON();expect(body.p_action).toBe('pay_bill');expect(body.p_data).toEqual({id:'bill',month,version:'rule-v1',transaction_id:'tx',transaction_version:'tx-v1'});state.bills!.pending_total='0';state.bills!.pending_current=[];await r.fulfill({json:{confirmed:true,id:'tx'}})});
 await page.goto('/');await page.getByRole('button',{name:'ยืนยันจ่าย',exact:true}).click();await page.getByRole('button',{name:'จดรายจ่ายนี้แล้ว',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('โหลดรายการเดิมไม่สำเร็จ');expect(writes).toBe(0);await page.getByRole('button',{name:'ลองใหม่',exact:true}).click();await page.getByLabel('รายการที่จดไว้',{exact:true}).selectOption('tx');expect(writes).toBe(0);await page.getByRole('button',{name:'ยืนยันผูกกับรายการเดิม',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(writes).toBe(1);await expect(page.getByTestId('actual-cash')).toContainText('9,500.00');await expect(page.getByTestId('actual-expenses')).toContainText('500.00');await expect(page.locator('.pending-bill-summary')).toContainText('9,500.00');
});
