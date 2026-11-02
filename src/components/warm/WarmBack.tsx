import {useId,useLayoutEffect,useRef} from 'react';
import {useWarmHeader} from './WarmHeader';
export function WarmBack({to,label='Назад',onClick}:{to?:string;label?:string;onClick?:()=>void}){
 const id=useId(),{registerBack}=useWarmHeader(),callback=useRef(onClick);callback.current=onClick;
 useLayoutEffect(()=>{registerBack(id,{to,label,onClick:onClick?()=>callback.current?.():undefined});return()=>registerBack(id,null);},[id,to,label,!!onClick,registerBack]);
 return null;
}
