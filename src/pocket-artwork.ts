import type { DuckPose } from './components/DuckMascot';
export const pocketArtwork: {icon:string;name:string;pose:DuckPose}[] = [
 {icon:'✉️',name:'จัดซองเงิน',pose:'organize'},{icon:'🪙',name:'รับเหรียญ',pose:'receive'},
 {icon:'🏦',name:'หยอดโหล',pose:'deposit'},{icon:'🌿',name:'รดน้ำออม',pose:'grow'},
 {icon:'📅',name:'ปฏิทิน',pose:'calendar'},{icon:'🖊️',name:'จดสมุด',pose:'record'},
 {icon:'🚌',name:'รอรถ',pose:'commute'},{icon:'🍲',name:'ก๋วยเตี๋ยว',pose:'noodles'},
 {icon:'😴',name:'พักสมุด',pose:'rest'},{icon:'💐',name:'ฉลอง',pose:'celebrate'},
 {icon:'🔎',name:'ค้นสมุด',pose:'search'},{icon:'🎯',name:'เกาะเป้า',pose:'meter'},
 {icon:'🐥',name:'ทักทาย',pose:'wave'},{icon:'🍜',name:'อาหาร',pose:'food'},
 {icon:'🧋',name:'เครื่องดื่ม',pose:'drink'},{icon:'🎒',name:'เดินทาง',pose:'travel'},
 {icon:'📒',name:'จดเงิน',pose:'journal'},{icon:'🌱',name:'เงินออม',pose:'save'},
 {icon:'🥐',name:'มื้อเช้า',pose:'breakfast'},{icon:'🌙',name:'ห่มผ้า',pose:'blanket'},
 {icon:'💤',name:'พักผ่อน',pose:'sleep'},{icon:'📊',name:'กราฟ',pose:'chart'},
];
export function pocketPose(icon?:string|null,name=''):DuckPose{
 const found=pocketArtwork.find(p=>p.icon===icon);if(found)return found.pose;
 if(icon==='☕')return 'drink';
 return /เครื่องดื่ม|กาแฟ/.test(name)?'drink':/อาหาร|ค่ากิน/.test(name)?'food':/เดินทาง|ท่องเที่ยว/.test(name)?'travel':'wave';
}
