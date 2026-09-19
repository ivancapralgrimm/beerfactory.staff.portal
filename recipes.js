(() => {
  'use strict';

  const MENU_SCHEMA_VERSION = 40;
  const MENU_FRESH_MS = 5 * 60 * 1000;

  const viewState = {
    query: '',
    category: 'Все',
    scrollY: 0
  };

    const clean = v => String(v ?? '').trim();
  const categoryLabel = value => /^лимонад$/i.test(clean(value)) ? 'Б/А напитки' : clean(value);
  const tagWords = value => (Array.isArray(value) ? value : [value])
    .flatMap(part => clean(part).split(/[\s,;|·]+/u)).filter(Boolean);
  const lines = v => clean(v).split(/\n|·/).map(x => x.trim()).filter(Boolean);

  const get = (row, ...keys) => {
    for (const k of keys) if (row && row[k] != null && clean(row[k]) !== '') return row[k];
    return '';
  };

  function stableFallbackId(category, name) {
    const source = `${category}|${name}`.toLowerCase();
    let hash = 2166136261;
    for (let i = 0; i < source.length; i++) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `bf-${(hash >>> 0).toString(36)}`;
  }

  function normalizeRow(row, fallbackCategory = 'Меню', sourceHint = '') {
    const category = clean(get(row, 'category', 'Category', 'Категория', 'cat')) || fallbackCategory;
    const name = clean(get(row, 'name', 'Name', 'Название', 'Title')) || 'Без названия';
    const subcategory = clean(get(row, 'subcategory', 'Subcategory', 'Подкатегория', 'subcat'));
    const compound = get(row, 'ingredients', 'Ingredients', 'Состав', 'compound');
    const method = get(row, 'method', 'Method', 'Метод', 'Приготовление', 'Описание');
    const serving = get(row, 'serving', 'Serving', 'Подача', 'Граммовка', 'Вес');
    const tagsRaw = get(row, 'tags', 'Tags', 'Теги');
    const ingredientLines = Array.isArray(compound) ? compound.map(clean).filter(Boolean) : lines(compound);
    const recordId = clean(get(row, 'recordId', 'record_id', 'id', 'Id', 'ID', '_id'));
    const source = clean(sourceHint || get(row, 'source', 'Source', '_source', 'table', 'Table')) || category || fallbackCategory;
    const id = recordId ? `${source.toLowerCase()}:${recordId}` : stableFallbackId(source, name);

    return {
      id,
      recordId,
      source,
      name,
      category,
      subcategory,
      desc: clean(get(row, 'desc', 'description', 'Description', 'Описание')) || clean(method) || 'Открыть техкарту',
      ingredients: ingredientLines,
      method: clean(method),
      serving: clean(serving),
      photo: clean(get(row, 'photo', 'Photo', 'Фото-ссылка', 'Фото')),
      tags: tagWords(tagsRaw),
      status: clean(get(row, 'status', 'Status', 'Статус')),
      version: clean(get(row, 'version', 'Version', 'Версия')),
      updatedAt: clean(get(row, 'updated_at', 'updatedAt', 'Updated at', 'Обновлено')),
      updatedBy: clean(get(row, 'updated_by', 'updatedBy', 'Updated by', 'Кем обновлено')),
      changeNote: clean(get(row, 'change_note', 'changeNote', 'Change note', 'Что изменено'))
    };
  }

  function recipeStatusKind(value) {
    const status = clean(value).toLowerCase();
    if (!status) return 'current';
    if (['актуальный','current','active','published'].includes(status)) return 'current';
    if (['архив','archive','archived'].includes(status)) return 'archive';
    if (['черновик','draft'].includes(status)) return 'draft';
    return 'current';
  }

  function isArchive(item) {
    return recipeStatusKind(item?.status) === 'archive';
  }

  function staffVisible(rows) {
    return rows.filter(item => recipeStatusKind(item.status) !== 'draft');
  }

  function rowsFromPayload(d) {
    if (Array.isArray(d)) {
      return staffVisible(d.map(x => {
        const fallback = clean(get(x, 'category', 'Category', 'Категория', 'cat')) || 'Меню';
        const source = clean(get(x, 'source', 'Source', '_source', 'table', 'Table')) || fallback;
        return normalizeRow(x, fallback, source);
      }));
    }

    const groups = [
      ['bar','Бар','bar'],
      ['kitchen','Кухня','kitchen'],
      ['preparations','Заготовки','preparations'],
      ['infusions','Настойки','infusions'],
      ['cordials','Кордиалы','cordials']
    ];

    const hasGroups = groups.some(([key]) => Array.isArray(d?.[key]));
    if (hasGroups) {
      const out = [];
      for (const [key, fallback, source] of groups) {
        if (Array.isArray(d?.[key])) {
          out.push(...d[key].map(x => normalizeRow(x, fallback, source)));
        }
      }
      return staffVisible(out);
    }

    if (Array.isArray(d?.recipes)) {
      return staffVisible(d.recipes.map(x => {
        const fallback = clean(get(x, 'category', 'Category', 'Категория', 'cat')) || 'Меню';
        const source = clean(get(x, 'source', 'Source', '_source', 'table', 'Table')) || fallback;
        return normalizeRow(x, fallback, source);
      }));
    }

    return [];
  }

  function cachedMenu() {
    if (!Array.isArray(state.menu) || !state.menu.length) return [];
    if (![17,18,19,20,21,22,23,24,MENU_SCHEMA_VERSION].includes(Number(state.menuSchemaVersion))) return [];
    return staffVisible(state.menu.map(x => normalizeRow(x, x.category || 'Меню', x.source || x.category || 'Меню')));
  }

  function setMenuState(rows, source, syncedAt = state.menuSyncedAt || null) {
    state.menu = rows;
    state.menuSource = source;
    state.menuSchemaVersion = MENU_SCHEMA_VERSION;
    state.menuSyncedAt = syncedAt;
    try { save(); } catch (e) { console.warn('BeerFactory menu cache save failed:', e); }
  }

  function menuCacheIsFresh() {
    const t = Number(state.menuSyncedAt || 0);
    return t > 0 && (Date.now() - t) < MENU_FRESH_MS;
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      return await fetch(url, { ...options, ...(controller ? { signal: controller.signal } : {}) });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  window.loadMenu = async function loadMenuR40() {
    const cached = cachedMenu();

    if (cached.length && menuCacheIsFresh()) {
      setMenuState(cached, 'cache-fresh', state.menuSyncedAt);
      return cached;
    }

    if (cached.length && navigator.onLine === false) {
      setMenuState(cached, 'cache-offline', state.menuSyncedAt);
      return cached;
    }

    try {
      const timeoutMs = cached.length ? 3000 : 7000;
      const r = await fetchWithTimeout(API_BASE + '/menu', { cache: 'no-store' }, timeoutMs);
      if (!r.ok) throw new Error('menu_http_' + r.status);

      const d = await r.json();

      state.menuGovernanceEnabled = Boolean(
        d?.capabilities?.governance ||
        d?.governance?.enabled
      );
      state.menuGovernanceWritable = Boolean(
        d?.capabilities?.recipe_admin_write
      );
      state.menuSourceAwareIds = Boolean(
        d?.capabilities?.source_aware_ids
      );

      const rows = rowsFromPayload(d);
      if (!rows.length) throw new Error('menu_empty');

      setMenuState(rows, 'api', Date.now());
      return rows;
    } catch (e) {
      console.warn('BeerFactory recipes API unavailable:', e);

      if (cached.length) {
        setMenuState(cached, 'cache-offline', state.menuSyncedAt);
        return cached;
      }

      const fallback = (typeof localMenu === 'function' ? localMenu() : []).map(x => normalizeRow(x));
      setMenuState(fallback, 'local', null);
      return fallback;
    }
  };

  const UNIT_RX = /(мл|л|гр|г|кг|шт|штук(?:а|и)?|порц(?:ия|ии|ий)?|порц|ст\.л|ч\.л|уп|кап(?:ля|ли|ель)|дольк(?:а|и|ек)|слайс(?:а|ов)?|лист(?:а|ьев)?|зерн(?:о|а|ёрен)|веточк(?:а|и|ек)|палочк(?:а|и|ек)|зубчик(?:а|ов)?|ломтик(?:а|ов)?|кус(?:ок|ка|ков)|дэш(?:а|ей)?|dash(?:es)?)/i;

  function parseIngredient(line) {
    const re = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_RX.source})\\.?`, 'i');
    const m = String(line).match(re);
    if (!m) return null;
    const value = Number(m[1].replace(',', '.'));
    if (!Number.isFinite(value)) return null;
    return {
      value,
      valueText: m[1],
      numberIndex: m.index,
      numberEnd: m.index + m[1].length
    };
  }

  function fmt(n) {
    const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
    return String(rounded).replace('.', ',');
  }

  function scaleLine(line, multiplier) {
    const p = parseIngredient(line);
    if (!p) return line;
    return line.slice(0, p.numberIndex) + fmt(p.value * multiplier) + line.slice(p.numberEnd);
  }

  function isCalculable(item) {
    return /(настой|кордиал|заготовк)/i.test(`${item.category} ${item.subcategory}`) &&
      item.ingredients.some(parseIngredient);
  }

  function ensureRecipeLightbox() {
    let box = document.getElementById('recipeLightbox');
    if (box) return box;

    box = document.createElement('div');
    box.id = 'recipeLightbox';
    box.className = 'recipeLightbox';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = `
      <button class="recipeLightboxClose" type="button" aria-label="Закрыть">×</button>
      <img class="recipeLightboxImg" alt="">
    `;
    document.body.appendChild(box);

    const close = () => {
      box.classList.remove('open');
      box.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('recipeLightboxOpen');
      const img = box.querySelector('.recipeLightboxImg');
      img.removeAttribute('src');
      img.alt = '';
    };

    box.querySelector('.recipeLightboxClose').addEventListener('click', close);
    box.addEventListener('click', e => { if (e.target === box) close(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && box.classList.contains('open')) close();
    });
    return box;
  }

  function openRecipeLightbox(src, alt = '') {
    if (!src) return;
    const box = ensureRecipeLightbox();
    const img = box.querySelector('.recipeLightboxImg');
    img.src = src;
    img.alt = alt;
    box.classList.add('open');
    box.setAttribute('aria-hidden', 'false');
    document.body.classList.add('recipeLightboxOpen');
  }

  function attachRecipePhoto(root) {
    const img = root.querySelector('[data-recipe-photo]');
    if (!img) return;
    img.addEventListener('click', () => openRecipeLightbox(img.currentSrc || img.src, img.alt || ''));
    img.addEventListener('error', () => {
      const wrap = img.closest('.recipeHeroPhotoWrap');
      if (wrap) wrap.remove();
    }, { once: true });
  }

  function tagHtml(tags) {
    const words = tagWords(tags);
    if (!words.length) return '';
    return `<div class="recipeTags">${words.map((tag, i) =>
      `<span class="recipeTag tone-${i % 3}">${esc(tag)}</span>`
    ).join('')}</div>`;
  }

  window.searchRecipes = async function searchRecipesR36(query) {
    const q = clean(query).toLowerCase();
    if (!q) return [];

    const data = await window.loadMenu();

    return data
      .filter(x =>
        `${x.name} ${x.category} ${categoryLabel(x.category)} ${x.subcategory} ${x.desc} ${x.ingredients.join(' ')} ${x.tags.join(' ')}`
          .toLowerCase()
          .includes(q)
      )
      .sort((a,b) => {
        const byArchive = Number(isArchive(a)) - Number(isArchive(b));
        if (byArchive !== 0) return byArchive;
        return a.name.localeCompare(b.name, 'ru');
      })
      .slice(0, 8)
      .map(x => ({
        type: 'recipe',
        id: x.id,
        title: x.name,
        category: categoryLabel(x.category) || 'Меню',
        archived: isArchive(x)
      }));
  };

  function dataStatusHtml() {
    if (state.menuSource === 'cache-offline') {
      const syncTime = state.menuSyncedAt
        ? new Date(state.menuSyncedAt).toLocaleString('ru-RU', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
        : '';
      return `<div class="recipeDataStatus">${syncTime
        ? `Нет связи с сервером · сохранённая версия от ${esc(syncTime)}`
        : 'Нет связи с сервером · показана сохранённая версия'}</div>`;
    }
    if (state.menuSource === 'local') {
      return `<div class="recipeDataStatus">Сервер и сохранённая версия недоступны · показаны резервные данные</div>`;
    }
    return '';
  }

  function setRecipeQuery(id, { replace = false } = {}) {
    const url = new URL(location.href);
    if (id) url.searchParams.set('recipe', id);
    else url.searchParams.delete('recipe');
    const method = replace ? 'replaceState' : 'pushState';
    history[method]({ ...(history.state || {}), bfRecipe: id || null }, '', url);
  }

  function currentRecipeQuery() {
    return new URL(location.href).searchParams.get('recipe');
  }

  function clearRecipeQuery({ replace = true } = {}) {
    if (!currentRecipeQuery()) return;
    setRecipeQuery(null, { replace });
  }

  function returnToMenu() {
    clearRecipeQuery({ replace: true });
    if ((location.hash || '#/').slice(1) !== '/menu') {
      location.hash = '/menu';
      return;
    }
    window.menu();
  }

  function calculatorHtml(item) {
    if (!isCalculable(item)) return '';
    return `
      <section class="recipeCalc" id="recipeCalc">
        <h3>Масштабирование</h3>
        <p>Меняет только количество. Текст ингредиента остаётся как в техкарте.</p>
        <div class="recipePortionControl">
          <button class="btn" id="portionMinus" type="button" aria-label="Уменьшить порции">−</button>
          <input class="search" id="calcPortions" type="text" inputmode="decimal" autocomplete="off" value="1" aria-label="Количество порций">
          <button class="btn" id="portionPlus" type="button" aria-label="Увеличить порции">+</button>
        </div>
        <div class="scaledRecipe" id="scaledRecipe"></div>
      </section>
    `;
  }

  function attachCalculator(item) {
    if (!isCalculable(item)) return;
    const input = document.getElementById('calcPortions');
    const out = document.getElementById('scaledRecipe');
    const minus = document.getElementById('portionMinus');
    const plus = document.getElementById('portionPlus');
    if (!input || !out) return;

    const parse = raw => {
      const n = Number(String(raw ?? '').trim().replace(',', '.'));
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };

    const render = () => {
      const portions = parse(input.value);
      out.innerHTML = item.ingredients
        .map(line => `<div class="recipeIngredient">${esc(scaleLine(line, portions))}</div>`)
        .join('');
    };

    input.addEventListener('input', () => {
      let v = input.value.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1');
      input.value = v;
      render();
    });

    const step = delta => {
      const next = Math.max(0, Math.round((parse(input.value) + delta) * 100) / 100);
      input.value = fmt(next);
      render();
    };

    minus.addEventListener('click', () => step(-0.5));
    plus.addEventListener('click', () => step(0.5));
    render();
  }


  async function shareRecipe(item) {
    const url = location.href;
    const title = `${item.name} · BeerFactory`;
    const text = `${item.name} — техкарта BeerFactory`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast('Ссылка на рецепт скопирована');
    } catch (_) {
      const field = document.createElement('textarea');
      field.value = url;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand('copy');
        toast('Ссылка на рецепт скопирована');
      } catch {
        toast('Не удалось скопировать ссылку');
      }
      field.remove();
    }
  }



  async function recipeDetail(id, { replaceInvalid = true } = {}) {
    window.scrollTo(0, 0);
    shell(`<div class="card empty">Загрузка техкарты…</div>`, '/menu');

    const data = await window.loadMenu();
    const item = data.find(x => String(x.id) === String(id));

    if (!item) {
      if (replaceInvalid) setRecipeQuery(null, { replace: true });
      shell(`
        <div class="recipeDetail">
          <div class="recipeDetailTop">
            <button class="recipeBack" id="recipeBack" type="button">← Рецепты</button>
          </div>
          <section class="card cardPad">
            <h1>Рецепт не найден</h1>
            <p style="color:var(--muted)">Возможно, техкарта была переименована или удалена.</p>
          </section>
        </div>
      `, '/menu');
      document.getElementById('recipeBack').onclick = returnToMenu;
      return;
    }

    const metadata = [
      ['Категория', categoryLabel(item.category) || 'Меню'],
      item.subcategory ? ['Подкатегория', item.subcategory] : null,
      item.version ? ['Версия', item.version] : null,
      item.updatedAt ? ['Обновлено', item.updatedAt] : null,
      item.updatedBy ? ['Изменил', item.updatedBy] : null
    ].filter(Boolean);

    shell(`
      <div class="recipeDetail">
        ${isArchive(item) ? `
          <div class="recipeArchiveNotice" role="note">
            <strong>АРХИВ</strong>
            <span>Позиция больше не находится в текущем меню. Рецепт сохранён для истории и справки.</span>
          </div>
        ` : ''}
        <div class="recipeDetailTop">
          <button class="recipeBack" id="recipeBack" type="button">← Рецепты</button>
          <div class="recipeDetailActions">
            <span class="pill">${esc(categoryLabel(item.category) || 'Меню')}</span>
            <button class="recipeShare" id="recipeShare" type="button" aria-label="Поделиться рецептом">↗ <span>Поделиться</span></button>
          </div>
        </div>

        <section class="recipeDetailHero">
          <article class="card recipeDetailIntro">
            <div class="eyebrow">${esc(categoryLabel(item.category) || 'МЕНЮ')}</div>
            <h1>${esc(item.name)}</h1>
            ${item.subcategory ? `<div class="recipeDetailSub">${esc(item.subcategory)}</div>` : ''}
            ${tagHtml(item.tags)}
            ${dataStatusHtml()}
          </article>

          ${item.photo ? `
            <div class="recipeHeroPhotoWrap">
              <img class="recipeHeroPhoto" data-recipe-photo src="${esc(item.photo)}" alt="${esc(item.name)}" loading="eager">
            </div>
          ` : ''}
        </section>

        <section class="recipeDetailGrid">
          <div>
            <article class="card recipeSection">
              <div class="eyebrow">СОСТАВ</div>
              <h2>Техкарта</h2>
              <div class="recipeIngredients">
                ${item.ingredients.length
                  ? item.ingredients.map(v => `<div class="recipeIngredient">${esc(v)}</div>`).join('')
                  : '<div class="recipeIngredient">Состав не заполнен.</div>'}
              </div>
            </article>

            ${isCalculable(item) ? `<article class="card recipeSection">${calculatorHtml(item)}</article>` : ''}

            ${item.method ? `
              <article class="card recipeSection">
                <div class="eyebrow">ПРИГОТОВЛЕНИЕ</div>
                <h2>Метод</h2>
                <div class="recipeText">${esc(item.method)}</div>
              </article>
            ` : ''}

            ${item.serving ? `
              <article class="card recipeSection">
                <div class="eyebrow">ПОДАЧА / ВЫХОД</div>
                <h2>Финал</h2>
                <div class="recipeText">${esc(item.serving)}</div>
              </article>
            ` : ''}
          </div>

          <aside class="recipeSide">
            <article class="card recipeSection">
              <div class="eyebrow">О РЕЦЕПТЕ</div>
              <h2>Данные</h2>
              <div class="recipeMetaList">
                ${metadata.map(([k,v]) => `<div class="recipeMetaLine"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
              </div>
            </article>

            ${item.changeNote ? `
              <article class="card recipeSection">
                <div class="eyebrow">ЧТО ИЗМЕНИЛОСЬ</div>
                <div class="recipeText">${esc(item.changeNote)}</div>
              </article>
            ` : ''}

          </aside>
        </section>
      </div>
    `, '/menu');

    document.getElementById('recipeBack').onclick = returnToMenu;
    const shareBtn = document.getElementById('recipeShare');
    if (shareBtn) shareBtn.onclick = () => shareRecipe(item);
    attachRecipePhoto(document);
    attachCalculator(item);
  }

  window.recipeDetail = recipeDetail;

  window.menu = async function menuR40() {
    const deepId = currentRecipeQuery();
    if (deepId) {
      await recipeDetail(deepId);
      return;
    }

    shell(`
      <div class="pageTitle">
        <div class="eyebrow">РЕЦЕПТЫ · NOCODB</div>
        <h1>Рецепты</h1>
        <p>Найди позицию и открой полноценную техкарту. Поиск работает по названию, категории, составу и тегам.</p>
        <input class="search" id="menuSearch" placeholder="Название, ингредиент, категория..." value="${esc(viewState.query)}">
        <div id="menuDataStatus"></div>
      </div>

      <div class="rail" id="menuCats"></div>
      <div class="recipeBrowseMeta"><span id="recipeResultCount"></span></div>

      <section class="section">
        <div class="recipeList" id="menuList">
          <div class="card empty">Загрузка рецептов…</div>
        </div>
      </section>
    `, '/menu');

    const data = await window.loadMenu();

    const status = document.getElementById('menuDataStatus');
    status.innerHTML = dataStatusHtml();

    const activeCategories = [...new Set(
      data.filter(x => !isArchive(x)).map(x => x.category).filter(Boolean)
    )];
    const hasArchive = data.some(isArchive);
    const cats = ['Все', ...activeCategories, ...(hasArchive ? ['Архив'] : [])];
    if (!cats.includes(viewState.category)) viewState.category = 'Все';

    document.getElementById('menuCats').innerHTML = cats
      .map(x => `<button class="chip ${x === viewState.category ? 'active' : ''}" data-cat="${esc(x)}">${esc(categoryLabel(x))}</button>`)
      .join('');

    const renderList = () => {
      const q = viewState.query.toLowerCase().trim();
      const filtered = data.filter(x => {
        const archived = isArchive(x);

        const categoryMatch =
          viewState.category === 'Архив'
            ? archived
            : viewState.category === 'Все'
              ? (q ? true : !archived)
              : (!archived && x.category === viewState.category);

        if (!categoryMatch) return false;

        return `${x.name} ${x.category} ${categoryLabel(x.category)} ${x.subcategory} ${x.desc} ${x.ingredients.join(' ')} ${x.tags.join(' ')}`
          .toLowerCase()
          .includes(q);
      });

      // Search from "Все" intentionally includes archive matches, but archived
      // positions never pollute the ordinary browse list without a query.
      filtered.sort((a, b) => {
        if (q && viewState.category === 'Все') {
          const byArchive = Number(isArchive(a)) - Number(isArchive(b));
          if (byArchive !== 0) return byArchive;
        }
        return a.name.localeCompare(b.name, 'ru');
      });

      const count = document.getElementById('recipeResultCount');
      if (count) {
        const archiveCount = filtered.filter(isArchive).length;
        count.textContent = q && archiveCount
          ? `Найдено: ${filtered.length} · архив: ${archiveCount}`
          : `Найдено: ${filtered.length}`;
      }

      const list = document.getElementById('menuList');
      list.innerHTML = filtered.map(x => `
        <article class="card recipeRow ${isArchive(x) ? 'recipeRowArchive' : ''}" data-recipe-id="${esc(x.id)}" tabindex="0" role="link" aria-label="Открыть рецепт ${esc(x.name)}${isArchive(x) ? ', архив' : ''}">
          <div class="recipeRowBody">
            <div class="recipeRowCategory">${esc(categoryLabel(x.category) || 'Меню')}${isArchive(x) ? ' · АРХИВ' : ''}</div>
            <h3>${esc(x.name)}</h3>
            <div class="recipeRowMeta">${isArchive(x) ? '<span class="recipeArchiveTag">Архив</span>' : ''}${tagHtml(x.tags)}</div>
          </div>
          <div class="recipeRowArrow" aria-hidden="true">›</div>
        </article>
      `).join('') || '<div class="card empty">Ничего не найдено.</div>';

      list.querySelectorAll('[data-recipe-id]').forEach(row => {
        const open = () => {
          viewState.scrollY = window.scrollY;
          const id = row.dataset.recipeId;
          setRecipeQuery(id);
          recipeDetail(id, { replaceInvalid: false });
        };
        row.addEventListener('click', open);
        row.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        });
      });
    };

    const search = document.getElementById('menuSearch');
    search.oninput = () => {
      viewState.query = search.value.trim();
      renderList();
    };

    document.querySelectorAll('[data-cat]').forEach(b => {
      b.onclick = () => {
        viewState.category = b.dataset.cat;
        document.querySelectorAll('[data-cat]').forEach(x => x.classList.toggle('active', x === b));
        renderList();
      };
    });

    renderList();

    if (viewState.scrollY > 0) {
      requestAnimationFrame(() => window.scrollTo(0, viewState.scrollY));
    }
  };


  if (!window._bfRecipeNavGuardBound) {
    window._bfRecipeNavGuardBound = true;
    document.addEventListener('click', event => {
      const link = event.target.closest?.('a[href^="#/"]');
      if (!link || !currentRecipeQuery()) return;

      const targetPath = String(link.getAttribute('href') || '').slice(1) || '/';
      clearRecipeQuery({ replace: true });

      if (targetPath === '/menu') {
        event.preventDefault();
        if ((location.hash || '#/').slice(1) !== '/menu') {
          location.hash = '/menu';
        } else {
          window.menu();
        }
      }
    }, true);
  }

  if (!window._bfRecipePopstateBound) {
    window._bfRecipePopstateBound = true;
    window.addEventListener('popstate', () => {
      if ((location.hash || '#/').slice(1) !== '/menu') return;
      const id = currentRecipeQuery();
      if (id) recipeDetail(id);
      else window.menu();
    });
  }
})();
