import { decimalSatang } from "./ledger";
export type DuckMoment = 'morning'|'day'|'night';
export function duckMoment(date = new Date()): DuckMoment {
 const hour = Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',hourCycle:'h23'}).format(date));
 return hour>=5&&hour<11?'morning':hour>=11&&hour<19?'day':'night';
}
export interface DailyActivity {date:string;count:number;expenses:string;income:string}

export function readDailyActivity(value:unknown):DailyActivity[]{
 if(!Array.isArray(value)||value.length>62)throw new Error('Invalid daily activity');
 const seen=new Set<string>();
 return value.map(row=>{if(!row||typeof row!=='object')throw new Error('Invalid day');const day=row as DailyActivity;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day.date)||!Number.isSafeInteger(day.count)||day.count<0||seen.has(day.date))throw new Error('Invalid day');
  for(const n of [day.expenses,day.income]){if(typeof n!=='string'||!/^-?\d+(\.\d{1,2})?$/.test(n))throw new Error('Invalid amount');}
  decimalSatang(day.expenses);if(decimalSatang(day.income)<0)throw new Error('Invalid income');
  seen.add(day.date);return day;
 });
}
