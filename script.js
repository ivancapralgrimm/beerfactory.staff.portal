const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const page=document.body.dataset.page;

function bindDrawer(){
  const drawer=$("#drawer"), overlay=$("#drawerOverlay"), btn=$("#menuBtn"), close=$("#drawerClose");
  if(!drawer||!overlay||!btn)return;
  const open=()=>{drawer.classList.add("open");overlay.classList.add("open");document.body.style.overflow="hidden"};
  const shut=()=>{drawer.classList.remove("open");overlay.classList.remove("open");document.body.style.overflow=""};
  btn.onclick=open; if(close)close.onclick=shut; overlay.onclick=shut;
  return shut;
}
function bindSearch(onInput){
  const slot=$("#searchSlot"), input=$("#search"), trigger=$("#searchIconBtn");
  if(!slot||!input||!trigger)return;
  trigger.onclick=()=>{slot.classList.add("open");input.focus()};
  input.onblur=()=>{if(!input.value.trim())slot.classList.remove("open")};
  input.oninput=()=>onInput(input.value.trim());
}
function bindTop(){
  const b=$("#toTop");if(!b)return;
  const update=()=>b.classList.toggle("visible",scrollY>innerHeight*.6);
  addEventListener("scroll",update,{passive:true});update();
  b.onclick=()=>scrollTo({top:0,behavior:"smooth"});
}
function escapeHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function escapeAttr(s){return escapeHtml(s).replace(/\'/g,"&#39;")}

async function initMenu(){
  const BAR_SUBS=["Б/А напитки","Коктейли","Лимонады","Крепкий алкоголь","Вино","Кофе","Чай","Сезонное предложение","Пиво","Бутылочное Пиво","Настойки","Заготовки"];
  const KITCHEN_SUBS=["Горячие закуски","Холодные закуски","Намазки","Салаты","Супы","Горячие блюда","Гарниры","Соусы","Десерты"];
  const BAR_LEGACY={"Коктейли":"Коктейли","Настойка":"Настойки","Настойки":"Настойки","Лимонад":"Лимонады","Лимонады":"Лимонады","Крепкий алкоголь":"Крепкий алкоголь","Вино":"Вино","Кофе":"Кофе","Чай":"Чай","Пиво":"Пиво","Бутылочное Пиво":"Бутылочное Пиво","Заготовка":"Заготовки","Заготовки":"Заготовки","Б/А напитки":"Б/А напитки","Сезонное предложение":"Сезонное предложение"};
  const KITCHEN_LEGACY=Object.fromEntries(KITCHEN_SUBS.map(x=>[x,x]));
  const ITEMS=[
    {name:"Яблоко-Саган",cat:"Бар",subcat:"Коктейли",tags:["ягодный","освежающий"],compound:"Джин 40мл · яблочный сок 60мл · сироп саган-дайля 15мл · лайм",method:"Шейк со льдом, двойное процеживание",serving:"Коктейльный бокал, долька яблока"},
    {name:"Дымная Гавана",cat:"Бар",subcat:"Коктейли",tags:["ромовый","крепкий"],compound:"Тёмный ром 45мл · ананасовый сок 40мл · лайм 15мл · биттер",method:"Билд в стакане на льду, лёгкое копчение веточкой розмарина",serving:"Хайбол, лёд-кубик"},
    {name:"Полынная Горечь",cat:"Бар",subcat:"Коктейли",tags:["горький","аперитив"],compound:"Джин 35мл · Апероль 25мл · тоник · долька грейпфрута",method:"Билд в бокале со льдом, аккуратно долить тоник",serving:"Бокал для вина, лёд"},
    {name:"Овсяный Штиль",cat:"Бар",subcat:"Б/А напитки",tags:["сливочный","без алкоголя"],compound:"Овсяное молоко 100мл · эспрессо 30мл · кленовый сироп 10мл",method:"Взбить шейкером без льда, перелить на лёд",serving:"Рокс, корица сверху"},
    {name:"Настойка «Перцовая»",cat:"Бар",subcat:"Настойки",tags:["острая","крепкая"],compound:"Водка 1л\nПерец Болгарский 80гр\nПерец Чили 40гр\nПерец Горошек 15гр\nСахарный Сироп 150мл",method:"Настаивать 10–14 дней, ежедневно встряхивать, процедить",serving:"Рюмка, охлаждённая"},
    {name:"Базовая заготовка",cat:"Бар",subcat:"Заготовки",tags:["заготовка"],compound:"Сахар 500гр\nВода 500мл\nЛимонный сок 100мл",method:"Смешать, прогреть до полного растворения сахара, охладить и убрать в холодильник",serving:"Гастроёмкость, маркировка даты"},
    {name:"Мясная тарелка домашних деликатесов",cat:"Кухня",subcat:"Холодные закуски",tags:["мясная","на компанию"],compound:"Хамон, брезаола, суджук, домашняя ветчина, оливки, орехи",method:"Нарезка тонкими слайсами, выложить веером",serving:"Деревянная доска, 6 персон"},
    {name:"Сырная тарелка",cat:"Кухня",subcat:"Холодные закуски",tags:["сырная","на компанию"],compound:"Дор блю, качотта, пармезан, мёд, грецкий орех, виноград",method:"Разложить по фактуре от мягкого к твёрдому",serving:"Каменная доска, мёд в розетке"}
  ];
  const CONFIG={baseUrl:"https://nocodb.puzzlebot.top",tableId:"mqo5ga1nk6h8lv8",kitchenTableId:"mc7m3sa4m2x12dd",token:"uDwIj1M4tM3DkQdrJItq54GkxbdJFCJ6OUhETjA9",categoryField:"Категория",subcategoryField:"Подкатегория"};
  function normalize(rawCat,rawSub,forced){
    const catText=String(forced||rawCat||"").trim();
    const subText=String(rawSub||"").trim();
    if(forced==="Кухня")return {cat:"Кухня",subcat:KITCHEN_LEGACY[subText]||subText};
    if(catText==="Кухня")return {cat:"Кухня",subcat:KITCHEN_LEGACY[subText]||subText};
    if(catText==="Бар")return {cat:"Бар",subcat:BAR_LEGACY[subText]||subText};
    if(BAR_LEGACY[catText])return {cat:"Бар",subcat:BAR_LEGACY[subText]||BAR_LEGACY[catText]||subText};
    if(KITCHEN_LEGACY[catText])return {cat:"Кухня",subcat:KITCHEN_LEGACY[subText]||KITCHEN_LEGACY[catText]||subText};
    return {cat:catText||"Бар",subcat:subText};
  }
  async function table(id,forced){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),7000);
    let r;
    try{
      r=await fetch(`${CONFIG.baseUrl}/api/v2/tables/${id}/records?limit=1000`,{headers:{"xc-token":CONFIG.token},signal:controller.signal});
    }finally{clearTimeout(timeout)}
    if(!r.ok)throw Error(r.status);
    const j=await r.json();
    return (j.list||[]).map(x=>{
      const normalized=normalize(x[CONFIG.categoryField],x[CONFIG.subcategoryField],forced);
      return {name:x["Название"]||"Без названия",cat:normalized.cat,subcat:normalized.subcat,tags:String(x["Теги"]||"").split(/\s+/).filter(Boolean),compound:x["Состав"]||"—",method:x["Описание"]||x["Метод"]||x["Приготовление"]||"—",serving:x["Граммовка"]||x["Подача"]||x["Вес"]||"—",photo:x["Фото-ссылка"]||null};
    });
  }
  let data=ITEMS;
  try{data=[...(await table(CONFIG.tableId)),...(await table(CONFIG.kitchenTableId,"Кухня"))]}catch(e){console.warn("NocoDB недоступен, используются локальные данные",e)}
  const state={cat:"all",subcat:"all",query:""}, close=bindDrawer(); bindTop();
  const icons={Бар:"🍸",Кухня:"🍽"};
  const tabs=$("#tabs"), label=$("#menuLabel");
  function setActive(cat,sub){
    state.cat=cat;state.subcat=sub;
    $$(".drawer-item,.drawer-subitem").forEach(x=>x.classList.remove("active"));
    const selector=`[data-cat="${CSS.escape(cat)}"][data-sub="${CSS.escape(sub)}"]`;
    const exact=$(selector,tabs); if(exact)exact.classList.add("active");
    if(cat==="all")label.textContent="Всё меню";
    else label.textContent=sub==="all"?cat:sub;
    render();
  }
  tabs?.addEventListener("click",e=>{const b=e.target.closest("[data-cat][data-sub]");if(!b)return;setActive(b.dataset.cat,b.dataset.sub);close?.()});
  bindSearch(q=>{state.query=q;render()});
  function lines(t){return String(t||"—").split(/\n|·/).map(x=>x.trim()).filter(Boolean)}
  function calc(text,m){
    return lines(text).map(x=>{
      const a=x.match(/^(.*?)(\d+(?:[.,]\d+)?)\s*(мл|л|гр|г|кг|шт|порц|кг\.|гр\.|мл\.)?\s*$/i);
      if(!a)return x;
      const value=parseFloat(a[2].replace(",","."))*m;
      const rounded=Math.round(value*100)/100;
      return `${a[1].trim()} ${rounded}${a[3]||""}`;
    });
  }
  function render(){
    const grid=$("#grid"),empty=$("#empty");
    const list=data.filter(x=>(state.cat==="all"||x.cat===state.cat)&&(state.subcat==="all"||x.subcat===state.subcat)&&(!state.query||(`${x.name} ${x.subcat} ${x.tags.join(" ")}`).toLowerCase().includes(state.query.toLowerCase())));
    $("#count").textContent=`${list.length} позиций`;grid.innerHTML="";empty.style.display=list.length?"none":"block";
    list.forEach(x=>{
      const recipe=x.subcat==="Заготовки"||x.subcat==="Настойки"||x.cat==="Заготовки"||x.cat==="Настойка";
      const card=document.createElement("div");card.className="card";
      card.innerHTML=`<div class="card-inner"><div class="face front"><div><div class="cat-icon">${icons[x.cat]||"🍹"}</div><div class="card-name">${escapeHtml(x.name)}</div><div class="card-subcategory">${escapeHtml(x.subcat||x.cat)}</div></div><div class="tap-hint">тапни для рецепта →</div></div><div class="face back">${x.photo?`<img class="back-photo" src="${escapeHtml(x.photo)}" alt="${escapeHtml(x.name)}">`:""}<div class="ticket-name">${escapeHtml(x.name)}</div><b>Состав</b><div class="ingredient-table">${lines(x.compound).map(v=>`<div class="ingredient-row">${escapeHtml(v)}</div>`).join("")}</div>${recipe?`<div class="portion-calculator"><label class="calc-label">Рассчитать на N порций</label><div class="calc-control"><input class="portion-input" type="number" min=".5" step=".5" value="1"><span class="calc-unit">порций</span></div><div class="scaled-recipe"></div></div>`:""}<b>Метод</b>${escapeHtml(x.method)}<b>Подача</b>${escapeHtml(x.serving)}</div></div>`;
      const front=$( ".front",card),back=$( ".back",card);front.onclick=()=>card.classList.add("flipped");back.onclick=()=>card.classList.remove("flipped");grid.appendChild(card);
      if(recipe){const inp=$(".portion-input",card),out=$(".scaled-recipe",card);const upd=()=>out.innerHTML=calc(x.compound,Math.max(.1,parseFloat(inp.value)||1)).map(v=>`<div class="scaled-row">• ${escapeHtml(v)}</div>`).join("");inp.onclick=e=>e.stopPropagation();inp.oninput=upd;upd()}
      const h=back.scrollHeight+8;card.style.setProperty("--flip-h",Math.max(h,220)+"px");
    });
  }
  const surprise=$("#surprise");surprise?.addEventListener("click",()=>{const pool=data.filter(x=>(state.cat==="all"||x.cat===state.cat)&&(state.subcat==="all"||x.subcat===state.subcat));if(!pool.length)return;const pick=pool[Math.floor(Math.random()*pool.length)];state.query="";$("#search").value="";render();const target=[...$$(".card-name")].find(x=>x.textContent===pick.name)?.closest(".card");target?.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>target?.classList.add("flipped"),300)});
  const lo=$("#lightboxOverlay"),li=$("#lightboxImg");if(lo){$("#lightboxClose").onclick=()=>lo.classList.remove("open");lo.onclick=e=>{if(e.target===lo)lo.classList.remove("open")};$("#grid")?.addEventListener("click",e=>{const im=e.target.closest(".back-photo");if(im){e.stopPropagation();li.src=im.src;lo.classList.add("open")}})}
  render();
}

function initHub(){
  const target=$("#hubLatest");
  if(!target)return;
  const fallback=[
    {id:"old-fashioned",type:"article",category:"Коктейли",title:"Как правильно готовить Old Fashioned",description:"История, баланс и техника приготовления.",readingTime:8},
    {id:"beer-basics",type:"article",category:"Пиво",title:"Виды пива и их особенности",description:"Основные стили, вкусовые профили и подача.",readingTime:10},
    {id:"guest-greeting",type:"note",category:"Сервис",title:"Как встречать гостя",description:"5 правил, которые должен помнить каждый сотрудник.",readingTime:5}
  ];
  fetch("training-data.json",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{
    const items=(data&&data.articles&&data.articles.length?data.articles:fallback).slice(0,3);
    target.innerHTML=items.map((x,i)=>`<a class="hub-latest-card" href="training.html#${encodeURIComponent(x.id)}"><span class="latest-num">0${i+1}</span><span class="latest-type">${x.type==="article"?"СТАТЬЯ":"ЗАМЕТКА"} · ${escapeHtml(x.category||"")}</span><h3>${escapeHtml(x.title||"")}</h3><p>${escapeHtml(x.description||"")}</p><span class="latest-time">◷ ${x.readingTime||1} мин <b>→</b></span></a>`).join("");
  }).catch(()=>{target.innerHTML=fallback.map((x,i)=>`<a class="hub-latest-card" href="training.html"><span class="latest-num">0${i+1}</span><span class="latest-type">${x.type==="article"?"СТАТЬЯ":"ЗАМЕТКА"} · ${escapeHtml(x.category)}</span><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.description)}</p><span class="latest-time">◷ ${x.readingTime} мин <b>→</b></span></a>`).join("")});
}

async function initTraining(){
  const feed=$("#feed"), empty=$("#empty"), search=$("#search"), view=$("#articleView");
  const state={category:"all",query:"",items:[],filtered:[]};

  const demo=[
    {id:"old-fashioned",type:"article",category:"Коктейли",title:"Как правильно готовить Old Fashioned",description:"История, баланс и техника приготовления классического коктейля.",cover:"images/training/old-fashioned.jpg",readingTime:8,featured:true,sections:[{type:"text",title:"История",content:"Old Fashioned — классика с простым составом и высокими требованиями к балансу."},{type:"list",title:"Ингредиенты",items:["50 мл бурбона","10 мл сахарного сиропа","2 dash Angostura bitters","Лёд","Цедра апельсина"]},{type:"tip",title:"Главное",content:"Следи за охлаждением, разбавлением и количеством сахара."}]},
    {id:"beer-basics",type:"article",category:"Пиво",title:"Виды пива и их особенности",description:"Основные стили, вкусовые профили и подача.",cover:"images/training/beer.jpg",readingTime:10,featured:true,sections:[{type:"text",title:"С чего начать",content:"Ориентируйся на вкус, горечь, плотность и аромат."}]},
    {id:"steak-doneness",type:"note",category:"Кухня",title:"Степени прожарки мяса",description:"Короткая памятка по степени прожарки и уточнению заказа.",readingTime:5,featured:true,sections:[{type:"list",items:["Rare — красная середина","Medium Rare — тёплая красная середина","Medium — розовая середина","Medium Well — почти полная прожарка","Well Done — полная прожарка"]}]},
    {id:"guest-greeting",type:"note",category:"Сервис",title:"Как встречать гостя",description:"5 правил, которые должен помнить каждый сотрудник.",readingTime:5,featured:true,sections:[{type:"list",items:["Поздороваться и улыбнуться","Установить зрительный контакт","Предложить меню","Уточнить предпочтения","Поблагодарить за визит"]}]},
    {id:"shaker-rules",type:"note",category:"Коктейли",title:"Правила работы с шейкером",description:"Короткая памятка по технике, льду и подаче.",readingTime:4,sections:[{type:"list",items:["Используй свежий лёд","Не переполняй шейкер","Шейкуй активно и стабильно","Следи за температурой и разбавлением"]}]}
  ];

  try{
    const r=await fetch("training-data.json",{cache:"no-store"});
    if(r.ok){const data=await r.json(); state.items=data.articles||demo}else state.items=demo;
  }catch(e){state.items=demo}

  $("#countAll").textContent=state.items.length;
  const categoryCounts=state.items.reduce((acc,item)=>{const key=item.category||"";acc[key]=(acc[key]||0)+1;return acc},{});
  $$('[data-training-count]').forEach(el=>{const count=categoryCounts[el.dataset.trainingCount]||0;el.textContent=count;const btn=el.closest('.side-item');if(btn)btn.disabled=count===0});
  bindTrainingControls();
  renderLibrary();
  if(location.hash){setTimeout(()=>{try{openArticle(decodeURIComponent(location.hash.slice(1)))}catch(e){openArticle(location.hash.slice(1))}},0)}

  function bindTrainingControls(){
    search.oninput=()=>{state.query=search.value.trim().toLowerCase();renderLibrary()};
    $("#trainingSearchBtn").onclick=()=>{$("#trainingSearch").scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>search.focus(),250)};
    document.querySelectorAll(".side-item").forEach(btn=>btn.onclick=()=>{
      document.querySelectorAll(".side-item").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active"); state.category=btn.dataset.category; renderLibrary();
    });
    $("#showAllBtn").onclick=()=>{state.category="all";state.query="";search.value="";document.querySelectorAll(".side-item").forEach(x=>x.classList.toggle("active",x.dataset.category==="all"));renderLibrary()};
    $("#articleBack").onclick=closeArticle;
    $("#articleBackdrop").onclick=closeArticle;
    $("#prevArticle").onclick=()=>moveArticle(-1);
    $("#nextArticle").onclick=()=>moveArticle(1);
    $("#lightboxClose").onclick=closeLightbox;
    $("#lightbox").onclick=e=>{if(e.target.id==="lightbox")closeLightbox()};
    document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeArticle();closeLightbox()}});
  }

  function renderLibrary(){
    state.filtered=state.items.filter(x=>(state.category==="all"||x.category===state.category)&&(!state.query||`${x.title} ${x.description||""} ${x.category}`.toLowerCase().includes(state.query)));
    feed.innerHTML="";
    empty.hidden=state.filtered.length>0;
    if(!state.filtered.length)return;
    const featured=state.filtered.filter(x=>x.featured);
    const rest=state.filtered.filter(x=>!x.featured);
    const cards=[...featured,...rest];
    cards.forEach(item=>feed.appendChild(card(item)));
  }

  function card(item){
    const el=document.createElement("article");
    el.className="material-card";
    const isArticle=item.type==="article";
    el.innerHTML=`
      <button class="material-media" aria-label="${escapeHtml(item.title)}">
        <img src="${escapeAttr(item.cover||placeholderFor(item.category))}" alt="" loading="lazy" onerror="this.src='${placeholderFor(item.category)}'">
        <span class="type-pill">${isArticle?"Статья":"Заметка"}</span>
        <span class="category-pill">${escapeHtml(item.category)}</span>
      </button>
      <button class="material-body">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description||"Короткий материал для смены.")}</p>
        <span class="material-meta">◷ ${item.readingTime||1} мин <b>→</b></span>
      </button>`;
    el.querySelectorAll("button").forEach(b=>b.onclick=()=>openArticle(item.id));
    return el;
  }

  function openArticle(id){
    const item=state.items.find(x=>x.id===id); if(!item)return;
    const idx=state.items.findIndex(x=>x.id===id);
    view.hidden=false; document.body.classList.add("article-open"); history.replaceState(null,"",`training.html#${encodeURIComponent(id)}`); window.scrollTo({top:0,behavior:"instant"});
    $("#articleTopMeta").innerHTML=`<span class="type-pill">${item.type==="article"?"Статья":"Заметка"}</span><span>${escapeHtml(item.category)}</span><span>◷ ${item.readingTime||1} мин чтения</span>`;
    const main=$("#articleMain");
    main.innerHTML=`
      <div class="article-eyebrow">${escapeHtml(item.category)}</div>
      <h1>${escapeHtml(item.title)}</h1>
      <p class="article-lead">${escapeHtml(item.description||"")}</p>
      ${item.cover?`<figure class="article-cover"><img src="${escapeAttr(item.cover)}" alt="" onerror="this.parentElement.remove()"></figure>`:""}
      <div class="article-sections">${renderSections(item.sections||[])}</div>
    `;
    bindArticleImages();
    buildToc();
    $("#prevArticle").disabled=idx<=0; $("#nextArticle").disabled=idx>=state.items.length-1;
    const next=state.items[(idx+1)%state.items.length], prev=state.items[(idx-1+state.items.length)%state.items.length];
    $("#prevArticle").textContent=idx>0?`← ${prev.title}`:"← Предыдущий материал";
    $("#nextArticle").textContent=idx<state.items.length-1?`${next.title} →`:"Следующий материал →";
    $("#asideTip").innerHTML=`<div class="tip-icon">♧</div><b>Главное</b><p>${escapeHtml(item.type==="article"?"Читай до конца: детали техники здесь важнее красивой теории.":"Заметка создана для быстрого повторения прямо во время смены.")}</p>`;
  }

  function renderSections(sections){
    return sections.map((s,i)=>{
      if(s.type==="image")return `<figure class="article-image"><img src="${escapeAttr(s.src)}" alt="${escapeAttr(s.caption||"")}" loading="lazy"><figcaption>${escapeHtml(s.caption||"")}</figcaption></figure>`;
      if(s.type==="list")return `<section class="article-section"><h2>${escapeHtml(s.title||"")}</h2><ol>${(s.items||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ol></section>`;
      if(s.type==="tip")return `<aside class="article-callout"><div class="callout-mark">✦</div><div><b>${escapeHtml(s.title||"Важно")}</b><p>${escapeHtml(s.content||"")}</p></div></aside>`;
      return `<section class="article-section"><h2>${escapeHtml(s.title||"")}</h2>${paragraphs(s.content||"")}</section>`;
    }).join("");
  }

  function paragraphs(text){return text.split(/\n{2,}/).map(p=>`<p>${escapeHtml(p)}</p>`).join("")}

  function buildToc(){
    const heads=[...$("#articleMain").querySelectorAll(".article-section h2,.article-callout b")];
    $("#toc").innerHTML=heads.map((h,i)=>{h.id=`section-${i+1}`;return `<a href="#section-${i+1}"><span>${String(i+1).padStart(2,"0")}</span>${escapeHtml(h.textContent)}</a>`}).join("");
    document.querySelectorAll("#toc a").forEach(a=>a.onclick=e=>{e.preventDefault();document.getElementById(a.getAttribute("href").slice(1))?.scrollIntoView({behavior:"smooth",block:"start"})});
  }

  function bindArticleImages(){
    $("#articleMain").querySelectorAll("img").forEach(img=>img.onclick=()=>openLightbox(img.src,img.alt));
  }
  function openLightbox(src,alt){$("#lightboxImg").src=src;$("#lightboxImg").alt=alt||"";$("#lightbox").classList.add("open")}
  function closeLightbox(){$("#lightbox").classList.remove("open")}
  function closeArticle(){view.hidden=true;document.body.classList.remove("article-open");history.replaceState(null,"","training.html")}
  function moveArticle(delta){
    const current=$("#articleMain h1")?.textContent;
    const idx=state.items.findIndex(x=>x.title===current);
    const target=state.items[idx+delta]; if(target)openArticle(target.id);
  }
  function placeholderFor(cat){
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#29251e"/><stop offset="1" stop-color="#0d0d0c"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><circle cx="640" cy="110" r="150" fill="#e7a83b" opacity=".08"/><text x="50" y="420" fill="#e7a83b" font-size="32" font-family="Arial">${escapeHtml(cat)}</text></svg>`;
    return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(svg);
  }
}

function initQuiz(){
  let raw=[],active=[],idx=0,score=0,selected=null,answers=[];
  const startBtn=$("#start-btn"),desc=$("#start-desc"),start=$("#start-screen"),quiz=$("#quiz-screen"),result=$("#result-screen"),qText=$("#question-text"),opts=$("#options-container"),progress=$("#question-progress"),next=$("#next-btn");
  function parse(text){return text.split("===").map(b=>b.trim()).filter(Boolean).map(block=>{let q="",o=[],c=-1;block.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach(line=>{if(line.startsWith("Вопрос:"))q=line.slice(8).trim();else if(line.startsWith("-")){let t=line.slice(1).trim();if(t.endsWith("*")){c=o.length;t=t.slice(0,-1).trim()}o.push(t)}});return q&&o.length&&c>-1?{question:q,options:o,correct:c}:null}).filter(Boolean)}
  function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
  function load(){selected=null;next.disabled=true;const q=active[idx];progress.textContent=`Вопрос ${idx+1} из ${active.length}`;qText.textContent=q.question;opts.innerHTML=q.options.map((x,i)=>`<li class="option-item" data-i="${i}">${escapeHtml(x)}</li>`).join("");$$(".option-item",opts).forEach(x=>x.onclick=()=>{$$(".option-item",opts).forEach(y=>y.classList.remove("selected"));x.classList.add("selected");selected=+x.dataset.i;next.disabled=false})}
  window.startQuiz=()=>{active=shuffle(raw).slice(0,Math.min(15,raw.length));idx=0;score=0;answers=[];start.classList.add("hidden");result.classList.add("hidden");quiz.classList.remove("hidden");load()}
  window.nextQuestion=()=>{answers.push(selected);if(selected===active[idx].correct)score++;idx++;idx<active.length?load():show()}
  function show(){quiz.classList.add("hidden");result.classList.remove("hidden");const pct=Math.round(score/active.length*100),pass=pct>=90;$("#score-percentage").textContent=pct+"%";$("#score-percentage").className="score-badge "+(pass?"success":"fail");$("#result-title").textContent=pass?"Вы прошли аттестацию!":"Вы не прошли аттестацию";$("#result-subtitle").textContent=pass?`Отличный результат! Вы набрали ${pct}%.`:`Ваш результат: ${pct}%. Для успешного прохождения необходимо набрать минимум 90%.`;const list=$("#errors-list"),box=$("#errors-container");const wrong=active.filter((q,i)=>answers[i]!==q.correct);box.classList.toggle("hidden",!wrong.length);list.innerHTML=wrong.map(q=>{const i=active.indexOf(q);return`<div class="error-item"><div class="error-q">${escapeHtml(q.question)}</div><div class="error-user">Ваш ответ: ${escapeHtml(q.options[answers[i]]||"Не выбран")}</div><div class="error-correct">Правильный ответ: ${escapeHtml(q.options[q.correct])}</div></div>`}).join("");$("#action-buttons").innerHTML='<button class="apple-btn" onclick="startQuiz()">Пройти тест заново</button><button class="apple-btn apple-btn-secondary" onclick="goToMenu()">Вернуться в обучение</button>'}
  window.goToMenu=()=>location.href="training.html";
  fetch("questions.txt").then(r=>{if(!r.ok)throw Error();return r.text()}).then(t=>{raw=parse(t);desc.textContent=`В базе найдено вопросов: ${raw.length}. Билет: до 15 вопросов.`;startBtn.disabled=!raw.length}).catch(()=>desc.textContent="Не удалось загрузить questions.txt.");
}

addEventListener("DOMContentLoaded",()=>{if(page==="hub")initHub();if(page==="menu")initMenu();if(page==="training")initTraining();if(page==="quiz")initQuiz();});
