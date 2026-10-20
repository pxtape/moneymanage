import {decimalSatang,type LedgerEnvelope} from './ledger';
import {budgetPlan} from './budget-visuals';
export interface PlannedIncome{name:string;amount:string}
export interface MonthlyCashflowPlan{month:string;incomes:PlannedIncome[];savings_target:string;updated_at:string}
function exactSum(values:number[]){const sum=values.reduce((s,n)=>s+BigInt(n),0n);if(sum>BigInt(Number.MAX_SAFE_INTEGER)||sum<BigInt(Number.MIN_SAFE_INTEGER))throw new Error('ยอดรวมเกินช่วงที่แสดงได้อย่างแม่นยำ');return Number(sum)}
export function monthlyPlanTotals(plan:MonthlyCashflowPlan|null|undefined,envelopes:LedgerEnvelope[]){const income=exactSum((plan?.incomes||[]).map(i=>decimalSatang(i.amount)));const expenses=budgetPlan(envelopes).total;const savings=decimalSatang(plan?.savings_target||'0');const reserve=exactSum([income,-expenses,-savings]);return {income,expenses,savings,reserve,committed:exactSum([expenses,savings]),configured:!!plan};}
