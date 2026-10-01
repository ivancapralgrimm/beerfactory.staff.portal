import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const input = path.join(root, "assets", "training-data.txt");
const output = path.join(root, "supabase", "migrations", "20260930152047_r40_5_knowledge_legacy_seed_v1.sql");
const source = fs.readFileSync(input, "utf8").replace(/\r/g, "");

const IMAGE_RX=/^!\[([^\]]*)\]\(([^)\s]+)\)$/u;
const LIST_RX=/^(?:[-•]\s+|\d+[.)]\s+)(.*)$/u;
const INLINE_RX=/(\*\*.+?\*\*|==.+?==|\*.+?\*)/gu;

function cleanCategory(raw,title=""){
  const category=raw.replace(/[\p{Extended_Pictographic}\uFE0F]/gu,"").replace(/^[\s:·-]+|[\s:·-]+$/g,"").trim();
  if(/как появилось пиво/i.test(title)) return "Пиво";
  if(/крепкий алкоголь/i.test(category)) return "Алкоголь";
  if(/винная карта/i.test(category)||/^вино$/i.test(category)) return "Вино";
  if(/сервис/i.test(category)) return "Сервис";
  if(/пиво/i.test(category)) return "Пиво";
  if(/бар/i.test(category)) return "Бар";
  if(/кухн/i.test(category)) return "Кухня";
  if(/sop|инструкц/i.test(category)) return "SOP";
  return category||"Обучение";
}
function plainText(value){return String(value??"").replace(/!\[[^\]]*\]\([^)]+\)/g," ").replace(/[*=#>_]/g,"").replace(/\s+/g," ").trim();}
function inline(text){
  let out="",cursor=0; const marks=[];
  for(const match of text.matchAll(INLINE_RX)){
    const index=match.index??0; out+=text.slice(cursor,index); const token=match[0];
    let type,content;
    if(token.startsWith("**")){type="bold";content=token.slice(2,-2);}
    else if(token.startsWith("==")){type="highlight";content=token.slice(2,-2);}
    else {type="italic";content=token.slice(1,-1);}
    const from=out.length; out+=content; if(content.length) marks.push({type,from,to:out.length}); cursor=index+token.length;
  }
  out+=text.slice(cursor); return {text:out,marks};
}
function topic(value){return value.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]+/gu," ").trim();}
function blocks(articleId,title,body){
  const out=[]; let paragraph=[],list=null; const topics=new Set(title.split(/\s*,\s*/u).map(topic).filter(Boolean));
  const push=(b)=>out.push({id:`${articleId}_block_${out.length+1}`,...b});
  const fp=()=>{if(!paragraph.length)return;if(paragraph.length===1){const m=paragraph[0].match(/^\*\*([^*]+)\*\*$/u);if(m&&topics.has(topic(m[1]))){push({type:"heading",level:2,content:inline(m[1])});paragraph=[];return;}}push({type:"paragraph",content:inline(paragraph.join("\n"))});paragraph=[];};
  const fl=()=>{if(!list)return;push({type:"list",ordered:list.ordered,items:list.items});list=null;};
  const flush=()=>{fp();fl();};
  for(const raw of body.split("\n")){
    const line=raw.trim(); if(!line){flush();continue;}
    const im=line.match(IMAGE_RX); if(im){flush();push({type:"image",legacySrc:im[2].replace(/^\//,""),alt:im[1],caption:"",name:""});continue;}
    if(/^(?:-{3,}|_{3,})$/u.test(line)){flush();push({type:"separator"});continue;}
    const h=line.match(/^(#{1,6})\s+(.*)$/u); if(h){flush();push({type:"heading",level:h[1].length>=3?3:2,content:inline(h[2])});continue;}
    if(/^>\s?/u.test(line)){flush();push({type:"quote",content:inline(line.replace(/^>\s?/u,""))});continue;}
    const li=line.match(LIST_RX); if(li){const ordered=/^\d/u.test(line);if(paragraph.length||(list&&list.ordered!==ordered))flush();if(!list)list={ordered,items:[]};list.items.push(inline(li[1]));continue;}
    if(list)fl(); paragraph.push(line);
  }
  flush(); return out;
}
let rawCategory="Обучение",active=null; const all=[];
for(const line of source.split("\n")){
  if(line.startsWith("### ")){rawCategory=line.slice(4).trim().replace(/:$/,""),active=null;continue;}
  if(line.startsWith("## ")){active={id:`lesson-${all.length+1}`,rawCategory,title:line.slice(3).trim(),body:""};all.push(active);continue;}
  if(active) active.body+=`${line}\n`;
}
const articles=all.filter(a=>!/^Раздел в разработке$/i.test(a.title)).map(a=>{
  const body=a.body.trim(), plain=plainText(body), description=plain.length>170?`${plain.slice(0,170).trim()}…`:plain;
  const bs=blocks(a.id,a.title,body); const category=cleanCategory(a.rawCategory,a.title);
  const search=[a.title,category,description,...bs.flatMap(b=>b.content?[b.content.text]:b.items?b.items.map(i=>i.text):b.type==="image"?[b.alt,b.caption]:[])].filter(Boolean).join(" ").replace(/\s+/g," ").trim();
  return {id:a.id,category,title:a.title,description,sort_order:Number(a.id.split("-")[1])*10,search_text:search,blocks:bs};
});
const bc=articles.reduce((n,a)=>n+a.blocks.length,0), ic=articles.reduce((n,a)=>n+a.blocks.filter(b=>b.type==="image").length,0);
if(articles.length!==26||bc!==351||ic!==12) throw new Error(`guard failed: ${articles.length}/${bc}/${ic}`);
const q=v=>`'${String(v).replace(/'/g,"''")}'`, jq=v=>`${q(JSON.stringify(v))}::jsonb`; const sql=[];
for(const a of articles){
  sql.push(`insert into public.knowledge_articles(id,category,title,description,status,sort_order,dashboard_featured,search_text,revision,created_by,updated_by,created_at,updated_at,published_at) values (${q(a.id)},${q(a.category)},${q(a.title)},${q(a.description)},'published',${a.sort_order},false,${q(a.search_text)},1,null,null,clock_timestamp(),clock_timestamp(),clock_timestamp());`);
  a.blocks.forEach((b,index)=>{
    let text="null",marks=`'[]'::jsonb`,heading="null",ordered="null",items="null",legacy="null",alt="''",caption="''",name="''";
    if(b.content){text=q(b.content.text);marks=jq(b.content.marks);if(b.type==="heading")heading=String(b.level);}
    else if(b.items){ordered=b.ordered?"true":"false";items=jq(b.items);}
    else if(b.type==="image"){legacy=q(b.legacySrc);alt=q(b.alt);caption=q(b.caption);name=q(b.name);}
    sql.push(`insert into public.knowledge_article_blocks(id,article_id,sort_order,block_type,text_content,marks,heading_level,list_ordered,list_items,media_id,legacy_src,alt_text,caption,media_name) values (${q(b.id)},${q(a.id)},${index*10},${q(b.type)},${text},${marks},${heading},${ordered},${items},null,${legacy},${alt},${caption},${name});`);
  });
}
fs.mkdirSync(path.dirname(output),{recursive:true}); fs.writeFileSync(output,sql.join("\n")+"\n");
console.log(JSON.stringify({output,articles:articles.length,blocks:bc,images:ic},null,2));
