import { DuckMascot } from "./DuckMascot";
import { artwork, inferCategoryArtwork } from "../category-artwork";
export function CategoryArtwork({icon,name='',className=''}:{icon?:string|null;name?:string;className?:string}) {
 const item = artwork[(icon || inferCategoryArtwork(name)) as keyof typeof artwork];
 return <span className={`category-artwork ${className}`} aria-hidden="true">{item ? <item.Icon size={25} strokeWidth={1.7}/> : <DuckMascot pose="wave"/>}<i/></span>;
}
