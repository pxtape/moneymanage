import navigation from '../assets/painted-navigation.webp';
export type NavigationName='home'|'wallets'|'insights'|'compare'|'settings'|'records';
const cells:Record<NavigationName,number>={home:0,wallets:1,insights:2,compare:3,settings:4,records:5};
export function NavigationArtwork({name,size=28,className=''}:{name:NavigationName;size?:number;className?:string}){
 const cell=cells[name];
 return <span className={`navigation-artwork ${className}`} aria-hidden="true" style={{width:size,height:size,backgroundImage:`url(${navigation})`,backgroundPosition:`${cell%3*50}% ${Math.floor(cell/3)*100}%`}}/>;
}
