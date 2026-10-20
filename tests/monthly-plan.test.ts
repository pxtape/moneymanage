import {describe,it,expect} from 'vitest';
import {monthlyPlanTotals,type MonthlyCashflowPlan} from '../src/monthly-plan';
import type {LedgerEnvelope} from '../src/ledger';
const envelopes:LedgerEnvelope[]=[{id:'food',name:'อาหาร',rollover:'none',allocated:'6000',carried:'0',spent:'1000',remaining:'5000'},{id:'bills',name:'ค่าไฟ',rollover:'none',allocated:'2000',carried:'0',spent:'0',remaining:'2000'}];
const plan:MonthlyCashflowPlan={month:'2026-10-01',updated_at:'v',incomes:[{name:'เงินเดือน',amount:'30000'},{name:'งานเสริม',amount:'5000.25'}],savings_target:'10000'};
describe('monthly cashflow blueprint',()=>{
 it('sums all expected sources and subtracts planned expenses and monthly savings once',()=>{expect(monthlyPlanTotals(plan,envelopes)).toEqual({income:3500025,expenses:800000,savings:1000000,reserve:1700025,committed:1800000,configured:true})});
 it('uses original monthly budgets rather than their unspent balances',()=>{expect(monthlyPlanTotals(plan,[{...envelopes[0],spent:'7000',remaining:'-1000'}]).expenses).toBe(600000)});
 it('reports a deficit instead of pretending reserve exists',()=>{const p={...plan,incomes:[{name:'งาน',amount:'5000'}]};expect(monthlyPlanTotals(p,envelopes).reserve).toBe(-1300000)});
 it('distinguishes an unset plan from a deliberately zero-income plan',()=>{expect(monthlyPlanTotals(null,envelopes).configured).toBe(false);expect(monthlyPlanTotals({...plan,incomes:[],savings_target:'0'},envelopes).configured).toBe(true);expect(monthlyPlanTotals({...plan,incomes:[],savings_target:'0'},envelopes).reserve).toBe(-800000)});
 it('fails rather than rounding an unsafe aggregate',()=>{const p={...plan,incomes:[{name:'a',amount:'90071992547409.91'},{name:'b',amount:'0.01'}]};expect(()=>monthlyPlanTotals(p,envelopes)).toThrow()});
});
