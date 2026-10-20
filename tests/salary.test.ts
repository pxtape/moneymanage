import {describe,it,expect} from 'vitest';
import {paydayInMonth,salaryCycle,type SalaryPlan} from '../src/salary';
const plan:SalaryPlan={enabled:true,amount:'30000.00',payday:25,updated_at:'v1',payments:[]};
describe('regular salary planning',()=>{
 it('clamps short months and leap February',()=>{expect(paydayInMonth('2027-02-01',31)).toBe('2027-02-28');expect(paydayInMonth('2028-02-01',31)).toBe('2028-02-29');expect(paydayInMonth('2026-04-01',31)).toBe('2026-04-30')});
 it('uses actual spendable money, never expected salary, for the daily allowance',()=>{const c=salaryCycle(plan,'2026-10-20',800000);expect(c.days).toBe(5);expect(c.daily).toBe(160000);expect(c.expected).toBe(3000000);expect(c.canReceive).toBe(true)});
 it('shows unpaid due and overdue dates without inventing extra days',()=>{expect(salaryCycle(plan,'2026-10-25',100).canReceive).toBe(true);const c=salaryCycle(plan,'2026-10-29',100);expect(c.days).toBe(-4);expect(c.daily).toBe(null)});
 it('advances after confirmation even if the payday changes, including December',()=>{const p={...plan,payments:[{due_on:'2026-12-25',transaction_id:'tx',deleted:false}]};expect(salaryCycle({...p,payday:31},'2026-12-26',200).due).toBe('2027-01-31');expect(salaryCycle({...p,payday:31},'2026-12-26',200).canReceive).toBe(false)});
 it('does not reopen a deleted salary payment or recommend negative spending',()=>{const p={...plan,payments:[{due_on:'2026-10-25',transaction_id:'tx',deleted:true}]};expect(salaryCycle(p,'2026-10-27',-100).canReceive).toBe(false);expect(salaryCycle(p,'2026-10-27',-100).daily).toBe(0)});
});
