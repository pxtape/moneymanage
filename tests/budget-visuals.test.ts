import {describe,it,expect} from 'vitest';
import {budgetPlan,budgetState} from '../src/budget-visuals';
import type {LedgerEnvelope} from '../src/ledger';
const pocket=(id:string,target:string,spent='0',remaining=target):LedgerEnvelope=>({id,name:id,allocated:target,spent,remaining,carried:'0',rollover:'none'});
describe('budget visuals describe targets, not actual spending',()=>{
 it('sums only monthly targets and shows each target share independently of spending',()=>{const p=budgetPlan([pocket('food','6000','1000','5000'),pocket('drink','2000','2500','-500'),pocket('bills','2000')]);expect(p.total).toBe(1000000);expect(p.rows.map(r=>r.percent)).toEqual([60,20,20]);expect(p.rows.map(r=>r.target)).toEqual([600000,200000,200000])});
 it('shows remaining 5000 / 6000 as 83.3 percent and flags overspending without a negative bar',()=>{expect(budgetState(pocket('food','6000','1000','5000'))).toMatchObject({percent:83.33333333333334,remaining:500000,target:600000,tone:'plenty'});expect(budgetState(pocket('food','6000','6500','-500'))).toMatchObject({fill:0,tone:'over',remaining:-50000})});
 it('does not invent percentages for zero targets and preserves refund-driven excess remaining',()=>{expect(budgetPlan([pocket('zero','0')])).toMatchObject({total:0});expect(budgetState(pocket('zero','0'))).toMatchObject({percent:null,fill:0});expect(budgetState(pocket('refund','100','-20','120'))).toMatchObject({percent:120,fill:100})});
 it('rejects an unsafe aggregate rather than displaying an imprecise monetary total',()=>{expect(()=>budgetPlan(Array.from({length:100},(_,i)=>pocket(String(i),'999999999999.99')))).toThrow()});
});
