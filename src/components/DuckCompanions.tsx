import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Croissant, Moon, NotebookPen, Plus, Search } from 'lucide-react';
import { duckMoment } from '../duck-companions';
import { DuckMascot } from './DuckMascot';
import { DuckFace } from './DuckFace';
import { CategoryArtwork } from './CategoryArtwork';

export function TimeDuck({className=''}:{className?:string}) {
 const [moment,setMoment]=useState(()=>duckMoment());
 useEffect(()=>{const timer=window.setInterval(()=>setMoment(duckMoment()),60000);return()=>window.clearInterval(timer)},[]);
 return <span className={`time-duck ${className}`} data-moment={moment} aria-hidden="true"><DuckMascot pose={moment==='day'?'journal':moment==='night'?'blanket':'breakfast'}/>{moment==='night'?<Moon className="time-duck-prop" size={14}/>:moment==='morning'?<Croissant className="time-duck-prop" size={17}/>:<NotebookPen className="time-duck-prop" size={15}/>}</span>;
}
export function DuckPlus(){return <span className="duck-plus" aria-hidden="true"><svg viewBox="0 0 60 66"><g transform="translate(30 32)"><DuckFace/></g></svg><Plus size={20}/></span>}
export function AmountDuck({value,busy=false,name,icon}:{value:string;busy?:boolean;name?:string;icon?:string}){return <span className={`amount-duck ${busy?'is-writing':''}`} aria-hidden="true" style={{'--duck-look':`${Math.min(value.length,12)-4}px`} as CSSProperties}><>{name&&!busy?<PocketDuck name={name} icon={icon}/>:<DuckMascot pose="journal"/>}</><i>{busy?'จดอยู่…':''}</i></span>}
export function DuckStamp(){return <span className="duck-stamp" aria-hidden="true"><DuckMascot pose="journal"/><b>จดแล้ว</b></span>}
export function PocketDuck({name,icon}:{name:string;icon?:string|null}){
 return <span className="pocket-duck" aria-hidden="true"><DuckMascot pose={/เครื่องดื่ม|กาแฟ/.test(name)?'drink':/อาหาร|ค่ากิน/.test(name)?'food':/เดินทาง|ท่องเที่ยว/.test(name)?'travel':'wave'}/><CategoryArtwork name={name} icon={icon}/></span>;
}
export function DuckSavingsJar({saved,target}:{saved:number;target:number}){
 const clip=useId();const [drop,setDrop]=useState(false);const previous=useRef(saved);
 useEffect(()=>{const increased=saved>previous.current;previous.current=saved;if(!increased){setDrop(false);return}setDrop(true);const timer=window.setTimeout(()=>setDrop(false),800);return()=>window.clearTimeout(timer)},[saved]);
 const p=Math.min(1,Math.max(0,target>0?saved/target:0));
 return <div className={`goal-duck-scene ${drop?'coin-earned':''}`} aria-hidden="true"><DuckMascot pose="save"/><svg viewBox="0 0 90 100" className="goal-jar"><defs><clipPath id={clip}><rect x="16" y="20" width="59" height="69" rx="13"/></clipPath></defs><rect x="16" y="20" width="59" height="69" rx="13" fill="var(--duck-card)" stroke="var(--duck-ink)" strokeWidth="2"/><g clipPath={`url(#${clip})`}><rect className="jar-fill" x="17" y={89-p*68} width="57" height={p*68} fill="var(--duck-yellow)"/>{Array.from({length:Math.ceil(p*12)},(_,i)=><circle key={i} cx={28+(i%3)*18} cy={80-Math.floor(i/3)*16} r="7" fill="#f0c16b" stroke="#ae8250" strokeWidth="1"/>)}</g><rect x="23" y="12" width="45" height="12" rx="5" fill="var(--duck-blush)" stroke="var(--duck-ink)" strokeWidth="2"/><path d="M35 17H55" stroke="var(--duck-ink)" strokeWidth="2" strokeLinecap="round"/>{drop&&<circle className="jar-coin" cx="45" cy="5" r="6" fill="#f0c16b" stroke="#ae8250"/>}</svg></div>;
}
export function ChartDuck({message}:{message:string}){
 const [open,setOpen]=useState(false);const id=useId();
 return <div className="chart-duck-review"><button type="button" aria-label="น้องช่วยอ่านกราฟ" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(v=>!v)}><DuckMascot pose="chart"/><Search size={14}/><span>น้องช่วยดู</span></button>{open&&<p id={id} className="duck-speech">{message}</p>}</div>;
}
export function PersonDuck({person}:{person:'tape'|'pat'}){return <span className={`person-duck person-duck-${person}`} aria-hidden="true"><DuckMascot pose={person==='pat'?'tea':'wave'}/><i/></span>}
export function DuckLoading({text='กำลังเปิดสมุด…',failed=false,onRetry}:{text?:string;failed?:boolean;onRetry?:()=>void}){
 return <div className={`duck-loading ${failed?'failed':''}`}><DuckMascot pose={failed?'wave':'journal'}/><p>{text}</p>{onRetry&&<button className="button button-outline" onClick={onRetry}>ลองอีกที</button>}</div>;
}
