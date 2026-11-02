import type { CSSProperties } from 'react';
import { decimalSatang } from '../ledger';
import { shortBaht } from '../finance';
import { DuckMascot } from './DuckMascot';
import { pocketPose } from '../pocket-artwork';
export function BudgetTile({name,icon,target,spent,remaining,color,onEdit,hidden=false}:{name:string;icon?:string|null;target:string;spent:string;remaining:string;color?:string|null;onEdit?:()=>void;hidden?:boolean}){
 const cap=decimalSatang(target),used=decimalSatang(spent),left=decimalSatang(remaining);const percent=cap>0?Math.max(0,used/cap*100):0;
 const amount=(n:number)=>hidden?'••••':shortBaht(n);
 const content=<><DuckMascot pose={pocketPose(icon,name)} className="budget-tile-art"/><h3>{name}</h3><span className="budget-tile-caption">{cap===0?'ไม่ตั้งงบ':left<0?'เกิน':'เหลือ'}</span><strong className={left<0?'overspent-label':''}>{amount(Math.abs(left))}</strong><div className="budget-tile-track" role="progressbar" aria-label={`ใช้ไป ${name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100,percent))}><i style={{width:`${Math.min(100,percent)}%`}}/></div><small>{amount(used)} / {amount(cap)}</small></>;
 const props={className:'budget-tile',style:{'--tile-accent':color||'#a9bb91'} as CSSProperties};
 return onEdit?<button {...props} type="button" aria-label={`แก้งบ ${name}`} onClick={onEdit}>{content}</button>:<article {...props}>{content}</article>;
}
