(() => {
  'use strict';

  const VERSION = '20260918-r31';

  const e = text => String(text ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const safeImage = value => {
    try {
      const u = new URL(value, location.href);
      return /^(https?:)$/.test(u.protocol) && !u.username && !u.password ? u.href : '';
    } catch {
      return '';
    }
  };

  const plain = s => String(s ?? '').replace(/[*=#>]/g,'').replace(/\s+/g,' ').trim();
  const minutes = a => Math.max(1, Math.ceil(plain(a.body).split(/\s+/).filter(Boolean).length / 180));

  function normalizeCategory(raw, title = '') {
    const c = String(raw ?? '')
      .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
      .replace(/^[\s:·-]+|[\s:·-]+$/g, '')
      .trim();

    if (/как появилось пиво/i.test(title)) return 'Пиво';
    if (/крепкий алкоголь/i.test(c)) return 'Алкоголь';
    if (/винная карта/i.test(c) || /^вино$/i.test(c)) return 'Вино';
    if (/сервис/i.test(c)) return 'Сервис';
    if (/пиво/i.test(c)) return 'Пиво';
    if (/бар/i.test(c)) return 'Бар';
    if (/кухн/i.test(c)) return 'Кухня';
    if (/sop|инструкц/i.test(c)) return 'SOP';
    return c || 'Обучение';
  }

  function inline(text) {
    return e(text)
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/==(.+?)==/g,'<mark>$1</mark>');
  }

  function markdown(text) {
    const out = [];
    let paragraph = [];
    let list = null;

    const flush = () => {
      if (paragraph.length) {
        out.push('<p>'+paragraph.map(inline).join('<br>')+'</p>');
        paragraph = [];
      }
      if (list) {
        out.push('</'+list+'>');
        list = null;
      }
    };

    for (const raw of String(text ?? '').replace(/\r/g,'').split('\n')) {
      const line = raw.trim();
      const img = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);

      if (!line) { flush(); continue; }

      if (img) {
        flush();
        const src = safeImage(img[2]);
        if (src) {
          out.push(
            `<figure class="learnFigure">
              <button class="learnImageButton" type="button" data-learn-image="${e(src)}" aria-label="Открыть изображение: ${e(img[1])}">
                <img src="${e(src)}" alt="${e(img[1])}" loading="lazy">
              </button>
              <figcaption>${e(img[1])}</figcaption>
            </figure>`
          );
        }
        continue;
      }

      if (/^(?:-{3,}|_{3,})$/.test(line)) {
        flush();
        out.push('<hr>');
        continue;
      }

      if (/^#{1,6}\s/.test(line)) {
        flush();
        out.push('<h3>'+inline(line.replace(/^#+\s/,''))+'</h3>');
        continue;
      }

      if (/^>\s?/.test(line)) {
        flush();
        out.push('<aside class="learnCallout">'+inline(line.replace(/^>\s?/,''))+'</aside>');
        continue;
      }

      const li = line.match(/^(?:[-•]\s+|\d+[.)]\s+)(.*)$/);
      if (li) {
        const type = /^\d/.test(line) ? 'ol' : 'ul';
        if (paragraph.length || (list && list !== type)) flush();
        if (!list) {
          list = type;
          out.push('<'+type+'>');
        }
        out.push('<li>'+inline(li[1])+'</li>');
        continue;
      }

      if (list) flush();
      paragraph.push(line);
    }

    flush();
    return out.join('');
  }

  function parseArticles(text) {
    const articles = [];
    let category = 'Обучение';
    let active = null;

    for (const line of String(text ?? '').replace(/\r/g,'').split('\n')) {
      if (line.startsWith('### ')) {
        category = line.slice(4).trim().replace(/:$/,'');
        active = null;
      } else if (line.startsWith('## ')) {
        const title = line.slice(3).trim();
        active = {
          id: 'lesson-' + (articles.length + 1),
          category: normalizeCategory(category, title),
          title,
          body: ''
        };
        articles.push(active);
      } else if (active) {
        active.body += line + '\n';
      }
    }

    return articles
      .filter(a => !/^Раздел в разработке$/i.test(a.title))
      .map(a => ({ ...a, body: a.body.trim() }));
  }

  function shuffle(array) {
    const out = [...array];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  const storageKey = () => 'bf-learning-r18:' + String(currentUser?.id || 'guest');

  function readRecord() {
    try {
      return JSON.parse(localStorage.getItem(storageKey())) || { read: [], history: [] };
    } catch {
      return { read: [], history: [] };
    }
  }

  function writeRecord(record) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(record));
      return true;
    } catch {
      return false;
    }
  }

  let trainingProgressCache = null;
  let trainingProgressLoadedAt = 0;

  async function getTrainingReadState(force = false) {
    const local = new Set(readRecord().read || []);

    if (!currentUser?.id) {
      return { ids: local, source: 'device' };
    }

    if (!force && trainingProgressCache && Date.now() - trainingProgressLoadedAt < 30000) {
      return { ids: new Set(trainingProgressCache), source: 'profile' };
    }

    const { data, error } = await sb
      .from('training_progress')
      .select('article_id,completed')
      .eq('user_id', currentUser.id)
      .eq('completed', true);

    if (error) throw error;

    trainingProgressCache = new Set((data || []).map(x => x.article_id).filter(Boolean));
    trainingProgressLoadedAt = Date.now();

    // Preserve offline continuity by mirroring server-completed articles locally.
    const record = readRecord();
    record.read = [...new Set([...(record.read || []), ...trainingProgressCache])];
    writeRecord(record);

    return { ids: new Set(trainingProgressCache), source: 'profile' };
  }

  async function markArticleRead(articleId) {
    if (!currentUser?.id) throw new Error('auth_required');

    const now = new Date().toISOString();
    const { error } = await sb
      .from('training_progress')
      .upsert({
        user_id: currentUser.id,
        article_id: articleId,
        completed: true,
        progress_percent: 100,
        updated_at: now
      }, { onConflict: 'user_id,article_id' });

    if (error) throw error;

    if (!trainingProgressCache) trainingProgressCache = new Set();
    trainingProgressCache.add(articleId);
    trainingProgressLoadedAt = Date.now();
  }

  let articles = null;
  let bank = null;
  let activeQuiz = null;

  const browse = {
    category: 'Все',
    query: '',
    scrollY: 0
  };

  async function file(name) {
    const r = await fetch('./assets/' + name + '?v=' + VERSION, { cache: 'no-cache' });
    if (!r.ok) throw Error('Не удалось загрузить материалы. Обновите страницу и попробуйте снова.');
    return r.text();
  }

  async function getArticles() {
    if (!articles) {
      articles = parseArticles(await file('training-data.txt'));
      if (!articles.length) throw Error('Статьи пока не добавлены.');
    }
    return articles;
  }

  window.searchKnowledge = async function searchKnowledgeR36(query) {
    const q = String(query ?? '').trim().toLowerCase();
    if (!q) return [];

    const data = await getArticles();
    return data
      .filter(a => `${a.title} ${a.category} ${a.body}`.toLowerCase().includes(q))
      .slice(0, 8)
      .map(a => ({
        type: 'knowledge',
        id: a.id,
        title: a.title,
        category: a.category
      }));
  };

  function errorPage(message, route) {
    shell(
      `<div class="card cardPad">
        <h1>Не удалось открыть раздел</h1>
        <p>${e(message)}</p>
        <button class="btn" id="learnRetry">Повторить</button>
      </div>`,
      '/training'
    );
    document.getElementById('learnRetry').onclick = () => route();
  }

  function ensureLearnLightbox() {
    let box = document.getElementById('learnLightbox');
    if (box) return box;

    box = document.createElement('div');
    box.id = 'learnLightbox';
    box.className = 'learnLightbox';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = `
      <button class="learnLightboxClose" type="button" aria-label="Закрыть">×</button>
      <img class="learnLightboxImg" alt="">
    `;
    document.body.appendChild(box);

    const close = () => {
      box.classList.remove('open');
      box.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('learnLightboxOpen');
      const img = box.querySelector('.learnLightboxImg');
      img.removeAttribute('src');
      img.alt = '';
    };

    box.querySelector('.learnLightboxClose').onclick = close;
    box.addEventListener('click', ev => { if (ev.target === box) close(); });
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && box.classList.contains('open')) close();
    });

    return box;
  }

  function attachLearnImages(root) {
    root.querySelectorAll('[data-learn-image]').forEach(button => {
      button.onclick = () => {
        const src = button.dataset.learnImage;
        if (!src) return;
        const box = ensureLearnLightbox();
        const img = box.querySelector('.learnLightboxImg');
        img.src = src;
        img.alt = button.querySelector('img')?.alt || '';
        box.classList.add('open');
        box.setAttribute('aria-hidden', 'false');
        document.body.classList.add('learnLightboxOpen');
      };
    });
  }

  async function shareArticle(article) {
    const url = location.href;
    const title = `${article.title} · BeerFactory`;
    const text = `${article.title} — база знаний BeerFactory`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast('Ссылка на статью скопирована');
    } catch {
      const field = document.createElement('textarea');
      field.value = url;
      field.setAttribute('readonly','');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand('copy');
        toast('Ссылка на статью скопирована');
      } catch {
        toast('Не удалось скопировать ссылку');
      }
      field.remove();
    }
  }

  window.training = async function trainingR31() {
    window.scrollTo(0, 0);
    shell('<div class="card empty">Загрузка статей…</div>', '/training');

    let data;
    try {
      data = await getArticles();
    } catch (err) {
      if (path() === '/training') errorPage(err.message, window.training);
      return;
    }
    if (path() !== '/training') return;

    const available = ['Все', ...new Set(data.map(a => a.category))];
    if (!available.includes(browse.category)) browse.category = 'Все';

    let readState;
    try {
      readState = await getTrainingReadState(false);
    } catch {
      readState = { ids: new Set(readRecord().read || []), source: 'device' };
    }

    shell(`
      <div class="pageTitle learnPageTitle">
        <div class="eyebrow">БАЗА ЗНАНИЙ</div>
        <h1>Знания</h1>
        <p>Рабочие материалы BeerFactory. Ищи по теме, слову или содержанию статьи.</p>
        <div class="actions">
          <a class="btn gold" href="#/attestation">Пройти аттестацию</a>
        </div>
      </div>

      <div class="learnSearchWrap">
        <input class="search" id="learnSearch" aria-label="Поиск по статьям" placeholder="Например: виски, жалоба, подача…" value="${e(browse.query)}">
      </div>

      <div class="rail learnRail" id="learnCats"></div>
      <div class="learnBrowseMeta"><span id="learnResultCount"></span></div>
      <div class="learnList" id="learnList"></div>
    `, '/training');

    document.getElementById('learnCats').innerHTML = available
      .map(c => `<button class="chip ${c === browse.category ? 'active' : ''}" data-learn-cat="${e(c)}">${e(c)}</button>`)
      .join('');

    function list() {
      const read = readState.ids;
      const q = browse.query.toLowerCase().trim();

      const filtered = data.filter(a =>
        (browse.category === 'Все' || a.category === browse.category) &&
        `${a.title} ${a.category} ${a.body}`.toLowerCase().includes(q)
      );

      const count = document.getElementById('learnResultCount');
      if (count) count.textContent = `Найдено: ${filtered.length}`;

      document.getElementById('learnList').innerHTML = filtered.map(a => `
        <a class="card learnRow" href="#/article/${e(a.id)}" data-article-row="${e(a.id)}">
          <div class="learnRowBody">
            <div class="learnRowCategory">${e(a.category)}</div>
            <h3>${e(a.title)}</h3>
            <p>${e(plain(a.body).slice(0, 150))}${plain(a.body).length > 150 ? '…' : ''}</p>
            <div class="learnRowMeta">
              <span>${minutes(a)} мин</span>
              <span>·</span>
              <span class="${read.has(a.id) ? 'learnRead' : ''}">${read.has(a.id) ? 'Прочитано ✓' : 'Открыть статью'}</span>
            </div>
          </div>
          <span class="learnRowArrow" aria-hidden="true">›</span>
        </a>
      `).join('') || '<div class="card empty">Ничего не найдено. Попробуйте другое слово или категорию.</div>';

      document.querySelectorAll('[data-article-row]').forEach(row => {
        row.addEventListener('click', () => { browse.scrollY = window.scrollY; });
      });
    }

    document.getElementById('learnSearch').oninput = ev => {
      browse.query = ev.target.value.trim();
      list();
    };

    document.querySelectorAll('[data-learn-cat]').forEach(b => {
      b.onclick = () => {
        browse.category = b.dataset.learnCat;
        document.querySelectorAll('[data-learn-cat]').forEach(x => x.classList.toggle('active', x === b));
        list();
      };
    });

    list();

    if (browse.scrollY > 0) {
      requestAnimationFrame(() => window.scrollTo(0, browse.scrollY));
    }
  };

  window.article = async function articleR31(id) {
    shell('<div class="card empty">Загрузка статьи…</div>', '/training');

    let data;
    try {
      data = await getArticles();
    } catch (err) {
      if (path() === '/article/' + id) errorPage(err.message, () => window.article(id));
      return;
    }
    if (path() !== '/article/' + id) return;

    const a = data.find(x => x.id === id);
    if (!a) {
      shell(
        `<div class="card cardPad">
          <h1>Статья не найдена</h1>
          <a class="btn" href="#/training">Все статьи</a>
        </div>`,
        '/training'
      );
      return;
    }

    let read = false;
    try {
      read = (await getTrainingReadState(false)).ids.has(a.id);
    } catch {
      read = (readRecord().read || []).includes(a.id);
    }

    shell(`
      <div class="learnDetailTop">
        <a class="learnBack" href="#/training">← Знания</a>
        <div class="learnDetailActions">
          <span class="pill">${minutes(a)} мин</span>
          <button class="learnShare" id="learnShare" type="button" aria-label="Поделиться статьёй">↗ <span>Поделиться</span></button>
        </div>
      </div>

      <article class="card articleView learnArticle">
        <span class="tag">${e(a.category)}</span>
        <h1>${e(a.title)}</h1>
        <div class="learnBody">${markdown(a.body)}</div>

        <div class="learnArticleActions">
          <button class="btn primary" id="markRead">${read ? 'Прочитано ✓' : 'Отметить прочитанным'}</button>
          <a class="btn" href="#/attestation">Проверить знания</a>
        </div>

        <p id="learnSaveStatus" role="status"></p>
      </article>
    `, '/training');

    window.scrollTo(0, 0);

    const share = document.getElementById('learnShare');
    if (share) share.onclick = () => shareArticle(a);

    attachLearnImages(document);

    document.getElementById('markRead').onclick = async () => {
      const button = document.getElementById('markRead');
      const status = document.getElementById('learnSaveStatus');

      const record = readRecord();
      record.read = [...new Set([...(record.read || []), id])];
      writeRecord(record);

      button.disabled = true;
      button.textContent = 'Сохраняем…';
      status.textContent = '';

      try {
        await markArticleRead(id);
        button.textContent = 'Прочитано ✓';
        status.textContent = 'Отметка сохранена в профиле.';
      } catch (error) {
        console.error('BeerFactory training progress:', error);
        button.textContent = 'Прочитано ✓';
        status.textContent = 'Профиль недоступен. Отметка сохранена только на этом устройстве.';
      } finally {
        button.disabled = false;
      }
    };
  };

  function validateBank(data) {
    if (!data || data.passPercent !== 80 || data.questionsPerTest !== 15 || !Array.isArray(data.categories)) {
      throw Error('Не удалось прочитать настройки аттестации.');
    }

    const labels = { bar:'Бар', kitchen:'Кухня', wine:'Вино', service:'Сервис' };
    const minimum = { bar:50, kitchen:100, wine:50, service:100 };
    const ids = new Set();

    if (data.categories.length !== 4) throw Error('В банке должны быть четыре категории.');

    const seen = new Set();
    for (const c of data.categories) {
      if (!labels[c.id] || labels[c.id] !== c.label || seen.has(c.id) || !Array.isArray(c.questions) || c.questions.length < minimum[c.id]) {
        throw Error('Проверьте банк вопросов категории.');
      }

      seen.add(c.id);

      for (const q of c.questions) {
        if (
          !q.id ||
          ids.has(q.id) ||
          !q.q ||
          !Array.isArray(q.answers) ||
          q.answers.length !== 4 ||
          q.answers.some(a => !a.text || typeof a.correct !== 'boolean') ||
          q.answers.filter(a => a.correct).length !== 1 ||
          new Set(q.answers.map(a => a.text.trim().toLowerCase())).size !== 4
        ) {
          throw Error('Некорректный вопрос: ' + (q.id || 'без номера'));
        }
        ids.add(q.id);
      }
    }

    for (const c of data.categories) {
      if (
        !Array.isArray(c.ticketPlan) ||
        c.ticketPlan.reduce((n,p) => n + p.count, 0) !== data.questionsPerTest ||
        new Set(c.ticketPlan.map(p => p.topic)).size !== c.ticketPlan.length
      ) {
        throw Error('Проверьте план билета.');
      }

      for (const part of c.ticketPlan) {
        const groups = new Set(c.questions.filter(q => q.topic === part.topic).map(q => q.group));
        if (!Number.isInteger(part.count) || part.count < 1 || groups.has(undefined) || groups.size < part.count) {
          throw Error('Недостаточно разных тем для билета.');
        }
      }
    }

    return data;
  }

  function buildTicket(category) {
    const ticket = [];

    for (const part of category.ticketPlan) {
      const groups = new Map();

      for (const q of category.questions.filter(q => q.topic === part.topic)) {
        if (!groups.has(q.group)) groups.set(q.group, []);
        groups.get(q.group).push(q);
      }

      for (const group of shuffle([...groups.values()]).slice(0, part.count)) {
        const q = shuffle(group)[0];
        ticket.push({ ...q, answers: shuffle(q.answers) });
      }
    }

    return shuffle(ticket);
  }

  const hasPassed = (correct, total, percent = 80) =>
    total > 0 && correct * 100 >= total * percent;

  async function getRemoteQuizHistory(limit = 5) {
    if (!currentUser?.id) return [];

    const { data, error } = await sb
      .from('quiz_attempts')
      .select('category,category_id,score,passed,total_questions,correct_answers,created_at,finished_at')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  function buildTopicResults(attempt) {
    const topics = {};

    attempt.qs.forEach((q, i) => {
      const topic = q.topic || 'Общее';
      const chosen = q.answers[attempt.answers[i]];
      if (!topics[topic]) topics[topic] = { total: 0, correct: 0 };
      topics[topic].total += 1;
      if (chosen?.correct) topics[topic].correct += 1;
    });

    const weakTopics = Object.entries(topics)
      .filter(([, value]) => value.correct < value.total)
      .map(([topic, value]) => ({
        topic,
        total: value.total,
        correct: value.correct
      }));

    return { topics, weakTopics };
  }

  async function persistQuizAttempt(attempt, result) {
    if (!currentUser?.id) throw new Error('auth_required');

    const { error } = await sb.from('quiz_attempts').insert({
      user_id: currentUser.id,
      category: attempt.category,
      category_id: attempt.categoryId,
      score: result.score,
      passed: result.passed,
      total_questions: result.total,
      correct_answers: result.correct,
      category_results: {
        pass_percent: attempt.passPercent,
        topics: result.topicResults.topics,
        weak_topics: result.topicResults.weakTopics
      },
      started_at: attempt.startedAt,
      finished_at: result.finishedAt
    });

    if (error) throw error;
  }

  window.attestation = async function attestationR31() {
    window.scrollTo(0, 0);
    activeQuiz = null;
    shell('<div class="card empty">Загрузка вопросов…</div>', '/training');

    try {
      if (!bank) bank = validateBank(JSON.parse(await file('question-banks.json')));
    } catch (err) {
      if (path() === '/attestation') errorPage(err.message, window.attestation);
      return;
    }
    if (path() !== '/attestation') return;

    let selected = null;
    let historySource = 'profile';
    let history = [];

    try {
      history = (await getRemoteQuizHistory(5)).map(h => ({
        category: h.category || 'Общий тест',
        time: h.finished_at || h.created_at,
        correct: h.correct_answers,
        total: h.total_questions,
        score: h.score,
        passed: h.passed
      }));
    } catch {
      historySource = 'device';
      history = (readRecord().history || []).slice(-5).reverse().map(h => ({
        category: h.category || 'Общий тест',
        time: h.time,
        correct: h.correct,
        total: h.total,
        score: h.score,
        passed: h.passed
      }));
    }

    shell(`
      <div class="pageTitle">
        <div class="eyebrow">ПРОВЕРКА ЗНАНИЙ</div>
        <h1>Аттестация</h1>
        <p>15 вопросов. Зачёт — от 12 верных ответов (80%).</p>
      </div>

      <section class="card cardPad">
        <h2>Категория вопросов</h2>
        <div class="quizCategories" role="group" aria-label="Категория вопросов">
          ${bank.categories.map(c => `
            <button class="quizCategory" data-quiz-category="${e(c.id)}" aria-pressed="false">
              <strong>${e(c.label)}</strong>
              <span>${c.questions.length} вопросов в базе</span>
            </button>
          `).join('')}
        </div>

        <p id="quizSelection" role="status">Сначала выберите категорию.</p>
        <p>В билете разные темы без повторения рецептов. Вопросы и ответы перемешиваются.</p>

        <div class="actions">
          <button class="btn primary" id="learnStart" disabled>Начать</button>
          <a class="btn" href="#/training">К знаниям</a>
        </div>
      </section>

      <section class="section card cardPad">
        <h2>Мои попытки</h2>
        <p>${historySource === 'profile'
          ? 'История сохраняется в вашем профиле.'
          : 'Профиль недоступен. Показана локальная история этого устройства.'}</p>
        ${history.length
          ? history.map(h => `
              <div class="metric">
                <span>${e(h.category || 'Общий тест')}<br>${e(new Date(h.time).toLocaleString('ru-RU'))}</span>
                <b>${h.correct}/${h.total} · ${h.score}%</b>
              </div>
            `).join('')
          : '<p>Попыток пока нет.</p>'}
      </section>
    `, '/training');

    document.querySelectorAll('[data-quiz-category]').forEach(b => {
      b.onclick = () => {
        selected = bank.categories.find(c => c.id === b.dataset.quizCategory) || null;

        document.querySelectorAll('[data-quiz-category]').forEach(x => {
          const on = x === b;
          x.classList.toggle('selected', on);
          x.setAttribute('aria-pressed', String(on));
        });

        const start = document.getElementById('learnStart');
        start.disabled = !selected;
        start.textContent = selected ? 'Начать · ' + selected.label : 'Начать';

        document.getElementById('quizSelection').textContent = selected
          ? selected.label + ': 15 вопросов. Проходной результат — 12 из 15.'
          : 'Сначала выберите категорию.';
      };
    });

    document.getElementById('learnStart').onclick = () => {
      if (!selected) return;

      activeQuiz = {
        qs: buildTicket(selected),
        category: selected.label,
        categoryId: selected.id,
        passPercent: bank.passPercent,
        i: 0,
        answers: [],
        selected: null,
        owner: storageKey(),
        startedAt: new Date().toISOString()
      };

      question();
    };
  };

  function question() {
    const q = activeQuiz.qs[activeQuiz.i];

    shell(`
      <div class="quizHeader">
        <button class="btn" id="learnExit">← Выйти</button>
        <span class="pill">${e(activeQuiz.category)} · ${activeQuiz.i + 1} / ${activeQuiz.qs.length}</span>
      </div>

      <div class="progress">
        <i style="width:${activeQuiz.i / activeQuiz.qs.length * 100}%"></i>
      </div>

      <section class="section card question">
        <h2>${e(q.q)}</h2>
        <div class="answers">
          ${q.answers.map((a,i) => `
            <button class="answer" aria-pressed="false" data-choice="${i}">${e(a.text)}</button>
          `).join('')}
        </div>
        <div class="actions">
          <button class="btn primary" id="learnNext" disabled>${activeQuiz.i === activeQuiz.qs.length - 1 ? 'Завершить' : 'Ответить'}</button>
        </div>
      </section>
    `, '/training');

    window.scrollTo(0, 0);

    document.getElementById('learnExit').onclick = () => {
      if (confirm('Прервать попытку? Незавершённый результат не сохранится.')) window.attestation();
    };

    document.querySelectorAll('[data-choice]').forEach(b => {
      b.onclick = () => {
        activeQuiz.selected = Number(b.dataset.choice);

        document.querySelectorAll('[data-choice]').forEach(x => {
          x.classList.toggle('selected', x === b);
          x.setAttribute('aria-pressed', String(x === b));
        });

        document.getElementById('learnNext').disabled = false;
      };
    });

    document.getElementById('learnNext').onclick = () => {
      if (activeQuiz.selected === null) return;

      activeQuiz.answers.push(activeQuiz.selected);
      activeQuiz.i++;
      activeQuiz.selected = null;

      if (activeQuiz.i < activeQuiz.qs.length) question();
      else finish();
    };
  }

  function finish() {
    const attempt = activeQuiz;
    activeQuiz = null;

    const reviewed = attempt.qs.map((q,i) => ({
      q,
      chosen: q.answers[attempt.answers[i]]
    }));

    const mistakes = reviewed.filter(x => !x.chosen.correct);
    const total = attempt.qs.length;
    const correct = total - mistakes.length;
    const score = Math.round(correct / total * 100);
    const passed = hasPassed(correct, total, attempt.passPercent);
    const finishedAt = new Date().toISOString();
    const topicResults = buildTopicResults(attempt);

    // Local history remains only as cache/fallback, not source of truth.
    const record = readRecord();
    record.history = [
      ...(record.history || []),
      {
        time: Date.now(),
        correct,
        total,
        score,
        passed,
        category: attempt.category,
        categoryId: attempt.categoryId,
        passPercent: attempt.passPercent
      }
    ].slice(-100);
    if (attempt.owner === storageKey()) writeRecord(record);

    shell(`
      <section class="card result">
        <div class="eyebrow">РЕЗУЛЬТАТ · ${e(attempt.category)}</div>
        <div class="score">${score}%</div>
        <h1>${passed ? 'Аттестация пройдена' : 'Нужно повторить материал'}</h1>
        <p>${correct} из ${total} · проходной порог ${attempt.passPercent}%</p>
        <p id="quizSaveStatus" class="quizSaveStatus">Сохраняем результат в профиль…</p>
        <div class="actions">
          <button class="btn primary" id="learnAgain">Новая попытка</button>
          <a class="btn" href="#/training">К знаниям</a>
        </div>
      </section>

      ${mistakes.length ? `
        <section class="section">
          <h2>Разбор ошибок</h2>
          ${mistakes.map(x => `
            <article class="card cardPad learnMistake">
              <h3>${e(x.q.q)}</h3>
              <p>Ваш ответ: ${e(x.chosen.text)}</p>
              <p class="learnCorrect">Верно: ${e(x.q.answers.find(a => a.correct).text)}</p>
              <p class="learnReviewNote">${e(x.q.reviewNote || x.q.topic || '')}</p>
              ${/^#\/(?:menu|article\/lesson-\d+)$/.test(x.q.reviewUrl || '')
                ? `<a class="btn" href="${e(x.q.reviewUrl)}">${e(x.q.reviewLabel || 'Повторить')}</a>`
                : ''}
            </article>
          `).join('')}
        </section>
      ` : ''}
    `, '/training');

    document.getElementById('learnAgain').onclick = window.attestation;
    window.scrollTo(0, 0);

    persistQuizAttempt(attempt, {
      score,
      passed,
      total,
      correct,
      finishedAt,
      topicResults
    }).then(() => {
      const status = document.getElementById('quizSaveStatus');
      if (status) {
        status.textContent = 'Результат сохранён в профиле.';
        status.classList.add('saved');
      }
    }).catch(error => {
      console.error('BeerFactory quiz persistence:', error);
      const status = document.getElementById('quizSaveStatus');
      if (status) {
        status.textContent = 'Не удалось сохранить в профиле. Результат останется только на этом устройстве.';
        status.classList.add('failed');
      }
    });
  }
})();