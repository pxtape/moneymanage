import { incomeCategories } from "./income-categories";
import { Soup, Salad, Coffee, CupSoda, TrainFront, Car, ShoppingBag, House, Lightbulb, Droplet, Smartphone, Sprout, Pill, PawPrint, Gamepad2, Gift, Plane, BookOpen, Scissors, ReceiptText, Wrench, BriefcaseBusiness, Shirt, Ribbon, Wallet } from 'lucide-react';
export const artwork = {
 '🍜': {name:'อาหาร',Icon:Soup}, '🥗':{name:'ผักและอาหาร',Icon:Salad}, '☕':{name:'กาแฟ',Icon:Coffee},'🧋':{name:'เครื่องดื่ม',Icon:CupSoda},
 '🚆':{name:'รถไฟ',Icon:TrainFront},'🚗':{name:'รถยนต์',Icon:Car},'🛍️':{name:'ช้อปปิ้ง',Icon:ShoppingBag},'🏠':{name:'บ้าน',Icon:House},
 '💡':{name:'ค่าไฟ',Icon:Lightbulb},'💧':{name:'ค่าน้ำ',Icon:Droplet},'📱':{name:'โทรศัพท์',Icon:Smartphone},'🌿':{name:'ออมและเติบโต',Icon:Sprout},
 '💊':{name:'สุขภาพ',Icon:Pill},'🐾':{name:'สัตว์เลี้ยง',Icon:PawPrint},'🎮':{name:'เกม',Icon:Gamepad2},'🎁':{name:'ของขวัญ',Icon:Gift},
 '✈️':{name:'ท่องเที่ยว',Icon:Plane},'📚':{name:'เรียน',Icon:BookOpen},'💇':{name:'ดูแลตัวเอง',Icon:Scissors},'🧾':{name:'บิล',Icon:ReceiptText},
 '🔧':{name:'งานและซ่อมแซม',Icon:Wrench},'💼':{name:'ทำงาน',Icon:BriefcaseBusiness},'👕':{name:'เสื้อผ้า',Icon:Shirt},'🎀':{name:'เงินที่ได้รับ',Icon:Ribbon},'💰':{name:'รายได้',Icon:Wallet},
};
export const artworkOptions = [...Object.entries(artwork).map(([code,{name}])=>({code,name})),{code:'✳️',name:'น้องเป็ด'}];
export function inferCategoryArtwork(name:string) {const income = incomeCategories.find(c=>c.name===name);if(income)return income.icon;return /เงินเดือน|ทำงาน/.test(name)?'💼':/รับจ้าง/.test(name)?'🔧':/อาหาร|ค่ากิน/.test(name)?'🍜':/เครื่องดื่ม|กาแฟ/.test(name)?'☕':/เดินทาง/.test(name)?'🚆':/บ้าน|ที่อยู่/.test(name)?'🏠':/สุขภาพ/.test(name)?'💊':'✳️';}
