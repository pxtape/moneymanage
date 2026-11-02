import { pocketPose } from "../pocket-artwork";
import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Croissant, Moon, NotebookPen, Plus, Search } from 'lucide-react';
import { duckMoment } from '../duck-companions';
import { DuckMascot, type DuckPose } from './DuckMascot';

export function TimeDuck({className=''}:{className?:string}) {
 const [moment,setMoment]=useState(()=>duckMoment());
 useEffect(()=>{const timer=window.setInterval(()=>setMoment(duckMoment()),60000);return()=>window.clearInterval(timer)},[]);
 return <span className={`time-duck ${className}`} data-moment={moment} aria-hidden="true"><DuckMascot pose={moment==='day'?'journal':moment==='night'?'blanket':'breakfast'}/>{moment==='night'?<Moon className="time-duck-prop" size={14}/>:moment==='morning'?<Croissant className="time-duck-prop" size={17}/>:<NotebookPen className="time-duck-prop" size={15}/>}</span>;
}
export function DuckPlus(){return <span className="duck-plus" aria-hidden="true"><span className="duck-plus-painted"><DuckMascot pose="meter"/></span><Plus size={20}/></span>}
export function AmountDuck({value,busy=false,name,icon,pose="record"}:{value:string;busy?:boolean;name?:string;icon?:string;pose?:DuckPose}){return <span className={`amount-duck ${busy?'is-writing':''}`} aria-hidden="true" style={{'--duck-look':`${Math.min(value.length,12)-4}px`} as CSSProperties}><DuckMascot pose={busy?'record':name&&(/อาหาร|ค่ากิน/.test(name)||['🍜','🥗'].includes(icon||''))?'noodles':name&&(/เดินทาง|ท่องเที่ยว/.test(name)||['🚆','🚗','✈️'].includes(icon||''))?'commute':pose}/><i>{busy?'จดอยู่…':''}</i></span>}
export function DuckStamp(){return <span className="duck-stamp" aria-hidden="true"><DuckMascot pose="celebrate"/><b>จดแล้ว</b></span>}
export function PocketDuck({name,icon}:{name:string;icon?:string|null}){
 return <span className="pocket-duck" aria-hidden="true"><DuckMascot pose={pocketPose(icon,name)}/></span>;
}
export function DuckSavingsJar({saved,target}:{saved:number;target:number}){
 const [drop,setDrop]=useState(false);const previous=useRef(saved);
 useEffect(()=>{const increased=saved>previous.current;previous.current=saved;if(!increased){setDrop(false);return}setDrop(true);const timer=window.setTimeout(()=>setDrop(false),800);return()=>window.clearTimeout(timer)},[saved]);
 return <div className={`goal-duck-scene illustrated-saving ${drop?'coin-earned':''}`} aria-hidden="true"><DuckMascot pose={target>0&&saved>=target?'celebrate':'deposit'}/></div>;
}
export function ChartDuck({message}:{message:string}){
 const [open,setOpen]=useState(false);const id=useId();
 return <div className="chart-duck-review"><button type="button" aria-label="น้องช่วยอ่านกราฟ" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(v=>!v)}><DuckMascot pose="chart"/><Search size={14}/><span>น้องช่วยดู</span></button>{open&&<p id={id} className="duck-speech">{message}</p>}</div>;
}
export function PersonDuck({person}:{person:'tape'|'pat'}){return <span className={`person-duck person-duck-${person}`} aria-hidden="true"><DuckMascot pose={person==='pat'?'tea':'wave'}/><i/></span>}
export function DuckLoading({text='กำลังเปิดสมุด…',failed=false,onRetry}:{text?:string;failed?:boolean;onRetry?:()=>void}){
 return <div className={`duck-loading ${failed?'failed':''}`}><DuckMascot pose={failed?'search':'record'}/><p>{text}</p>{onRetry&&<button className="button button-outline" onClick={onRetry}>ลองอีกที</button>}</div>;
}
