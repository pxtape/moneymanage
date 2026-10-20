import {decimalSatang} from './ledger';
export interface SalaryPlan {enabled:boolean;amount:string;payday:number;updated_at:string;payments:{due_on:string;transaction_id:string;deleted:boolean}[]}
export function paydayInMonth(month:string,day:number){const year=Number(month.slice(0,4)),m=Number(month.slice(5,7));const last=new Date(Date.UTC(year,m,0)).getUTCDate();return `${month.slice(0,7)}-${String(Math.min(day,last)).padStart(2,'0')}`}
export function salaryCycle(plan:SalaryPlan,today:string,spendable:number){
 const current=paydayInMonth(today,plan.payday);const payment=plan.payments.find(p=>p.due_on.slice(0,7)===today.slice(0,7));
 const nextMonth=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7)),1)).toISOString().slice(0,10);
 const due=payment?paydayInMonth(nextMonth,plan.payday):current;
 const days=Math.round((Date.parse(due+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
 return {due,days,payment,canReceive:!payment,daily:days>0?Math.floor(Math.max(0,spendable)/days):null,expected:decimalSatang(plan.amount)};
}
