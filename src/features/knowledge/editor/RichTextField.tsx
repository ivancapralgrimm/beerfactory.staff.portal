import { useRef, useState, useLayoutEffect, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { RichText, InlineMarkType as ArticleMarkType } from "./article-model";
import { editRichText, toggleRichMark, clearMarks, normalizeMarks, rangeMarked, markTypes } from "./rich-text";
import { paintEditable, editableRange, editableText, placeEditableRange, type EditorRange } from "./editable-dom";
const editMarks = (before: string, after: string, marks: RichText["marks"]) => editRichText({text: before, marks}, after).marks;
const toggleMark = (text: string, marks: RichText["marks"], type: ArticleMarkType, from: number, to: number) => toggleRichMark({text, marks}, type, from, to).marks;
const formats=[['bold','Жирный',<b>B</b>],['italic','Курсив',<i>I</i>],['underline','Подчёркнутый',<u>U</u>]] as const;
export function RichTextField({ id, label, value, onChange, leading, actions, textClassName = "", disabled = false, underlineAvailable = true }: {
  id: string; label: string; value: RichText; onChange: (next: RichText) => void;
  leading?: ReactNode; actions?: ReactNode; deferredFormatting?: boolean; disabled?: boolean; textClassName?: string; underlineAvailable?: boolean;
}) {
  const block = value;
  const history = useRef<{past: RichText[]; future: RichText[]}>({past: [], future: []}).current;
  const ref=useRef<HTMLDivElement>(null),restore=useRef<EditorRange|null>(null),composing=useRef(false),compositionRange=useRef<EditorRange|null>(null),nativeRange=useRef<EditorRange|null>(null);
  const [range,setRange]=useState<EditorRange>({from:0,to:0}),rangeRef=useRef(range);
  const pending=useRef<{at:number;types:ArticleMarkType[]}|null>(null),[,refresh]=useState(0);
  function capture(){if(composing.current||nativeRange.current)return;const root=ref.current;if(!root)return;const r=editableRange(root);if(!r)return;rangeRef.current=r;setRange(r);if(pending.current&&(r.from!==r.to||r.from!==pending.current.at)){pending.current=null;refresh(n=>n+1);}}
  function focus(rangeToUse:EditorRange){const root=ref.current;if(!root)return;root.focus({preventScroll:true});placeEditableRange(root,rangeToUse);rangeRef.current=rangeToUse;setRange(rangeToUse);}
  useLayoutEffect(()=>{
    const root=ref.current;if(!root||composing.current)return;
    const current=restore.current??(root===document.activeElement?editableRange(root):null);
    paintEditable(root,block.text,block.marks);restore.current=null;
    if(current)focus({from:Math.min(current.from,block.text.length),to:Math.min(current.to,block.text.length)});
  },[block]);
  const captureRef=useRef(capture);captureRef.current=capture;
  useEffect(()=>{const listen=()=>captureRef.current();document.addEventListener('selectionchange',listen);return()=>document.removeEventListener('selectionchange',listen);},[]);
  function snapshot():RichText{return {text:block.text,marks:normalizeMarks(block.text,block.marks)};}
  function commit(next:RichText,caret?:EditorRange){
    if(caret)restore.current=caret;
    if(next.text===block.text&&JSON.stringify(next.marks??[])===JSON.stringify(block.marks??[])){if(caret)focus(caret);restore.current=null;return;}
    history.past.push(snapshot());if(history.past.length>50)history.past.shift();history.future=[];onChange(next);
  }
  function stylesAt(at:number,selected=false){const pos=Math.max(0,Math.min(block.text.length-1,selected?at:at-1));return markTypes.filter(type=>(block.marks??[]).some(m=>m.type===type&&m.from<=pos&&m.to>pos));}
  function format(type:'bold'|'italic'|'underline'){
    if(disabled || type === 'underline' && !underlineAvailable)return;
    const r=rangeRef.current;
    if(r.from===r.to){const active=pending.current?.at===r.from?pending.current.types:stylesAt(r.from);pending.current={at:r.from,types:active.includes(type)?active.filter(t=>t!==type):[...active,type]};focus(r);refresh(n=>n+1);return;}
    pending.current=null;commit({...block,marks:toggleMark(block.text,block.marks??[],type,r.from,r.to)},r);
  }
  function insert(value:string){
    const r=editableRange(ref.current!)??rangeRef.current,text=value.replace(/\r\n?/g,'\n');
    if(!text)return;
    if(block.text.length-(r.to-r.from)+text.length>100000)return;
    const next=block.text.slice(0,r.from)+text+block.text.slice(r.to),end=r.from+text.length;
    let marks=editMarks(block.text,next,block.marks),active=pending.current?.at===r.from?pending.current.types:stylesAt(r.from,r.to>r.from);
    marks=clearMarks(next,marks,r.from,end);marks=normalizeMarks(next,[...marks,...active.map(type=>({type,from:r.from,to:end}))]);
    pending.current={at:end,types:active};commit({...block,text:next,marks},{from:end,to:end});
  }
  function acceptNative(){
    const root=ref.current;if(!root||composing.current)return;
    const text=editableText(root),r=editableRange(root)??rangeRef.current;
    if(text.length>100000){paintEditable(root,block.text,block.marks);focus({from:block.text.length,to:block.text.length});return;}
    let marks=editMarks(block.text,text,block.marks);
    const base=compositionRange.current??nativeRange.current;compositionRange.current=null;nativeRange.current=null;
    if(base&&pending.current?.at===base.from){const end=base.from+text.length-(block.text.length-(base.to-base.from));if(end>base.from){const active=pending.current.types;marks=normalizeMarks(text,[...clearMarks(text,marks,base.from,end),...active.map(type=>({type,from:base.from,to:end}))]);pending.current={at:r.to,types:active};}}
    commit({...block,text,marks},r);
  }
  function travel(redo:boolean){
    const source=redo?history.future:history.past,destination=redo?history.past:history.future,next=source.pop();if(!next)return;
    destination.push(snapshot());pending.current=null;const r=rangeRef.current;restore.current={from:Math.min(r.from,next.text.length),to:Math.min(r.to,next.text.length)};onChange({...block,...next});
  }
  function beforeInput(e:InputEvent){
    if(composing.current||e.isComposing)return;
    if(e.inputType.startsWith('insert'))nativeRange.current=editableRange(ref.current!,e.getTargetRanges?.()[0])??rangeRef.current;
    if(!e.cancelable)return;
    if(e.inputType==='historyUndo'||e.inputType==='historyRedo'){e.preventDefault();travel(e.inputType==='historyRedo');return;}
    const type=({formatBold:'bold',formatItalic:'italic',formatUnderline:'underline'} as const)[e.inputType as 'formatBold'|'formatItalic'|'formatUnderline'];
    if(type){e.preventDefault();nativeRange.current=null;format(type);return;}
    if(e.inputType==='insertParagraph'||e.inputType==='insertLineBreak'){e.preventDefault();nativeRange.current=null;insert('\n');return;}
    if(e.inputType==='insertText'&&e.data!==null){e.preventDefault();nativeRange.current=null;insert(e.data);}
  }
  const beforeRef=useRef(beforeInput);beforeRef.current=beforeInput;
  useEffect(()=>{const root=ref.current;if(!root)return;const listen=(e:InputEvent)=>beforeRef.current(e);root.addEventListener('beforeinput',listen);return()=>root.removeEventListener('beforeinput',listen);},[]);
  function pressed(type:'bold'|'italic'|'underline'){return range.from===range.to?(pending.current?.at===range.from?pending.current.types:stylesAt(range.from)).includes(type):rangeMarked(block.text,block.marks??[],type,range.from,range.to);}
  return <div className="bf-rich-editor"><div className="bf-rich-topline"><div role="group" aria-label={`Оформление: ${label}`} className="bf-rich-tools">{leading}{formats.map(([type,name,icon])=><Button key={type} className="bf-format-control" variant="ghost" disabled={disabled || composing.current || type === 'underline' && !underlineAvailable} aria-label={name} title={name} aria-pressed={pressed(type)} type="button" onPointerDown={e=>e.preventDefault()} onClick={()=>format(type)}><span aria-hidden="true">{icon}</span></Button>)}</div>{actions}</div><div ref={ref} data-block-focus className={`bf-live-text ${textClassName}`} id={id} role="textbox" aria-label={label} aria-multiline="true" contentEditable={!disabled} aria-disabled={disabled} suppressContentEditableWarning tabIndex={0} data-placeholder={label} onFocus={capture} onInput={acceptNative} onCompositionStart={()=>{compositionRange.current=editableRange(ref.current!)??rangeRef.current;composing.current=true;refresh(n=>n+1);}} onCompositionEnd={()=>{composing.current=false;acceptNative();refresh(n=>n+1);}} onPaste={e=>{e.preventDefault();if(!disabled)insert(e.clipboardData.getData('text/plain'));}} onDrop={e=>{e.preventDefault();if(disabled)return;const text=e.dataTransfer.getData('text/plain');if(!text)return;const r=document.caretRangeFromPoint?.(e.clientX,e.clientY);if(r&&ref.current?.contains(r.startContainer)){const selection=document.getSelection();selection?.removeAllRanges();selection?.addRange(r);}insert(text);}} onKeyDown={e=>{if(disabled||e.nativeEvent.isComposing||!(e.metaKey||e.ctrlKey)||e.altKey)return;const key=e.key.toLowerCase();if(key==='z'||key==='y'){e.preventDefault();travel(key==='y'||e.shiftKey);return;}const type=({b:'bold',i:'italic',u:'underline'} as const)[key as 'b'|'i'|'u'];if(type){e.preventDefault();format(type);}}}/></div>;
}
