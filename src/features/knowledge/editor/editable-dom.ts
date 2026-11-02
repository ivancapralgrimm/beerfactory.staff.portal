import type {InlineMark as ArticleMark} from "./article-model";
import {richTextSegments} from "./rich-text";
const textSegments = (text: string, marks: ArticleMark[]) => richTextSegments({text, marks});
export type EditorRange={from:number;to:number};
/** Canonical DOM contains text + a small set of semantic wrappers. Never import HTML. */
export function paintEditable(root:HTMLElement,text:string,marks:ArticleMark[]=[]){
  const doc=root.ownerDocument,fragment=doc.createDocumentFragment();
  for(const s of textSegments(text,marks)){
    let node:Node=doc.createTextNode(s.text);
    for(const [type,tag] of [['bold','strong'],['italic','em'],['underline','u'],['highlight','mark']] as const){if(s.marks.includes(type)){const wrap=doc.createElement(tag);wrap.append(node);node=wrap;}}
    fragment.append(node);
  }
  if(text.endsWith('\n')){const tail=doc.createElement('br');tail.dataset.editorTail='true';fragment.append(tail);}
  root.replaceChildren(fragment);
}
function linearize(root:HTMLElement){
  let text='';const points=new Map<Node,{start:number;end:number;children:number[]}>();
  function visit(node:Node){
    const start=text.length,boundaries:number[]=[];
    if(node.nodeType===Node.TEXT_NODE){text+=node.textContent??'';}
    else if(node instanceof HTMLElement&&node.tagName==='BR'){
      const parent=node.parentElement,sole=parent?.childNodes.length===1;
      const placeholder=sole&&(parent===root||parent&&['DIV','P'].includes(parent.tagName)||root.textContent==='');
      const extraTail=!node.nextSibling&&node.previousSibling instanceof HTMLElement&&node.previousSibling.tagName==='BR';
      if(!node.dataset.editorTail&&!placeholder&&!extraTail)text+='\n';
    }else{
      let previousBlock=false,hasPrevious=false;
      for(const child of node.childNodes){
        const block=child instanceof HTMLElement&&['DIV','P'].includes(child.tagName);
        boundaries.push(text.length);
        if(hasPrevious&&(block||previousBlock))text+='\n';
        visit(child);previousBlock=block;hasPrevious=true;
      }
      boundaries.push(text.length);
    }
    points.set(node,{start,end:text.length,children:boundaries});
  }
  visit(root);return {text,points};
}
export function editableText(root:HTMLElement){return linearize(root).text;}
export function editableRange(root:HTMLElement,nativeRange?:Pick<Range,'startContainer'|'startOffset'|'endContainer'|'endOffset'>):EditorRange|null{
  const selection=root.ownerDocument.getSelection();if(!nativeRange&&!selection?.rangeCount)return null;
  const r=nativeRange??selection!.getRangeAt(0);if(!root.contains(r.startContainer)||!root.contains(r.endContainer))return null;
  const model=linearize(root);
  function offset(node:Node,index:number){const info=model.points.get(node);if(!info)return 0;return node.nodeType===Node.TEXT_NODE?Math.min(info.end,info.start+index):info.children[Math.min(index,info.children.length-1)]??info.end;}
  return {from:offset(r.startContainer,r.startOffset),to:offset(r.endContainer,r.endOffset)};
}
export function placeEditableRange(root:HTMLElement,range:EditorRange){
  const doc=root.ownerDocument,walker=doc.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes:Text[]=[];let next;
  while(next=walker.nextNode())nodes.push(next as Text);
  const length=nodes.reduce((n,x)=>n+x.length,0);
  function point(raw:number):[Node,number]{let n=Math.max(0,Math.min(length,raw));for(const node of nodes){if(n<=node.length)return [node,n];n-=node.length;}return [root,0];}
  const a=point(range.from),b=point(range.to),r=doc.createRange();r.setStart(...a);r.setEnd(...b);const selection=doc.getSelection();selection?.removeAllRanges();selection?.addRange(r);
}
