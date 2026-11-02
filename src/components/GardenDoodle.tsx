import motifs from '../assets/painted-garden-motifs.webp';
import { DuckMascot } from './DuckMascot';
const cells={flower:0,sprout:1,heart:2,leaf:3,coins:4,daisy:5};
export function GardenDoodle({kind='sprout',className=''}:{kind?:keyof typeof cells;className?:string}){
 const cell=cells[kind];
 return <span className={`garden-doodle ${className}`} aria-hidden="true" style={{backgroundImage:`url(${motifs})`,backgroundPosition:`${cell%3*50}% ${Math.floor(cell/3)*100}%`,backgroundSize:'300% 200%'}}/>;
}
export function DuckPerch(){return <span className="duck-perch" aria-hidden="true"><DuckMascot pose="meter"/></span>}
