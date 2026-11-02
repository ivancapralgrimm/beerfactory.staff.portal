import type {SVGProps} from 'react';
import {streamlineIcons} from './streamline-icons';
export function WarmIcon({name,size=20,...props}:SVGProps<SVGSVGElement>&{name:string;size?:number}){
 if(!Object.hasOwn(streamlineIcons,name))throw new Error('Unknown BFStaff Plump icon: '+name);
 return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false" data-icon-family="streamline-plump-line-free" {...props}>{streamlineIcons[name]}</svg>;
}
