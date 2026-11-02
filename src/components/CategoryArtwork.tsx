import { DuckMascot } from './DuckMascot';
import { inferCategoryArtwork } from '../category-artwork';
import icons from '../assets/painted-category-icons.webp';
const cells:Record<string,number>={'🍜':0,'🥗':0,'☕':1,'🧋':2,'🚆':3,'🚗':4,'🛍️':5,'🏠':6,'💡':7,'💧':8,'📱':9,'🌿':10,'💊':11,'🐾':12,'🎮':13,'🎁':14,'✈️':15,'📚':16,'💇':17,'🧾':18,'🔧':19,'💼':20,'👕':21,'🎀':22,'💰':23};
export function CategoryArtwork({icon,name='',className=''}:{icon?:string|null;name?:string;className?:string}){
 const cell=cells[icon||inferCategoryArtwork(name)];
 return <span className={`category-artwork ${className}`} aria-hidden="true">{cell===undefined?<DuckMascot pose="meter"/>:<span className="painted-category-icon" style={{backgroundImage:`url(${icons})`,backgroundPosition:`${cell%6/5*100}% ${Math.floor(cell/6)/3*100}%`}}/>}</span>;
}
