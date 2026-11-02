import { useSyncExternalStore } from 'react';
export type Theme='light';
export function readTheme():Theme{return 'light'}
let error='';
const listeners=new Set<()=>void>();
function apply(){if(typeof document!=='undefined'){document.documentElement.dataset.theme='light';document.documentElement.style.colorScheme='light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content','#fff9ed')}}
export function setTheme(){error='';try{localStorage.setItem('moneyspace-theme','light')}catch{error='บันทึกการตั้งค่าบนเครื่องนี้ไม่ได้'}apply();listeners.forEach(fn=>fn())}
apply();try{localStorage.setItem('moneyspace-theme','light')}catch{/* The cream theme also works without storage. */}
if(typeof window!=='undefined')window.addEventListener('storage',e=>{if(e.key==='moneyspace-theme'||e.key===null)apply()});
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}};
export function useTheme(){const warning=useSyncExternalStore(subscribe,()=>error);return {theme:'light' as const,light:true,error:warning,setTheme}}
