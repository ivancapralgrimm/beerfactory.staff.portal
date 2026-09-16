const SUPABASE_URL='https://oltbkrvernfgymxtsfys.supabase.co';
const SUPABASE_KEY='sb_publishable_XRYEGvajuz1wSEyWlD6qRQ_3yTTid0p';
const LOGIN_FUNCTION=SUPABASE_URL+'/functions/v1/staff-login';
const RECOVER_FUNCTION=SUPABASE_URL+'/functions/v1/staff-recover';
const SET_RECOVERY_FUNCTION=SUPABASE_URL+'/functions/v1/staff-set-recovery';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let currentUser=null;
const API_BASE='https://beerfactory-menu-api.ivan-capral-grimm.workers.dev';
const STORAGE='bf-portal-v2';
const defaultState={notes:[],checks:{},closedChecks:{},quizHistory:[],menu:[],menuSource:'local'};
let state=load(); let trainingData=null; let quiz=null;

const icons={
home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5M9 21v-6h6v6"/></svg>',
menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="1"/><circle cx="15" cy="12" r="1"/></svg>',
learn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22V5.5Z"/><path d="M4 18.5A3.5 3.5 0 0 1 7.5 15H20"/></svg>',
shift:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4h12v16H6z"/><path d="m9 12 2 2 4-5"/></svg>',
note:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>'
};

const routes=['/','/menu','/training','/shift','/notes'];

function load(){
  try{
    return {...defaultState,...JSON.parse(localStorage.getItem(STORAGE)||'{}')}
  }catch{
    return {...defaultState}
  }
}

function save(){
  localStorage.setItem(STORAGE,JSON.stringify(state))
}

function path(){
  return (location.hash||'#/').slice(1)||'/'
}

function go(p){
  location.hash=p
}

function esc(s=''){
  return String(s).replace(/[&<>"']/g,c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c]))
}

function toast(msg){
  let t=document.querySelector('.toast');
  if(!t){
    t=document.createElement('div');
    t.className='toast';
    document.body.appendChild(t)
  }
  t.textContent=msg;
  t.classList.add('show');
  clearTimeout(t._x);
  t._x=setTimeout(()=>t.classList.remove('show'),2200)
}

function nav(active){
  return `<div class="bottom"><nav class="nav">${[
    ['/','Главная','home'],
    ['/menu','Меню','menu'],
    ['/training','Знания','learn'],
    ['/shift','Смена','shift'],
    ['/notes','Заметки','note']
  ].map(([p,t,i])=>`<a class="${active===p?'active':''}" href="#${p}">${icons[i]}<span>${t}</span></a>`).join('')}</nav></div>`
}

function shell(content,active='/'){
  document.getElementById('app').innerHTML=
  `<div class="app">
    <header class="top">
      <div class="topin">
        <a class="brand" href="#/">
          <span class="mark">BF</span>
          <span><b>BEERFACTORY</b><small>STAFF PORTAL</small></span>
        </a>
        <span class="status">● смена онлайн</span>
        <button class="topLogout" id="logoutBtn" type="button">Выйти</button>
      </div>
    </header>
    <main class="main">${content}</main>
    ${nav(active)}
  </div>`;

  const b=document.getElementById('logoutBtn');
  if(b)b.onclick=async()=>{
    await sb.auth.signOut();
    currentUser=null;
    go('/login')
  }
}

function login(){
  document.getElementById('app').innerHTML=
  `<div class="loginWrap">
    <section class="loginCard">
      <div class="brand loginBrand">
        <span class="mark">BF</span>
        <span><b>BEERFACTORY</b><small>STAFF PORTAL</small></span>
      </div>

      <div class="eyebrow">ВХОД ДЛЯ КОМАНДЫ</div>
      <h1>Войти в портал</h1>
      <p>Имя, фамилия и персональный код. Никаких телефонных номеров и охоты за корпоративной почтой.</p>

      <form id="loginForm">
        <input class="search" id="firstName" autocomplete="given-name" placeholder="Имя" required maxlength="80">
        <input class="search" id="lastName" autocomplete="family-name" placeholder="Фамилия" required maxlength="80">
        <input class="search" id="code" inputmode="numeric" autocomplete="current-password" type="password" placeholder="Персональный код" required maxlength="64">
        <button class="btn primary" id="loginBtn" type="submit">Войти</button>
        <button class="textBtn" id="recoverBtn" type="button">Забыл код?</button>
        <div class="loginError" id="loginError"></div>
      </form>
    </section>
  </div>`;

  document.getElementById('recoverBtn').onclick=recovery;

  document.getElementById('loginForm').onsubmit=async e=>{
    e.preventDefault();

    const btn=document.getElementById('loginBtn');
    const err=document.getElementById('loginError');

    btn.disabled=true;
    btn.textContent='Проверяем…';
    err.textContent='';

    try{
      const r=await fetch(LOGIN_FUNCTION,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey':SUPABASE_KEY
        },
        body:JSON.stringify({
          first_name:document.getElementById('firstName').value,
          last_name:document.getElementById('lastName').value,
          code:document.getElementById('code').value
        })
      });

      const d=await r.json();

      if(!r.ok||!d.session)throw Error();

      const {error}=await sb.auth.setSession(d.session);
      if(error)throw error;

      currentUser=d.user;

      if(d.recovery_configured===false){
        recoverySetup();
      }else{
        go('/')
      }
    }catch{
      err.textContent='Не удалось войти. Проверь имя, фамилию и код.';
      btn.disabled=false;
      btn.textContent='Войти'
    }
  }
}

function recovery(){
  document.getElementById('app').innerHTML=
  `<div class="loginWrap">
    <section class="loginCard">
      <button class="textBtn backBtn" id="backLogin" type="button">← Вернуться ко входу</button>

      <div class="eyebrow">ВОССТАНОВЛЕНИЕ ДОСТУПА</div>
      <h1>Забыл код?</h1>
      <p>Понадобятся имя, фамилия и отдельный recovery-код. Одного имени для сброса недостаточно.</p>

      <form id="recoverForm">
        <input class="search" id="rFirstName" placeholder="Имя" required maxlength="80">
        <input class="search" id="rLastName" placeholder="Фамилия" required maxlength="80">
        <input class="search" id="recoveryCode" inputmode="numeric" autocomplete="one-time-code" placeholder="Recovery-код" required maxlength="12">
        <input class="search" id="newCode" inputmode="numeric" autocomplete="new-password" type="password" placeholder="Новый персональный код" required maxlength="12">
        <button class="btn primary" id="recoverSubmit" type="submit">Восстановить доступ</button>
        <div class="loginError" id="recoverError"></div>
      </form>
    </section>
  </div>`;

  document.getElementById('backLogin').onclick=login;

  document.getElementById('recoverForm').onsubmit=async e=>{
    e.preventDefault();

    const btn=document.getElementById('recoverSubmit');
    const err=document.getElementById('recoverError');

    err.textContent='';

    const rc=document.getElementById('recoveryCode').value.trim();
    const nc=document.getElementById('newCode').value.trim();

    if(!/^\d{4,12}$/.test(rc)){
      err.textContent='Recovery-код должен содержать 4–12 цифр.';
      return
    }

    if(!/^\d{4,12}$/.test(nc)){
      err.textContent='Новый персональный код должен содержать 4–12 цифр.';
      return
    }

    btn.disabled=true;
    btn.textContent='Восстанавливаем…';

    try{
      const r=await fetch(RECOVER_FUNCTION,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey':SUPABASE_KEY
        },
        body:JSON.stringify({
          first_name:document.getElementById('rFirstName').value.trim(),
          last_name:document.getElementById('rLastName').value.trim(),
          recovery_code:document.getElementById('recoveryCode').value.trim(),
          new_code:document.getElementById('newCode').value.trim()
        })
      });

      const d=await r.json();

      if(!r.ok||!d.session){
        const e=new Error(d.error||'recovery_failed');
        e.code=d.error||'recovery_failed';
        throw e;
      }

      const {error}=await sb.auth.setSession(d.session);
      if(error)throw error;

      currentUser=d.user;
      toast('Доступ восстановлен');
      go('/')
    }catch(e){
      err.textContent=
        e?.code==='rate_limited'
          ?'Слишком много попыток. Повторите позже.'
          :e?.code==='invalid_recovery_code'
            ?'Recovery-код не подошёл. Проверьте его и попробуйте снова.'
            :'Не удалось восстановить доступ. Проверьте данные и попробуйте снова.';

      btn.disabled=false;
      btn.textContent='Восстановить доступ'
    }
  }
}

function recoverySetup(){
  document.getElementById('app').innerHTML=
  `<div class="loginWrap">
    <section class="loginCard recoveryResult">
      <div class="eyebrow">ЗАЩИТА АККАУНТА</div>
      <h1>Настрой recovery-код</h1>
      <p>Это второй секрет для автоматического восстановления доступа. Он не заменяет персональный код и нужен, если вы его забудете.</p>

      <form id="setupRecoveryForm">
        <input class="search" id="setupRecoveryCode" inputmode="numeric" autocomplete="off" placeholder="Recovery-код · 4–12 цифр" required maxlength="12">
        <input class="search" id="setupRecoveryCode2" inputmode="numeric" autocomplete="off" placeholder="Повторите recovery-код" required maxlength="12">
        <button class="btn primary" id="setupRecoveryBtn" type="submit">Сохранить recovery-код</button>
        <div class="loginError" id="setupRecoveryError"></div>
      </form>
    </section>
  </div>`;

  document.getElementById('setupRecoveryForm').onsubmit=async e=>{
    e.preventDefault();

    const a=document.getElementById('setupRecoveryCode').value.trim();
    const b=document.getElementById('setupRecoveryCode2').value.trim();
    const btn=document.getElementById('setupRecoveryBtn');
    const err=document.getElementById('setupRecoveryError');

    err.textContent='';

    if(!/^\d{4,12}$/.test(a)||a!==b){
      err.textContent='Введите одинаковый recovery-код из 4–12 цифр.';
      return
    }

    btn.disabled=true;
    btn.textContent='Сохраняем…';

    try{
      const {data:{session}}=await sb.auth.getSession();

      if(!session)throw Error();

      const r=await fetch(SET_RECOVERY_FUNCTION,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey':SUPABASE_KEY,
          'Authorization':'Bearer '+session.access_token
        },
        body:JSON.stringify({
          recovery_code:a
        })
      });

      if(!r.ok)throw Error();

      go('/')
    }catch{
      err.textContent='Не удалось сохранить recovery-код.';
      btn.disabled=false;
      btn.textContent='Сохранить recovery-код'
    }
  }
}

function localMenu(){
  return[
    {
      name:'Old Fashioned',
      category:'Коктейли',
      desc:'50 мл бурбона · 10 мл сиропа · 2 dash bitters',
      ingredients:[
        '50 мл бурбона',
        '10 мл сахарного сиропа',
        '2 dash Angostura bitters',
        'Крупный лёд',
        'Цедра апельсина'
      ]
    },
    {
      name:'BeerFactory IPA',
      category:'Пиво',
      desc:'Хмель · горечь · аромат · правильная температура подачи',
      ingredients:[
        'Охлаждённый бокал',
        'Проверить линию',
        'Налить с правильной пеной',
        'Подать сразу'
      ]
    },
    {
      name:'Steak',
      category:'Кухня',
      desc:'Уточнить прожарку · гарнир · соус',
      ingredients:[
        'Уточнить степень прожарки',
        'Проверить гарнир',
        'Про...'
      ]
    }
  ]
}

async function loadMenu(){
  if(state.menu.length)return state.menu;

  try{
    const r=await fetch(API_BASE+'/menu');
    if(!r.ok)throw Error();

    const d=await r.json();

    if(Array.isArray(d)){
      state.menu=d;
      state.menuSource='api';
      save();
      return state.menu
    }
  }catch{}

  state.menu=localMenu();
  state.menuSource='local';
  save();

  return state.menu
}

async function home(){
  shell(
    `<div class="pageTitle">
      <div class="eyebrow">BEERFACTORY · STAFF PORTAL</div>
      <h1>Рабочая смена<br>без лишнего шума.</h1>
      <p>Меню, знания, чеклисты и заметки команды в одном месте.</p>
    </div>

    <section class="section">
      <div class="grid4">
        <a class="card tile" href="#/menu">
          <span class="num">01</span>
          <h3>Меню</h3>
          <p>Актуальные позиции и состав.</p>
        </a>

        <a class="card tile" href="#/training">
          <span class="num">02</span>
          <h3>Знания</h3>
          <p>Материалы и аттестация.</p>
        </a>

        <a class="card tile" href="#/shift">
          <span class="num">03</span>
          <h3>Смена</h3>
          <p>Открытие и закрытие.</p>
        </a>

        <a class="card tile" href="#/notes">
          <span class="num">04</span>
          <h3>Заметки</h3>
          <p>Передача между сменами.</p>
        </a>
      </div>
    </section>`,
    '/'
  )
}

async function menu(){
  const items=await loadMenu();

  shell(
    `<div class="pageTitle">
      <div class="eyebrow">КАРТА ПРОДУКТА</div>
      <h1>Меню</h1>
      <p>Позиции, состав и ключевые детали подачи.</p>
    </div>

    <section class="section">
      <input class="search" id="menuSearch" placeholder="Поиск по меню">

      <div class="filters" id="menuFilters">
        ${[...new Set(items.map(x=>x.category))].map(c=>
          `<button class="pill" data-cat="${esc(c)}">${esc(c)}</button>`
        ).join('')}
      </div>

      <div class="menuGrid" id="menuGrid">
        ${items.map((x,i)=>
          `<article class="card menuItem" data-category="${esc(x.category)}" data-name="${esc(x.name.toLowerCase())}">
            <div class="eyebrow">${esc(x.category)}</div>
            <h2>${esc(x.name)}</h2>
            <p>${esc(x.desc)}</p>
            <button class="btn" data-menu-detail="${i}">Подробнее</button>
          </article>`
        ).join('')}
      </div>
    </section>`,
    '/menu'
  );

  let activeCat='';

  const redraw=()=>{
    const q=document.getElementById('menuSearch').value.trim().toLowerCase();

    document.querySelectorAll('.menuItem').forEach(el=>{
      const okCat=!activeCat||el.dataset.category===activeCat;
      const okSearch=!q||el.dataset.name.includes(q);
      el.style.display=okCat&&okSearch?'':'none'
    })
  };

  document.getElementById('menuSearch').oninput=redraw;

  document.querySelectorAll('[data-cat]').forEach(b=>{
    b.onclick=()=>{
      activeCat=activeCat===b.dataset.cat?'':b.dataset.cat;
      document.querySelectorAll('[data-cat]').forEach(x=>
        x.classList.toggle('active',x.dataset.cat===activeCat)
      );
      redraw()
    }
  });

  document.querySelectorAll('[data-menu-detail]').forEach(b=>{
    b.onclick=()=>{
      const x=items[+b.dataset.menuDetail];

      shell(
        `<div class="pageTitle">
          <button class="btn" onclick="go('/menu')">← Меню</button>
          <div class="eyebrow">${esc(x.category)}</div>
          <h1>${esc(x.name)}</h1>
          <p>${esc(x.desc)}</p>
        </div>

        <section class="card cardPad">
          <div class="eyebrow">СОСТАВ / СТАНДАРТ</div>
          <ul class="ingredients">
            ${x.ingredients.map(v=>`<li>${esc(v)}</li>`).join('')}
          </ul>
        </section>`,
        '/menu'
      )
    }
  })
}

async function training(){
  if(!trainingData){
    try{
      const r=await fetch(API_BASE+'/training');
      if(r.ok)trainingData=await r.json()
    }catch{}
  }

  const data=Array.isArray(trainingData)?trainingData:[];

  shell(
    `<div class="pageTitle">
      <div class="eyebrow">ЗНАНИЯ</div>
      <h1>Обучение</h1>
      <p>Короткие материалы для работы в смене.</p>
    </div>

    <section class="section">
      <div class="grid4">
        ${data.length
          ?data.map((x,i)=>
            `<article class="card tile">
              <span class="num">${String(i+1).padStart(2,'0')}</span>
              <h3>${esc(x.title||x.name||'Материал')}</h3>
              <p>${esc(x.description||x.desc||'')}</p>
              <button class="btn" onclick="go('/article/${i}')">Открыть</button>
            </article>`
          ).join('')
          :`
            <article class="card tile">
              <span class="num">01</span>
              <h3>Аттестация</h3>
              <p>Проверка знаний команды.</p>
              <button class="btn" onclick="go('/attestation')">Открыть</button>
            </article>

            <article class="card tile">
              <span class="num">02</span>
              <h3>Пиво</h3>
              <p>Стили, вкус, горечь и подача.</p>
            </article>

            <article class="card tile">
              <span class="num">03</span>
              <h3>Бар</h3>
              <p>Рецептуры, лёд и баланс.</p>
            </article>

            <article class="card tile">
              <span class="num">04</span>
              <h3>Сервис</h3>
              <p>Контакт с гостем и коммуникация.</p>
            </article>
          `
        }
      </div>
    </section>

    <section class="section">
      <div class="card cardPad">
        <div class="eyebrow">ПРОВЕРКА</div>
        <h2>Аттестация</h2>
        <p>Тест запускается из банка вопросов.</p>
        <button class="btn primary" onclick="go('/attestation')">Начать →</button>
      </div>
    </section>`,
    '/training'
  )
}

function article(i){
  const x=Array.isArray(trainingData)?trainingData[+i]:null;

  if(!x){
    go('/training');
    return
  }

  shell(
    `<div class="pageTitle">
      <button class="btn" onclick="go('/training')">← Знания</button>
      <div class="eyebrow">МАТЕРИАЛ</div>
      <h1>${esc(x.title||x.name||'Материал')}</h1>
      <p>${esc(x.description||x.desc||'')}</p>
    </div>

    <article class="card cardPad">
      ${esc(x.content||x.text||'Нет текста')}
    </article>`,
    '/training'
  )
}

async function loadQuestions(){
  try{
    const r=await fetch(API_BASE+'/questions');
    if(r.ok){
      const d=await r.json();
      if(Array.isArray(d))return d
    }
  }catch{}

  return[]
}

async function attestation(){
  const qs=await loadQuestions();
  const hist=state.quizHistory;
  const last=hist.at(-1);

  shell(
    `<div class="pageTitle">
      <div class="eyebrow">ПРОВЕРКА ЗНАНИЙ</div>
      <h1>Аттестация</h1>
      <p>Тест запускается из реального банка вопросов. Результат сохраняется локально и готов к переносу в backend.</p>
    </div>

    <div class="card result">
      <div class="score">${last?last.score+'%':'—'}</div>
      <p>${last
        ?`Последняя попытка · ${last.correct}/${last.total} · ${new Date(last.time).toLocaleString('ru-RU')}`
        :'Попыток ещё нет'
      }</p>

      <button class="btn primary" id="startQuiz" ${qs.length?'':'disabled'}>
        Начать тест · ${qs.length} вопросов
      </button>
    </div>

    <section class="section">
      <div class="grid4">
        <div class="card tile">
          <span class="num">ПИВО</span>
          <h3>Базовые стили</h3>
          <p>Подача, вкус, горечь, аромат.</p>
        </div>

        <div class="card tile">
          <span class="num">БАР</span>
          <h3>Техника</h3>
          <p>Рецептуры, лёд, баланс.</p>
        </div>

        <div class="card tile">
          <span class="num">СЕРВИС</span>
          <h3>Гость</h3>
          <p>Контакт и коммуникация.</p>
        </div>

        <div class="card tile">
          <span class="num">КУХНЯ</span>
          <h3>Прожарка</h3>
          <p>Уточнение заказа и стандарты.</p>
        </div>
      </div>
    </section>`,
    '/training'
  );

  document.getElementById('startQuiz').onclick=()=>startQuiz(qs)
}

function startQuiz(qs){
  quiz={
    qs:[...qs].sort(()=>Math.random()-.5),
    i:0,
    selected:null,
    correct:0
  };

  renderQuestion()
}

function renderQuestion(){
  const x=quiz.qs[quiz.i];

  shell(
    `<div class="quizHeader">
      <button class="btn" onclick="go('/attestation')">← Выйти</button>
      <span class="pill">${quiz.i+1} / ${quiz.qs.length}</span>
    </div>

    <div class="progress">
      <i style="width:${quiz.i/quiz.qs.length*100}%"></i>
    </div>

    <section class="section">
      <article class="card question">
        <div class="eyebrow">ВОПРОС ${quiz.i+1}</div>
        <h2>${esc(x.q)}</h2>

        <div class="answers">
          ${x.answers.map((a,j)=>
            `<button class="answer ${quiz.selected===j?'selected':''}" data-a="${j}">
              ${esc(a.text)}
            </button>`
          ).join('')}
        </div>

        <div class="quizFoot">
          <span class="pill">${quiz.correct} правильных</span>
          <button class="btn primary" id="next" disabled>
            ${quiz.i===quiz.qs.length-1?'Завершить':'Дальше'}
          </button>
        </div>
      </article>
    </section>`,
    '/training'
  );

  document.querySelectorAll('[data-a]').forEach(b=>
    b.onclick=()=>{
      quiz.selected=+b.dataset.a;

      document.querySelectorAll('[data-a]').forEach(z=>
        z.classList.toggle('selected',z===b)
      );

      document.getElementById('next').disabled=false
    }
  );

  document.getElementById('next').onclick=()=>{
    if(quiz.qs[quiz.i].answers[quiz.selected].correct){
      quiz.correct++
    }

    quiz.i++;

    if(quiz.i<quiz.qs.length){
      quiz.selected=null;
      renderQuestion()
    }else{
      finishQuiz()
    }
  }
}

function finishQuiz(){
  const total=quiz.qs.length;
  const score=Math.round(quiz.correct/total*100);

  state.quizHistory.push({
    score,
    correct:quiz.correct,
    total,
    time:Date.now()
  });

  save();

  shell(
    `<div class="card result">
      <div class="eyebrow">РЕЗУЛЬТАТ</div>
      <div class="score">${score}%</div>
      <h2>${quiz.correct} из ${total}</h2>
      <p>${score>=80
        ?'База усвоена. Можно работать дальше.'
        :'Есть темы для повторения. Система хотя бы честно показала где.'
      }</p>
      <button class="btn primary" onclick="go('/attestation')">
        К аттестации
      </button>
    </div>`,
    '/training'
  )
}

const tasks=[
  'Свет и музыка',
  'Барная станция',
  'Лёд и расходники',
  'Пиво и кеги',
  'Касса / POS',
  'Чистота гостевой зоны'
];

function shift(){
  const d=new Date().toISOString().slice(0,10);
  const open=state.checks[d]||{};
  const close=state.closedChecks[d]||{};

  const n=Object.values(open).filter(Boolean).length;
  const cn=Object.values(close).filter(Boolean).length;

  const list=(arr,obj,prefix)=>
    arr.map((t,i)=>
      `<label class="check">
        <input type="checkbox" data-check="${prefix}${i}" ${obj[i]?'checked':''}>
        <span>${esc(t)}</span>
      </label>`
    ).join('');

  shell(
    `<div class="pageTitle">
      <div class="eyebrow">СМЕНА · ${d.split('-').reverse().join('.')}</div>
      <h1>Открытие / закрытие</h1>
      <p>Чеклисты сохраняются на устройстве. Следующий шаг, backend, позволит привязать их к сотруднику и реальной смене.</p>
    </div>

    <section class="card cardPad">
      <div class="sectionHead">
        <div>
          <div class="eyebrow">ОТКРЫТИЕ</div>
          <h2>Готовность ${n}/6</h2>
        </div>
        <span class="pill ${n===6?'done':''}">
          ${n===6?'готово':'в процессе'}
        </span>
      </div>

      <div class="progress shiftProgress">
        <i style="width:${n/6*100}%"></i>
      </div>

      <div class="checklist">
        ${list(tasks,open,'o')}
      </div>

      <button class="btn primary" id="openShift" style="width:100%;margin-top:12px">
        ${n===6?'Подтвердить открытие':'Сохранить прогресс'}
      </button>
    </section>

    <section class="section">
      <section class="card cardPad">
        <div class="sectionHead">
          <div>
            <div class="eyebrow">ЗАКРЫТИЕ</div>
            <h2>Передача ${cn}/6</h2>
          </div>
          <span class="pill ${cn===6?'done':''}">
            ${cn===6?'готово':'не завершено'}
          </span>
        </div>

        <div class="progress shiftProgress">
          <i style="width:${cn/6*100}%"></i>
        </div>

        <div class="checklist">
          ${list([
            'Остатки и заказы',
            'Барная станция',
            'Пиво и линии',
            'Касса / POS',
            'Гостевая зона',
            'Передача проблем'
          ],close,'c')}
        </div>

        <button class="btn gold" id="closeShift" style="width:100%;margin-top:12px">
          Сохранить закрытие
        </button>
      </section>
    </section>

    <section class="section">
      <div class="card cardPad">
        <div class="eyebrow">ПЕРЕДАЧА</div>
        <h3>Проблема, которую нельзя потерять</h3>
        <p style="color:var(--muted)">
          Сразу добавь её в заметки, чтобы следующая команда увидела контекст.
        </p>
        <button class="btn" onclick="go('/notes')">
          Добавить заметку →
        </button>
      </div>
    </section>`,
    '/shift'
  );

  document.querySelectorAll('[data-check]').forEach(el=>
    el.onchange=()=>{
      const k=el.dataset.check;
      const p=k[0];
      const i=k.slice(1);
      const target=p==='o'?state.checks:state.closedChecks;

      target[d] ||= {};
      target[d][i]=el.checked;

      save();
      shift()
    }
  );

  document.getElementById('openShift').onclick=()=>
    toast(n===6?'Открытие смены подтверждено':'Прогресс сохранён');

  document.getElementById('closeShift').onclick=()=>
    toast(cn===6?'Закрытие смены подтверждено':'Прогресс сохранён')
}

function notes(){
  shell(
    `<div class="pageTitle">
      <div class="eyebrow">КОМАНДА</div>
      <h1>Заметки смены</h1>
      <p>Долгоживущая информация отдельно от чата. В будущем критичные заметки можно будет подтверждать.</p>
    </div>

    <section class="card cardPad">
      <div class="noteForm">
        <input class="search" id="author" placeholder="Имя сотрудника">
        <textarea id="noteText" placeholder="Что следующей смене нужно знать?"></textarea>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn primary" id="saveNote">Добавить заметку</button>
          <button class="btn danger" id="addCritical">Критичная</button>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="sectionHead">
        <div>
          <div class="eyebrow">ЛЕНТА</div>
          <h2>Передача</h2>
        </div>
        <span class="pill">
          ${state.notes.filter(n=>!n.done).length} активных
        </span>
      </div>

      <div class="notes">
        ${state.notes.slice().reverse().map((n,i)=>
          `<article class="card note">
            <div class="noteTop">
              <span>${esc(n.author)} · ${esc(n.time)}</span>
              <span class="pill ${n.critical?'urgent':''}">
                ${n.critical?'важно':'заметка'}
              </span>
            </div>

            <p>${esc(n.text)}</p>

            <div class="noteActions">
              <button class="btn" data-done="${state.notes.length-1-i}">
                ${n.done?'Вернуть':'Отметить выполненной'}
              </button>
            </div>
          </article>`
        ).join('')||
        '<div class="card empty">Пока тихо. Это подозрительно, но приятно.</div>'}
      </div>
    </section>`,
    '/notes'
  );

  document.getElementById('saveNote').onclick=()=>addNote(false);
  document.getElementById('addCritical').onclick=()=>addNote(true);

  document.querySelectorAll('[data-done]').forEach(b=>
    b.onclick=()=>{
      state.notes[+b.dataset.done].done=!state.notes[+b.dataset.done].done;
      save();
      notes()
    }
  )
}

function addNote(critical){
  const text=document.getElementById('noteText').value.trim();
  const author=document.getElementById('author').value.trim()||'Команда';

  if(!text)return toast('Напиши текст заметки');

  state.notes.push({
    author,
    text,
    critical,
    done:false,
    time:new Date().toLocaleString('ru-RU',{
      day:'2-digit',
      month:'2-digit',
      hour:'2-digit',
      minute:'2-digit'
    })
  });

  save();
  toast('Заметка добавлена');
  notes()
}

function pause(){
  shell(
    `<div class="pageTitle">
      <div class="eyebrow">МИКРО-ПАУЗА</div>
      <h1>Разгрузить голову</h1>
      <p>Три коротких инструмента. Никаких цитат из LinkedIn.</p>
    </div>

    <div class="pauseGrid">
      <article class="card pauseCard">
        <div class="eyebrow">01 · ТИШИНА</div>
        <h2>60 секунд</h2>
        <div class="bigTimer" id="timer">60</div>
        <button class="btn primary" id="timerStart">Начать</button>
      </article>

      <article class="card pauseCard">
        <div class="eyebrow">02 · ДЫХАНИЕ</div>
        <h2 id="breathText">Вдох</h2>
        <div class="breathCircle" id="breathCircle">4 / 2 / 6</div>
        <button class="btn gold" id="breathStart">2 минуты</button>
      </article>

      <article class="card pauseCard">
        <div class="eyebrow">03 · ФОКУС</div>
        <h2>Три вещи</h2>
        <p style="color:var(--muted)">
          Назови про себя 3 вещи, которые видишь, 2 которые слышишь, 1 физическое ощущение.
        </p>
        <button class="btn" id="focusDone">Готово</button>
      </article>
    </div>`,
    '/'
  );

  let timerId=null;

  document.getElementById('timerStart').onclick=()=>{
    if(timerId)return;

    let n=60;
    const el=document.getElementById('timer');

    el.textContent=n;

    timerId=setInterval(()=>{
      el.textContent=--n;

      if(n<=0){
        clearInterval(timerId);
        timerId=null;
        toast('Минута закончилась');
        el.textContent='60'
      }
    },1000)
  };

  let breathId=null;

  document.getElementById('breathStart').onclick=()=>{
    if(breathId)return;

    const c=document.getElementById('breathCircle');
    const t=document.getElementById('breathText');

    let phase=0;
    let remain=4;

    const phases=[
      ['Вдох',4,'in'],
      ['Пауза',2,''],
      ['Выдох',6,'out']
    ];

    breathId=setInterval(()=>{
      t.textContent=phases[phase][0]+' · '+remain;
      c.className='breathCircle '+phases[phase][2];

      remain--;

      if(remain<0){
        phase=(phase+1)%3;
        remain=phases[phase][1]
      }
    },1000);

    setTimeout(()=>{
      clearInterval(breathId);
      breathId=null;
      t.textContent='Готово';
      c.className='breathCircle'
    },120000)
  };

  document.getElementById('focusDone').onclick=()=>
    toast('Фокус возвращён')
}

async function render(){
  const p=path();

  if(p==='/login'){
    login();
    return
  }

  const {data}=await sb.auth.getSession();

  if(!data.session){
    login();
    return
  }

  currentUser=data.session.user;

  if(p==='/')home();
  else if(p==='/menu')menu();
  else if(p==='/training')training();
  else if(p==='/attestation')attestation();
  else if(p==='/shift')shift();
  else if(p==='/notes')notes();
  else if(p==='/pause')pause();
  else if(p.startsWith('/article/'))article(p.split('/')[2]);
  else home()
}

window.addEventListener('hashchange',render);
render();