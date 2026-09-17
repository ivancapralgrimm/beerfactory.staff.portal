(() => {
  'use strict';
  const VERSION = '20260917-r19';
  const e = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeImage = value => {
    try { const u = new URL(value, location.href); return /^(https?:)$/.test(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
  };
  function inline(text) {
    return e(text).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/==(.+?)==/g,'<mark>$1</mark>');
  }
  function markdown(text) {
    const out = []; let paragraph = [], list = null;
    const flush = () => { if(paragraph.length) {out.push('<p>'+paragraph.map(inline).join('<br>')+'</p>');paragraph=[];} if(list){out.push('</'+list+'>');list=null;} };
    for (const raw of text.replace(/\r/g,'').split('\n')) {
      const line=raw.trim(); const img=line.match(/^!\[([^\]]*)\]\(([^\s)]+)\)$/);
      if(!line){flush();continue;}
      if(img){flush();const src=safeImage(img[2]);if(src)out.push(`<figure><a href="${e(src)}" target="_blank" rel="noopener noreferrer" aria-label="Открыть изображение: ${e(img[1])}"><img src="${e(src)}" alt="${e(img[1])}" loading="lazy"></a><figcaption>${e(img[1])}</figcaption></figure>`);continue;}
      if(/^(?:-{3,}|_{3,})$/.test(line)){flush();out.push('<hr>');continue;}
      if(/^#{1,6}\s/.test(line)){flush();out.push('<h3>'+inline(line.replace(/^#+\s/,''))+'</h3>');continue;}
      if(/^>\s?/.test(line)){flush();out.push('<aside class="learnCallout">'+inline(line.replace(/^>\s?/,''))+'</aside>');continue;}
      const li=line.match(/^(?:[-•]\s+|\d+[.)]\s+)(.*)$/);
      if(li){const type=/^\d/.test(line)?'ol':'ul';if(paragraph.length || (list&&list!==type))flush();if(!list){list=type;out.push('<'+type+'>');}out.push('<li>'+inline(li[1])+'</li>');continue;}
      if(list)flush();paragraph.push(line);
    }
    flush();return out.join('');
  }
  function parseArticles(text) {
    const articles=[];let category='Обучение', active=null;
    for(const line of text.replace(/\r/g,'').split('\n')) {
      if(line.startsWith('### ')){category=line.slice(4).trim().replace(/:$/,'');active=null;}
      else if(line.startsWith('## ')){active={id:'lesson-'+(articles.length+1),category,title:line.slice(3).trim(),body:''};articles.push(active);}
      else if(active)active.body+=line+'\n';
    }
    return articles.filter(a=>!/^Раздел в разработке$/i.test(a.title)).map(a=>({...a,body:a.body.trim()}));
  }
  function parseQuestions(text) {
    const out=[];
    for(const block of text.replace(/\r/g,'').split(/^\s*===\s*$/m)){
      if(!block.trim())continue;
      const lines=block.split('\n').map(s=>s.trim()).filter(Boolean);
      const q=lines.find(s=>s.startsWith('Вопрос:'))?.slice(7).trim();
      const answers=lines.filter(s=>s.startsWith('-')).map(s=>({text:s.slice(1).trim().replace(/\*$/,'').trim(),correct:s.endsWith('*')}));
      if(!q||answers.length<2||answers.some(a=>!a.text)||answers.filter(a=>a.correct).length!==1)throw Error('Некорректный вопрос в файле: '+(q||'без названия'));
      out.push({q,answers});
    }
    if(!out.length)throw Error('Банк вопросов пуст.');return out;
  }
  function shuffle(array){const out=[...array];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
  const plain = s => s.replace(/[*=#>]/g,'').replace(/\s+/g,' ').trim();
  const minutes = a => Math.max(1,Math.ceil(plain(a.body).split(/\s+/).length/180));
  const storageKey = () => 'bf-learning-r18:'+String(currentUser?.id||'guest');
  function readRecord(){try{return JSON.parse(localStorage.getItem(storageKey()))||{read:[],history:[]};}catch{return {read:[],history:[]};}}
  function writeRecord(record){try{localStorage.setItem(storageKey(),JSON.stringify(record));return true;}catch{return false;}}
  let articles=null, bank=null, activeQuiz=null;
  let selectedCategory='Все', query='';
  async function file(name){const r=await fetch('./assets/'+name+'?v='+VERSION,{cache:'no-cache'});if(!r.ok)throw Error('Не удалось загрузить материалы. Обновите страницу и попробуйте снова.');return r.text();}
  async function getArticles(){if(!articles){articles=parseArticles(await file('training-data.txt'));if(!articles.length)throw Error('Статьи пока не добавлены.');}return articles;}
  function errorPage(message,route){shell(`<div class="card cardPad"><h1>Не удалось открыть раздел</h1><p>${e(message)}</p><button class="btn" id="learnRetry">Повторить</button></div>`,'/training');document.getElementById('learnRetry').onclick=()=>route();}
  window.training = async function(){
    window.scrollTo(0,0);
    shell('<div class="card empty">Загрузка статей…</div>','/training');let data;try{data=await getArticles();}catch(err){if(path()==='/training')errorPage(err.message,window.training);return;}if(path()!=='/training')return;
    shell(`<div class="pageTitle"><div class="eyebrow">БАЗА ЗНАНИЙ</div><h1>Обучение</h1><p>Изучи тему и проверь себя.</p><div class="actions"><a class="btn gold" href="#/attestation">Пройти аттестацию</a></div></div><input class="search" id="learnSearch" aria-label="Поиск по статьям" placeholder="Найти тему или слово…" value="${e(query)}"><div class="rail learnRail" id="learnCats"></div><div class="trainingGrid" id="learnList"></div>`,'/training');
    const cats=['Все',...new Set(data.map(a=>a.category))];
    document.getElementById('learnCats').innerHTML=cats.map(c=>`<button class="chip ${c===selectedCategory?'active':''}" data-learn-cat="${e(c)}">${e(c)}</button>`).join('');
    function list(){const read=readRecord().read||[];const filtered=data.filter(a=>(selectedCategory==='Все'||a.category===selectedCategory)&&`${a.title} ${a.body}`.toLowerCase().includes(query.toLowerCase()));document.getElementById('learnList').innerHTML=filtered.map(a=>`<a class="card articleCard" href="#/article/${e(a.id)}"><span class="tag">${e(a.category)}</span><h3>${e(a.title)}</h3><p>${e(plain(a.body).slice(0,135))}…</p><small>${minutes(a)} мин · ${read.includes(a.id)?'Прочитано ✓':'Читать статью →'}</small></a>`).join('')||'<div class="card empty">Ничего не найдено. Попробуйте другое слово или категорию.</div>';}
    document.getElementById('learnSearch').oninput=ev=>{query=ev.target.value.trim();list();};
    document.querySelectorAll('[data-learn-cat]').forEach(b=>b.onclick=()=>{selectedCategory=b.dataset.learnCat;document.querySelectorAll('[data-learn-cat]').forEach(x=>x.classList.toggle('active',x===b));list();});list();
  };
  window.article = async function(id){
    shell('<div class="card empty">Загрузка статьи…</div>','/training');let data;try{data=await getArticles();}catch(err){if(path()==='/article/'+id)errorPage(err.message,()=>window.article(id));return;}if(path()!=='/article/'+id)return;
    const a=data.find(a=>a.id===id);if(!a){shell('<div class="card cardPad"><h1>Статья не найдена</h1><a class="btn" href="#/training">Все статьи</a></div>','/training');return;}
    const read=(readRecord().read||[]).includes(a.id);
    shell(`<div class="learnTools"><a class="btn" href="#/training">← Все статьи</a><span class="pill">${minutes(a)} мин чтения</span></div><article class="card articleView learnArticle"><span class="tag">${e(a.category)}</span><h1>${e(a.title)}</h1><div class="learnBody">${markdown(a.body)}</div><div class="actions"><button class="btn primary" id="markRead">${read?'Прочитано ✓':'Отметить прочитанным'}</button><a class="btn" href="#/attestation">Проверить знания</a></div><p id="learnSaveStatus" role="status"></p></article>`,'/training');window.scrollTo(0,0);
    document.getElementById('markRead').onclick=()=>{const record=readRecord();record.read=[...new Set([...(record.read||[]),id])];if(writeRecord(record))document.getElementById('markRead').textContent='Прочитано ✓';else document.getElementById('learnSaveStatus').textContent='Не удалось сохранить отметку на устройстве.';};
  };
  function validateBank(data) {
    if(!data || data.passPercent!==80 || data.questionsPerTest!==15 || !Array.isArray(data.categories))throw Error('Не удалось прочитать настройки аттестации.');
    const labels={bar:'Бар',kitchen:'Кухня',wine:'Вино',service:'Сервис'};
    const minimum={bar:50,kitchen:100,wine:50,service:100};
    const ids=new Set();
    if(data.categories.length!==4)throw Error('В банке должны быть четыре категории.');
    const seen=new Set();
    for(const c of data.categories){
      if(!labels[c.id] || labels[c.id]!==c.label || seen.has(c.id) || !Array.isArray(c.questions) || c.questions.length<minimum[c.id])throw Error('Проверьте банк вопросов категории.');
      seen.add(c.id);
      for(const q of c.questions){
        if(!q.id || ids.has(q.id) || !q.q || !Array.isArray(q.answers) || q.answers.length!==4 || q.answers.some(a=>!a.text || typeof a.correct!=='boolean') || q.answers.filter(a=>a.correct).length!==1 || new Set(q.answers.map(a=>a.text.trim().toLowerCase())).size!==4)throw Error('Некорректный вопрос: '+(q.id||'без номера'));
        ids.add(q.id);
      }
    }
    for(const c of data.categories){
      if(!Array.isArray(c.ticketPlan) || c.ticketPlan.reduce((n,p)=>n+p.count,0)!==data.questionsPerTest || new Set(c.ticketPlan.map(p=>p.topic)).size!==c.ticketPlan.length)throw Error('Проверьте план билета.');
      for(const part of c.ticketPlan){
        const groups=new Set(c.questions.filter(q=>q.topic===part.topic).map(q=>q.group));
        if(!Number.isInteger(part.count)||part.count<1||groups.has(undefined)||groups.size<part.count)throw Error('Недостаточно разных тем для билета.');
      }
    }
    return data;
  }
  function buildTicket(category){
    const ticket=[];
    for(const part of category.ticketPlan){
      const groups=new Map();
      for(const q of category.questions.filter(q=>q.topic===part.topic)){
        if(!groups.has(q.group))groups.set(q.group,[]);
        groups.get(q.group).push(q);
      }
      for(const group of shuffle([...groups.values()]).slice(0,part.count)){
        const q=shuffle(group)[0];ticket.push({...q,answers:shuffle(q.answers)});
      }
    }
    return shuffle(ticket);
  }
  const hasPassed = (correct,total,percent=80) => total>0 && correct*100>=total*percent;
  window.attestation = async function(){
    window.scrollTo(0,0);
    activeQuiz=null;
    shell('<div class="card empty">Загрузка вопросов…</div>','/training');
    try{if(!bank)bank=validateBank(JSON.parse(await file('question-banks.json')));}catch(err){if(path()==='/attestation')errorPage(err.message,window.attestation);return;}if(path()!=='/attestation')return;
    let selected=null;
    const history=readRecord().history||[];
    shell(`<div class="pageTitle"><div class="eyebrow">ПРОВЕРКА ЗНАНИЙ</div><h1>Аттестация</h1><p>15 вопросов. Зачёт — от 12 верных ответов (80%).</p></div><section class="card cardPad"><h2>Категория вопросов</h2><div class="quizCategories" role="group" aria-label="Категория вопросов">${bank.categories.map(c=>`<button class="quizCategory" data-quiz-category="${e(c.id)}" aria-pressed="false"><strong>${e(c.label)}</strong><span>${c.questions.length} вопросов в базе</span></button>`).join('')}</div><p id="quizSelection" role="status">Сначала выберите категорию.</p><p>В билете разные темы без повторения рецептов. Вопросы и ответы перемешиваются.</p><div class="actions"><button class="btn primary" id="learnStart" disabled>Начать</button><a class="btn" href="#/training">К обучению</a></div></section><section class="section card cardPad"><h2>Мои попытки</h2><p>История хранится в этом браузере для вашего аккаунта.</p>${history.length?history.slice(-5).reverse().map(h=>`<div class="metric"><span>${e(h.category||'Общий тест r18')}<br>${e(new Date(h.time).toLocaleString('ru-RU'))}</span><b>${h.correct}/${h.total} · ${h.score}%</b></div>`).join(''):'<p>Попыток пока нет.</p>'}</section>`,'/training');
    document.querySelectorAll('[data-quiz-category]').forEach(b=>b.onclick=()=>{
      selected=bank.categories.find(c=>c.id===b.dataset.quizCategory)||null;
      document.querySelectorAll('[data-quiz-category]').forEach(x=>{const on=x===b;x.classList.toggle('selected',on);x.setAttribute('aria-pressed',String(on));});
      const start=document.getElementById('learnStart');start.disabled=!selected;
      start.textContent=selected?'Начать · '+selected.label:'Начать';
      document.getElementById('quizSelection').textContent=selected?selected.label+': 15 вопросов. Проходной результат — 12 из 15.':'Сначала выберите категорию.';
    });
    document.getElementById('learnStart').onclick=()=>{
      if(!selected)return;
      activeQuiz={qs:buildTicket(selected),category:selected.label,categoryId:selected.id,passPercent:bank.passPercent,i:0,answers:[],selected:null,owner:storageKey()};question();
    };
  };
  function question(){const q=activeQuiz.qs[activeQuiz.i];shell(`<div class="quizHeader"><button class="btn" id="learnExit">← Выйти</button><span class="pill">${e(activeQuiz.category)} · ${activeQuiz.i+1} / ${activeQuiz.qs.length}</span></div><div class="progress"><i style="width:${activeQuiz.i/activeQuiz.qs.length*100}%"></i></div><section class="section card question"><h2>${e(q.q)}</h2><div class="answers">${q.answers.map((a,i)=>`<button class="answer" aria-pressed="false" data-choice="${i}">${e(a.text)}</button>`).join('')}</div><div class="actions"><button class="btn primary" id="learnNext" disabled>${activeQuiz.i===activeQuiz.qs.length-1?'Завершить':'Ответить'}</button></div></section>`,'/training');window.scrollTo(0,0);
    document.getElementById('learnExit').onclick=()=>{if(confirm('Прервать попытку? Незавершённый результат не сохранится.'))window.attestation();};
    document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{activeQuiz.selected=Number(b.dataset.choice);document.querySelectorAll('[data-choice]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});document.getElementById('learnNext').disabled=false;});
    document.getElementById('learnNext').onclick=()=>{if(activeQuiz.selected===null)return;activeQuiz.answers.push(activeQuiz.selected);activeQuiz.i++;activeQuiz.selected=null;if(activeQuiz.i<activeQuiz.qs.length)question();else finish();};
  }
  function finish(){const attempt=activeQuiz;activeQuiz=null;const mistakes=attempt.qs.map((q,i)=>({q,chosen:q.answers[attempt.answers[i]]})).filter(x=>!x.chosen.correct);const total=attempt.qs.length,correct=total-mistakes.length,score=Math.round(correct/total*100),passed=hasPassed(correct,total,attempt.passPercent);const record=readRecord();record.history=[...(record.history||[]),{time:Date.now(),correct,total,score,passed,category:attempt.category,categoryId:attempt.categoryId,passPercent:attempt.passPercent}].slice(-100);const saved=attempt.owner===storageKey()&&writeRecord(record);
    shell(`<section class="card result"><div class="eyebrow">РЕЗУЛЬТАТ · ${e(attempt.category)}</div><div class="score">${score}%</div><h1>${passed?'Аттестация пройдена':'Нужно повторить материал'}</h1><p>${correct} из ${total} · проходной порог ${attempt.passPercent}%</p><p>${saved?'Попытка сохранена в этом браузере.':'Не удалось сохранить попытку на устройстве.'}</p><div class="actions"><button class="btn primary" id="learnAgain">Новая попытка</button><a class="btn" href="#/training">К обучению</a></div></section>${mistakes.length?'<section class="section"><h2>Разбор ошибок</h2>'+mistakes.map(x=>`<article class="card cardPad learnMistake"><h3>${e(x.q.q)}</h3><p>Ваш ответ: ${e(x.chosen.text)}</p><p class="learnCorrect">Верно: ${e(x.q.answers.find(a=>a.correct).text)}</p><p class="learnReviewNote">${e(x.q.reviewNote||x.q.topic||'')}</p>${/^#\/(?:menu|article\/lesson-\d+)$/.test(x.q.reviewUrl||'')?`<a class="btn" href="${e(x.q.reviewUrl)}">${e(x.q.reviewLabel||'Повторить')}</a>`:''}</article>`).join('')+'</section>':''}`,'/training');document.getElementById('learnAgain').onclick=window.attestation;window.scrollTo(0,0);
  }
})();
