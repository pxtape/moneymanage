import type {Page} from '@playwright/test';
import {weekRange,type WeeklyData} from '../../../src/weekly';
export async function mockWeekly(page:Page,values:Partial<WeeklyData>={}){await page.route('**/rest/v1/rpc/moneyspace_weekly_summary',route=>{const through=route.request().postDataJSON().p_end;return route.fulfill({json:{...weekRange(through),income:'0',expenses:'0',savings_change:'0',expense_count:0,recorded_days:0,...values,through}})})}
