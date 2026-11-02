// Actual compiled React screens; isolated fixture HTTP/WS, never production.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mockActualApp} from './unified-fixtures.mjs';
const require=createRequire(new URL('../app/package.json',import.meta.url));
const {chromium}=require('playwright');
const out=path.resolve('evidence/ui-review-2026-10-31');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const pages=[],issues=[],sessions=[];let number=0;
async function session(options={}){
 const s=await mockActualApp(browser,{role:'admin',...options});sessions.push(s);s.page.setDefaultTimeout(8000);
 await s.page.emulateMedia({reducedMotion:'reduce'});
 const originalOpen=s.open;s.open=async url=>{await originalOpen(url);await s.page.reload();await s.page.locator('main').waitFor();};
 s.store.recipes[0].name='Лимонад «Рябиновый Улун»';s.store.recipes[0].photo='/assets/warm/recipe-photo.jpg';
 s.store.recipes[1].name='Бургер';
 s.store.articles.get('review-article').title='Сервис и забота о госте';
 return s;
}
async function shot(s,title){
 await s.page.evaluate(()=>document.fonts.ready);await s.page.waitForTimeout(300);
 // This is a real screen capture; no DOM layout/content injection or CSS changes.
 const geometry=await s.page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
 assert.ok(geometry.scrollWidth<=geometry.width+1,`Overflow: ${title}`);
 assert.equal(await s.page.locator('.warm-credit,.bc-credit').count(),0);
 const file=String(++number).padStart(2,'0')+'.png';await s.page.screenshot({path:path.join(out,file),fullPage:true});
 pages.push({number,title,route:new URL(s.page.url()).hash,file,...geometry});console.log('CAPTURE '+number+' '+title);
}
async function route(s,url,title,ready){await s.open(url);if(ready)await s.page.getByRole('heading',{name:ready,exact:true}).first().waitFor();await shot(s,title);}
async function optional(name,fn){try{await fn();}catch(e){issues.push({name,error:String(e.stack||e)});console.error('FAILED '+name+': '+e.message);}}
try{
 const anon=await session({anonymous:true});
 for(const [url,title,ready] of [['/login','Вход'],['/register','Регистрация'],['/recovery','Восстановление доступа']])await route(anon,url,title,ready);
 const setup=await session();setup.store.profile.recovery_configured=false;await route(setup,'/setup-recovery','Создание секретного кода');
 const s=await session();
 const routes=[['/','Главная'],['/menu','Рецепты'],['/menu/bar%3Areview-drink','Рецепт: напиток'],['/menu/kitchen%3Areview-food','Рецепт: блюдо'],['/knowledge','Знания'],['/knowledge/review-article','Статья'],['/attestation','Аттестация: выбор билета'],['/attestation?view=history','Личные результаты: до прохождения'],['/shift','Смена: открытие'],['/feed','Лента'],['/feed/review-note','Заметка'],['/feed/new','Новая заметка'],['/profile','Мой профиль: администратор'],['/profile?view=details','Личные данные'],['/settings','Настройки и редактирование'],['/settings/notifications','Установка и уведомления'],['/admin?section=team','Сотрудники'],['/admin?section=team&user=22222222-2222-4222-8222-222222222222','Сотрудник: права и должность'],['/admin?section=audit','Журнал'],['/admin?section=audit&view=shifts','История смен'],['/admin?section=attempts','Результаты команды'],['/settings/recipes','Редактор рецептов: список'],['/settings/recipes?editor=new','Создание рецепта'],['/settings/recipes?editor=bar%3Areview-drink','Редактирование рецепта'],['/settings/knowledge','Редактор знаний: список'],['/knowledge/new','Создание статьи'],['/knowledge/review-article/edit','Редактирование статьи'],['/shift/editor','Редактор чек-листов'],['/settings/attestation','Управление аттестацией'],['/settings/attestation?view=tickets','Билеты и настройки: список'],['/settings/attestation/questions','Банк вопросов']];
 for(const [url,title] of routes)await route(s,url,title);
 await optional('Разделы',async()=>{await s.open('/');await s.page.getByRole('button',{name:'Разделы',exact:true}).click();await shot(s,'Разделы: меню');});
 await optional('QR',async()=>{await s.open('/admin?section=team');await s.page.getByRole('button',{name:'Пригласить',exact:true}).click();await shot(s,'Приглашение: QR-код');});
 await optional('Адресаты заметки',async()=>{await s.open('/feed/new');await s.page.getByText('Кого уведомить',{exact:true}).click();await shot(s,'Новая заметка: выбор должностей');});
 await optional('Ознакомились',async()=>{await s.open('/feed');await s.page.getByRole('button',{name:'Ознакомился',exact:true}).first().click();await s.page.getByRole('button',{name:/Ознакомились: 1/}).first().click();await shot(s,'Заметка: кто ознакомился');});
 await optional('Настройки билета',async()=>{await s.open('/settings/attestation?view=tickets');await s.page.getByRole('button',{name:/Бар проверка/}).click();await shot(s,'Настройки билета');});
 await optional('Новый билет',async()=>{await s.open('/settings/attestation?view=tickets');await s.page.getByRole('button',{name:'Добавить билет',exact:true}).click();await shot(s,'Создание билета');});
 await optional('Редактор вопроса',async()=>{await s.open('/settings/attestation/questions');await s.page.locator('details').first().locator('summary').click();await s.page.getByRole('button',{name:'Изменить',exact:true}).first().click();await shot(s,'Редактирование вопроса');});
 await optional('Новый вопрос',async()=>{await s.open('/settings/attestation/questions');await s.page.getByRole('button',{name:/Добавить вопрос|Новый вопрос/}).first().click();await shot(s,'Создание вопроса');});
 await optional('Рецепт раскрыт',async()=>{await s.open('/menu/bar%3Areview-drink');for(const d of await s.page.locator('details').all())await d.locator('summary').click();await shot(s,'Рецепт: раскрытые блоки и действия');});
 await optional('Статья раскрыта',async()=>{await s.open('/knowledge/review-article');for(const d of await s.page.locator('details').all())await d.locator('summary').click();await shot(s,'Статья: действия с материалом');});
 await optional('Смена',async()=>{s.store.shift.status='active';await route(s,'/shift','Смена: закрытие');s.store.shift.status='closed';await route(s,'/shift','Смена: завершена');s.store.shift.status='not_started';});
 await optional('Дни недели',async()=>{await s.open('/shift/editor');await s.page.getByRole('button',{name:/Изменить пункт:/}).first().click();await shot(s,'Редактор чек-листов: пункт и дни недели');});
 await optional('Прохождение и результат',async()=>{
  await s.open('/attestation');await s.page.getByLabel('Выбери тему',{exact:true}).selectOption('bar');await s.page.getByRole('button',{name:'Начать аттестацию',exact:true}).click();await s.page.getByRole('heading',{name:/Бар: вопрос/}).waitFor();await shot(s,'Аттестация: вопрос');
  await s.page.getByRole('button',{name:'Выйти',exact:true}).click();await shot(s,'Аттестация: подтверждение выхода');await s.page.getByRole('button',{name:'Продолжить',exact:true}).click();
  await s.page.getByLabel('Ошибка А',{exact:true}).check();await s.page.getByRole('button',{name:'Следующий вопрос',exact:true}).click();await s.page.getByLabel('Правильный ответ',{exact:true}).check();await s.page.getByRole('button',{name:'Завершить аттестацию',exact:true}).click();await s.page.getByRole('heading',{name:'Нужно повторить материал',exact:true}).waitFor();await shot(s,'Аттестация: результат и повторение');await route(s,'/attestation?view=history','Личные результаты: после прохождения');
 });
 await optional('Пивная карта',async()=>{await s.open('/beer');await s.page.locator('.bc-sort-names button').first().waitFor();for(let i=0;i<7;i++){const button=s.page.locator('.bc-sort-names button').nth(i);const label=await button.innerText();await button.click();await s.page.waitForTimeout(100);await shot(s,'Пивная карта: '+label);}await s.page.getByRole('tab',{name:'Как рассказать гостю',exact:true}).click();await shot(s,'Пивная карта: рассказ гостю');});
 const staff=await session({role:'staff'});await route(staff,'/profile','Мой профиль: сотрудник');await route(staff,'/settings','Настройки: сотрудник');
 for(const width of [375,430,768,1280]){await s.page.setViewportSize({width,height:844});await s.open('/menu?place=current');await s.page.locator('.warm-recipe-card').first().waitFor();const heights=await s.page.locator('.warm-recipe-card').evaluateAll(els=>els.map(e=>({height:e.getBoundingClientRect().height,weight:getComputedStyle(e.querySelector('.warm-recipe-card-title')).fontWeight})));assert.ok(heights.every(x=>x.height>=96&&x.height<=108&&x.weight==='700'),JSON.stringify(heights));assert.equal(await s.page.getByRole('group',{name:'Заведение',exact:true}).count(),0);assert.equal(await s.page.locator('.warm-recipe-card').count(),2);await shot(s,`Рецепты: ширина ${width}px`);await s.open('/profile');const aligned=await s.page.locator('.bf-profile-identity').evaluate(e=>{const position=e.querySelector('div>p:not(.bf-profile-venue)').getBoundingClientRect(),venue=e.querySelector('.bf-profile-venue').getBoundingClientRect();return Math.abs(position.left-venue.left)<1&&venue.top>=position.bottom;});assert.ok(aligned);if(width===375)await shot(s,'Профиль: ширина 375px');}
}catch(e){issues.push({name:'capture',error:String(e.stack||e)});console.error(e);}finally{
 const network=sessions.map(s=>({unknown:s.store.unknown,blocked:s.store.blocked,errors:s.errors,consoleErrors:s.consoleErrors}));fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),scope:'Actual browser screenshots of locally built app; fixture data, simulated permissions and APIs; no production access/writes. Redirect aliases are represented by destination screens. All routes and extra states listed below.',pages,issues,network},null,2));await browser.close();console.log(JSON.stringify({screens:pages.length,issues}));process.exitCode=issues.length||network.some(s=>s.errors.length)?1:0;
}
