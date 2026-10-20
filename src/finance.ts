export type TransactionKind='expense'|'income'|'transfer'|'allocation'|'refund';
export interface Transaction {id:string;merchant:string;category:string;amountSatang:number;kind:TransactionKind;date:string;account:string;envelope:string;tag:'need'|'want';scope:'personal'|'shared';notes?:string}
export const baht=(satang:number)=>new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:2,minimumFractionDigits:2}).format(satang/100);
export function parseAmount(value:string):number|null{if(!/^\d+(\.\d{1,2})?$/.test(value))return null;const [whole,fraction='']=value.split('.');const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));return Number.isSafeInteger(result)&&result>0?result:null;}
export function expenses(transactions:Transaction[]){return transactions.reduce((sum,t)=>sum+(t.kind==='expense'?t.amountSatang:t.kind==='refund'?-t.amountSatang:0),0)}
export const demoTransactions:Transaction[]=[
{id:'1',merchant:'อิ่มอร่อย • มื้อกลางวัน',category:'อาหารและเครื่องดื่ม',amountSatang:18500,kind:'expense',date:'2026-10-20',account:'บัญชีใช้จ่าย',envelope:'อาหารและเครื่องดื่ม',tag:'need',scope:'personal'},
{id:'2',merchant:'BTS Skytrain',category:'การเดินทาง',amountSatang:6200,kind:'expense',date:'2026-10-20',account:'บัญชีใช้จ่าย',envelope:'การเดินทาง',tag:'need',scope:'personal'},
{id:'3',merchant:'เงินเดือน ตุลาคม',category:'รายได้ประจำ',amountSatang:5500000,kind:'income',date:'2026-10-19',account:'บัญชีใช้จ่าย',envelope:'',tag:'need',scope:'personal'},
{id:'4',merchant:'บ้านและของใช้ • IKEA',category:'ช้อปปิ้ง',amountSatang:129000,kind:'expense',date:'2026-10-19',account:'บัญชีใช้จ่าย',envelope:'ไลฟ์สไตล์',tag:'want',scope:'personal'},
{id:'5',merchant:'เติมเงินออมฉุกเฉิน',category:'โอนระหว่างบัญชี',amountSatang:500000,kind:'transfer',date:'2026-10-18',account:'บัญชีใช้จ่าย',envelope:'',tag:'need',scope:'personal'}];
export const openingCash=8240000; // Current demo cash before session-only changes.
