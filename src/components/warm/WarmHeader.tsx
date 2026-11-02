import {createContext,useContext,useEffect,type ReactNode} from 'react';
export type WarmBackTarget={to?:string;label:string;onClick?:()=>void};
export const WarmHeaderContext=createContext<{registerBack:(id:string,target:WarmBackTarget|null)=>void;setExamActive:(active:boolean)=>void}>({registerBack:()=>{},setExamActive:()=>{}});
export function useWarmHeader(){return useContext(WarmHeaderContext);}
export function useWarmExam(active:boolean){const {setExamActive}=useWarmHeader();useEffect(()=>{setExamActive(active);return()=>setExamActive(false);},[active,setExamActive]);}
export function WarmHeaderProvider({value,children}:{value:React.ContextType<typeof WarmHeaderContext>;children:ReactNode}){return <WarmHeaderContext.Provider value={value}>{children}</WarmHeaderContext.Provider>;}
