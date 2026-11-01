import { test, expect } from '@playwright/test';
import { mockHome } from './support/home';
import { mockWeekly } from './support/weekly';

test('daily home edits expense and income from an earlier month and refreshes the selected day', async ({ page }) => {
  const id = '00000000-0000-4000-8000-000000000456';
  const date = '2026-09-20';
  const jwt = [btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), btoa(JSON.stringify({ sub: id, exp: Math.floor(Date.now()/1000)+3600, aud: 'authenticated', role: 'authenticated' })), 'mock'].join('.');
  await page.addInitScript(({ id, jwt }) => localStorage.setItem('sb-mfdttuvsvplbrfmjxxqs-auth-token', JSON.stringify({ access_token: jwt, refresh_token: 'mock', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600, user: { id, aud: 'authenticated', role: 'authenticated', email: 'test@moneyspace.invalid', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } })), { id, jwt });
  const rows = [
    { id: 'expense', kind: 'expense', amount: '80.00', merchant: 'อาหาร', category_id: 'food' },
    { id: 'income', kind: 'income', amount: '500.00', merchant: 'รายรับ', category_id: null },
  ].map(t => ({ ...t, owner_id: id, account_id: 'account', destination_account_id: null, household_id: null, envelope_id: null, notes: null, tag: 'need', occurred_on: date, refund_of_id: null, updated_at: date+'T00:00:00Z', created_at: date+'T00:00:00Z', deleted_at: null }));
  const state = { month: '2026-11-01', current_period_exists: true, accounts: [{ id: 'account', name: 'เงินรวม', kind: 'bank', balance: '420.00', opening_balance: '0' }], categories: [{ id: 'food', name: 'อาหาร', icon: '🍜', tag: 'need', envelope: null }], envelopes: [], goals: [], contributions: [], income: '500.00', expenses: '80.00', cash: '420.00', savings: '0', transactions: [] as Record<string,unknown>[], transaction_count: 0 };
  await mockWeekly(page);
  await page.route('**/rest/v1/profiles*', r => r.fulfill({ json: { display_name: 'tape', onboarding_completed_at: date+'T00:00:00Z' } }));
  await page.route('**/rest/v1/rpc/moneyspace_snapshot', r => r.fulfill({ json: state }));
  await mockHome(page, () => ({ ...state, transactions: rows }));
  let failRead = true;
  await page.route('**/rest/v1/transactions?*', r => {
    const url = new URL(r.request().url());
    expect(url.searchParams.get('owner_id')).toBe('eq.'+id);
    expect(url.searchParams.get('deleted_at')).toBe('is.null');
    if (failRead) return r.fulfill({ status: 403, json: { message: 'unavailable' } });
    return r.fulfill({ json: rows.find(t => 'eq.'+t.id === url.searchParams.get('id')) });
  });
  let writes = 0;
  await page.route('**/rest/v1/rpc/moneyspace_write', r => {
    const { p_action, p_data } = r.request().postDataJSON();
    expect(p_action).toBe('edit_transaction');
    const row = rows.find(t => t.id === p_data.id)!;
    expect(p_data.version).toBe(row.updated_at);
    expect(p_data.date).toBe(date);
    row.amount = p_data.amount;
    row.updated_at = date+'T01:00:00Z';
    writes++;
    state.expenses = rows[0].amount; state.income = rows[1].amount;
    state.cash = (Number(state.income)-Number(state.expenses)).toFixed(2);
    return r.fulfill({ json: { confirmed: true, id: row.id, action: p_action } });
  });
  const errors: string[] = [];page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  const dateInput = page.locator('.home-date-toolbar input[type=date]');
  await dateInput.fill(date);
  await page.getByRole('button', { name: 'ดูและแก้ไข อาหาร', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('เปิดรายการไม่ได้');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  failRead = false;
  for (const [name, value] of [['อาหาร', '90.50'], ['รายรับ', '600.00']]) {
    await page.getByRole('button', { name: 'ดูและแก้ไข '+name, exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('รายละเอียดรายการ');
    await page.getByRole('button', { name: 'แก้ไข', exact: true }).click();
    await page.getByLabel('จำนวนเงิน (บาท)', { exact: true }).fill(value);
    await page.getByRole('dialog').getByRole('button', { name: 'บันทึก', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(dateInput).toHaveValue(date);
    await expect(page.getByRole('button', { name: 'ดูและแก้ไข '+name, exact: true })).toContainText(value);
  }
  expect(writes).toBe(2);
  expect(errors).toEqual([]);
});
