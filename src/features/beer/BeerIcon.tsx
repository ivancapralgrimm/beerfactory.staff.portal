import {streamlineIcons} from './BeerIconsSource';
export function BeerIcon({name,size=20}:{name:'back'|'chevron'|'arrow'|'check';size?:number}){
 return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false" data-icon-family="streamline-plump-line-free">{streamlineIcons[name]}</svg>;
}
