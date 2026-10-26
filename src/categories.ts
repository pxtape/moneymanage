export interface Category { favorite?:boolean; id: string; name: string; icon: string; envelope: string | null; tag: 'need'|'want'; updated_at?:string; foodDrink?:boolean; spendingGroup?:'food'|'drink'|'other' }
export const defaultCategories: Category[] = [
  { id:'food',name:'อาหาร',icon:'🍜',envelope:'อาหารและเครื่องดื่ม',tag:'need' },
  { id:'drink',name:'เครื่องดื่ม',icon:'☕',envelope:'อาหารและเครื่องดื่ม',tag:'want' },
  { id:'transport',name:'เดินทาง',icon:'🚆',envelope:'การเดินทาง',tag:'need' },
  { id:'shopping',name:'ช้อปปิ้ง',icon:'🛍️',envelope:'ช้อปปิ้งและไลฟ์สไตล์',tag:'want' },
  { id:'bills',name:'บิลและบ้าน',icon:'🏠',envelope:'บิลและค่าใช้จ่ายประจำ',tag:'need' },
  { id:'health',name:'สุขภาพ',icon:'🌿',envelope:null,tag:'need' },
];
export function validateCategoryName(name: string, categories: Category[]): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 40) return 'ตั้งชื่อหมวด 1–40 ตัวอักษร';
  if (categories.some(c=>c.name.normalize('NFC').toLocaleLowerCase()===trimmed.normalize('NFC').toLocaleLowerCase())) return 'มีหมวดนี้แล้ว เลือกใช้หมวดเดิมได้เลย';
  return null;
}
export const bangkokToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export function validateCategoryIcon(value:string):string|null {const icon=value.trim();const parts=[...new Intl.Segmenter('th',{granularity:'grapheme'}).segment(icon)];return parts.length===1&&[...icon].length<=12&&/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(icon)?null:'เลือก emoji หนึ่งตัวสำหรับหมวด';}
