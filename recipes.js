(() => {
  const STYLE_ID = 'bf-recipes-r19-style';
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      .recipePhotoWrap{width:100%;height:210px;margin:12px 0;border-radius:14px;background:rgba(255,255,255,.025);display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:zoom-in}
      .recipePhoto{display:block;width:100%;height:100%;object-fit:contain;border-radius:14px}
      .recipeLightbox{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:max(24px,env(safe-area-inset-top)) 18px max(24px,env(safe-area-inset-bottom));opacity:0;visibility:hidden;pointer-events:none;transition:opacity .18s ease,visibility .18s ease}
      .recipeLightbox.open{opacity:1;visibility:visible;pointer-events:auto}
      .recipeLightboxImg{display:block;max-width:min(94vw,1200px);max-height:90vh;width:auto;height:auto;object-fit:contain;border-radius:14px;box-shadow:0 20px 70px rgba(0,0,0,.45)}
      .recipeLightboxClose{position:fixed;top:max(14px,env(safe-area-inset-top));right:14px;width:44px;height:44px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(20,16,13,.76);color:#fff;font-size:28px;line-height:1;display:grid;place-items:center;cursor:pointer;-webkit-tap-highlight-color:transparent}
      body.recipeLightboxOpen{overflow:hidden}
      .recipeMethod,.recipeServing{margin-top:14px;color:var(--muted);white-space:pre-wrap}
      .recipeIngredients{display:grid;gap:7px;margin-top:10px}
      .recipeIngredient{padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.035)}
      .recipeCalc{margin-top:16px;padding:14px;border:1px solid rgba(223,139,78,.24);border-radius:14px;background:rgba(189,99,49,.07)}
      .recipeCalc h4{margin:0 0 10px}.recipeCalcGrid{display:grid;grid-template-columns:1fr;gap:9px}
      .recipeCalc label{font-size:11px;color:var(--muted);display:grid;gap:5px}
      .scaledRecipe{display:grid;gap:7px;margin-top:12px}
      .scaledRecipe .recipeIngredient{border-color:rgba(199,160,75,.22)}
      
      .recipeCategory{font-size:14px;font-weight:800;letter-spacing:.02em;color:var(--cream);margin-bottom:8px}
      .recipeTags{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0 2px}
      .recipeTag{display:inline-flex;align-items:center;min-height:28px;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:800;line-height:1;border:1px solid transparent}
      .recipeTag.tone-0{color:#91d9a3;background:rgba(60,150,83,.13);border-color:rgba(82,183,106,.28)}
      .recipeTag.tone-1{color:#e4bd64;background:rgba(194,145,41,.13);border-color:rgba(220,168,53,.28)}
      .recipeTag.tone-2{color:#ef8f82;background:rgba(187,61,47,.13);border-color:rgba(216,77,62,.28)}
      .recipeFlipCard{perspective:1400px;cursor:pointer;touch-action:manipulation}
      .recipeFlipInner{position:relative;transform-style:preserve-3d;transition:transform .52s cubic-bezier(.2,.7,.2,1),height .34s ease}
      .recipeFlipCard.flipped .recipeFlipInner{transform:rotateY(180deg)}
      .recipeFace{position:absolute;inset:0 auto auto 0;width:100%;backface-visibility:hidden;-webkit-backface-visibility:hidden}
      .recipeFront{height:155px;box-sizing:border-box;padding:12px;display:flex;flex-direction:column}
      .recipeFront .recipeCategory{font-size:12px;margin-bottom:5px;flex-shrink:0}
      .recipeFront h3{margin:0;font-size:18px;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex-shrink:0}
      .recipeFront .recipeTags{gap:4px;margin:6px 0 0;min-height:0;max-height:48px;overflow:hidden;align-content:flex-start}
      .recipeFront .recipeTag{min-height:20px;padding:3px 7px;font-size:11px;flex-shrink:0;box-sizing:border-box}
      .recipeBack{position:absolute;top:0;left:0;width:100%;transform:rotateY(180deg);pointer-events:none}
      .recipeFlipCard.flipped .recipeFront{pointer-events:none}
      .recipeFlipCard.flipped .recipeBack{pointer-events:auto}
      .recipeFace.card{margin:0}
      .recipeBack .detail{display:block!important}
      .recipeTapHint{margin-top:auto;padding-top:6px;font-size:10px;line-height:1.2;flex-shrink:0;color:var(--dim)}
      .recipeDataStatus{margin-top:10px;padding:9px 11px;border-radius:12px;border:1px solid rgba(199,160,75,.26);background:rgba(199,160,75,.08);color:var(--muted);font-size:11px;line-height:1.35}

      @media(max-width:600px){.recipeCalcGrid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  const clean = v => String(v ?? '').trim();
  const categoryLabel = value => /^лимонад$/i.test(clean(value)) ? 'Б/А напитки' : clean(value);
  const tagWords = value => (Array.isArray(value) ? value : [value])
    .flatMap(part => clean(part).split(/[\s,;|·]+/u)).filter(Boolean);
  const lines = v => clean(v).split(/\n|·/).map(x => x.trim()).filter(Boolean);

  const get = (row, ...keys) => {
    for (const k of keys) if (row && row[k] != null && clean(row[k]) !== '') return row[k];
    return '';
  };

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

    box.addEventListener('click', e => {
      if (e.target === box) close();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && box.classList.contains('open')) close();
    });

    box._closeRecipeLightbox = close;
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

  function attachRecipePhotos(root) {
    root.querySelectorAll('[data-recipe-photo]').forEach(img => {
      img.addEventListener('click', () => {
        openRecipeLightbox(img.currentSrc || img.src, img.alt || '');
      });
      img.addEventListener('error', () => {
        const wrap = img.closest('.recipePhotoWrap');
        if (wrap) wrap.remove();
      }, { once: true });
    });
  }

  function makeRecipeId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const h = [...bytes].map(v => v.toString(16).padStart(2, '0')).join('');
      return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
    }
    return `bf-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeRow(row, fallbackCategory = 'Меню') {
    const category = clean(get(row, 'category', 'Category', 'Категория', 'cat')) || fallbackCategory;
    const subcategory = clean(get(row, 'subcategory', 'Subcategory', 'Подкатегория', 'subcat'));
    const compound = get(row, 'ingredients', 'Ingredients', 'Состав', 'compound');
    const method = get(row, 'method', 'Method', 'Метод', 'Приготовление', 'Описание');
    const serving = get(row, 'serving', 'Serving', 'Подача', 'Граммовка', 'Вес');
    const tagsRaw = get(row, 'tags', 'Tags', 'Теги');
    const ingredientLines = Array.isArray(compound) ? compound.map(clean).filter(Boolean) : lines(compound);

    return {
      id: clean(get(row, 'id', 'Id', 'ID', '_id')) || makeRecipeId(),
      name: clean(get(row, 'name', 'Name', 'Название', 'Title')) || 'Без названия',
      category,
      subcategory,
      desc: clean(get(row, 'desc', 'description', 'Description', 'Описание')) || clean(method) || 'Открыть техкарту',
      ingredients: ingredientLines,
      method: clean(method),
      serving: clean(serving),
      photo: clean(get(row, 'photo', 'Photo', 'Фото-ссылка', 'Фото')),
      tags: tagWords(tagsRaw)
    };
  }

  function rowsFromPayload(d) {
    if (Array.isArray(d)) return d.map(x => normalizeRow(x));
    if (Array.isArray(d?.recipes)) return d.recipes.map(x => normalizeRow(x));

    const out = [];
    for (const [key, fallback] of [
      ['bar','Бар'],
      ['kitchen','Кухня'],
      ['preparations','Заготовки'],
      ['infusions','Настойки'],
      ['cordials','Кордиалы']
    ]) {
      if (Array.isArray(d?.[key])) out.push(...d[key].map(x => normalizeRow(x, fallback)));
    }
    return out;
  }

  const MENU_SCHEMA_VERSION = 19;
  const MENU_FRESH_MS = 5 * 60 * 1000;

  function cachedMenu() {
    if (!Array.isArray(state.menu) || !state.menu.length) return [];
    if (![17, 18, MENU_SCHEMA_VERSION].includes(Number(state.menuSchemaVersion))) return [];
    return state.menu.map(x => normalizeRow(x));
  }

  function setMenuState(rows, source, syncedAt = state.menuSyncedAt || null) {
    state.menu = rows;
    state.menuSource = source;
    state.menuSchemaVersion = MENU_SCHEMA_VERSION;
    state.menuSyncedAt = syncedAt;
    save();
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

  window.loadMenu = async function loadMenuR19() {
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
      const r = await fetchWithTimeout(API_BASE + '/menu', {
        cache: 'no-store'
      }, timeoutMs);
      if (!r.ok) throw new Error('menu_http_' + r.status);

      const d = await r.json();
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

  function unitInfo(raw) {
    const u = clean(raw).toLowerCase().replace(/\.$/, '');
    if (u === 'мл') return {group:'volume', factor:1, label:'мл'};
    if (u === 'л') return {group:'volume', factor:1000, label:'л'};
    if (u === 'г' || u === 'гр') return {group:'mass', factor:1, label:u};
    if (u === 'кг') return {group:'mass', factor:1000, label:'кг'};
    if (u.startsWith('порц')) return {group:'portion', factor:1, label:raw};
    if (u === 'шт') return {group:'count', factor:1, label:'шт'};
    return {group:'other', factor:1, label:raw};
  }

  function parseIngredient(line) {
    const re = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_RX.source})\\.?`, 'i');
    const m = String(line).match(re);
    if (!m) return null;

    const numberIndex = m.index;
    const valueText = m[1];
    const unit = m[2];
    const value = Number(valueText.replace(',', '.'));
    if (!Number.isFinite(value)) return null;

    const before = line.slice(0, numberIndex).trim().replace(/[—–:-]+$/,'').trim();
    const after = line.slice(numberIndex + m[0].length).trim().replace(/^[—–:-]+/,'').trim();

    return {
      original: line,
      value,
      valueText,
      unit,
      info: unitInfo(unit),
      numberIndex,
      numberEnd: numberIndex + valueText.length,
      label: before || after || line
    };
  }

  function fmt(n) {
    const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
    return String(rounded).replace('.', ',');
  }

  function scaleLine(line, multiplier) {
    const p = parseIngredient(line);
    if (!p) return line;

    return line.slice(0, p.numberIndex) +
      fmt(p.value * multiplier) +
      line.slice(p.numberEnd);
  }

  function isCalculable(item) {
    return /(настой|кордиал|заготовк)/i.test(`${item.category} ${item.subcategory}`) &&
      item.ingredients.some(parseIngredient);
  }


  function calculatorHtml(item, idx) {
    if (!isCalculable(item)) return '';

    return `<div class="recipeCalc" data-calc="${idx}">
      <h4>Калькулятор рецепта</h4>

      <div class="recipeCalcGrid">
        <label>
          Порции
          <input
            class="search calcPortions"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            value="1"
            placeholder="Например: 0,5 или 4,5"
          >
        </label>
      </div>

      <div class="scaledRecipe"></div>
    </div>`;
  }

  function attachCalculator(card, item, idx) {
    const calc = card.querySelector(`[data-calc="${idx}"]`);
    if (!calc) return;

    const out = calc.querySelector('.scaledRecipe');
    const portionsInput = calc.querySelector('.calcPortions');

    const parsePortions = raw => {
      const normalized = String(raw ?? '')
        .trim()
        .replace(',', '.');

      if (normalized === '') return 0;

      const n = Number(normalized);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };

    const renderScaled = rawValue => {
      const portions = parsePortions(rawValue);

      out.innerHTML = item.ingredients
        .map(line => `<div class="recipeIngredient">${esc(scaleLine(line, portions))}</div>`)
        .join('');

      requestAnimationFrame(() => card._syncRecipeHeight?.());
    };

    portionsInput.addEventListener('input', () => {
      // Разрешаем только цифры и один десятичный разделитель.
      let v = portionsInput.value
        .replace(/[^\d.,]/g, '')
        .replace(/([.,].*)[.,]/g, '$1');

      portionsInput.value = v;
      renderScaled(v);
    });

    renderScaled(portionsInput.value);
  }

  window.menu = async function menuR19() {
    shell(`<div class="pageTitle">
      <div class="eyebrow">РЕЦЕПТЫ · NOCODB</div>
      <h1>Рецепты</h1>
      <p>Поиск по названию, категории и составу. Для настоек, кордиалов и заготовок доступен пересчёт.</p>
      <input class="search" id="menuSearch" placeholder="Поиск по рецептам...">
      <div id="menuDataStatus" class="recipeDataStatus" hidden></div>
    </div>

    <div class="rail" id="menuCats"></div>

    <section class="section">
      <div class="menuGrid" id="menuList">
        <div class="card empty">Загрузка рецептов…</div>
      </div>
    </section>`, '/menu');

    const data = await window.loadMenu();

    const dataStatus = document.getElementById('menuDataStatus');
    if (dataStatus && state.menuSource === 'cache-offline') {
      const syncTime = state.menuSyncedAt
        ? new Date(state.menuSyncedAt).toLocaleString('ru-RU', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
        : '';
      dataStatus.hidden = false;
      dataStatus.textContent = syncTime
        ? `Нет связи с сервером · показана сохранённая версия от ${syncTime}`
        : 'Нет связи с сервером · показана сохранённая версия';
    } else if (dataStatus && state.menuSource === 'local') {
      dataStatus.hidden = false;
      dataStatus.textContent = 'Сервер и сохранённая версия недоступны · показаны резервные данные';
    }

    let cat = 'Все';

    const cats = ['Все', ...new Set(data.map(x => x.category).filter(Boolean))];

    document.getElementById('menuCats').innerHTML = cats
      .map((x,i) => `<button class="chip ${i===0?'active':''}" data-cat="${esc(x)}">${esc(categoryLabel(x))}</button>`)
      .join('');

    const renderList = () => {
      const q = document.getElementById('menuSearch').value.toLowerCase().trim();

      const filtered = data.filter(x =>
        (cat === 'Все' || x.category === cat) &&
        `${x.name} ${x.category} ${categoryLabel(x.category)} ${x.subcategory} ${x.desc} ${x.ingredients.join(' ')} ${x.tags.join(' ')}`
          .toLowerCase()
          .includes(q)
      );

      const list = document.getElementById('menuList');

      list.innerHTML = filtered.map((x,i) => {
        const tags = tagWords(x.tags);

        const tagsHtml = tags.length
          ? `<div class="recipeTags">${tags.map((tag, tagIndex) =>
              `<span class="recipeTag tone-${tagIndex % 3}">${esc(tag)}</span>`
            ).join('')}</div>`
          : '';

        return `<article class="recipeFlipCard" data-recipe-card="${i}" tabindex="0" role="button" aria-expanded="false">
          <div class="recipeFlipInner">

            <section class="recipeFace recipeFront card item">
              <div class="recipeCategory">${esc(categoryLabel(x.category) || 'Меню')}</div>

              <h3>${esc(x.name)}</h3>

              ${tagsHtml}

              <div class="recipeTapHint">Тапните по карточке, чтобы открыть техкарту</div>
            </section>

            <section class="recipeFace recipeBack card item">
              <div class="recipeCategory">${esc(categoryLabel(x.category) || 'Меню')}</div>
              <h3>${esc(x.name)}</h3>

              <div class="detail open">
                ${x.photo ? `<div class="recipePhotoWrap"><img class="recipePhoto" data-recipe-photo src="${esc(x.photo)}" alt="${esc(x.name)}" loading="lazy"></div>` : ''}

                <div class="eyebrow">СОСТАВ</div>
                <div class="recipeIngredients">
                  ${x.ingredients.map(v => `<div class="recipeIngredient">${esc(v)}</div>`).join('') ||
                    '<div class="recipeIngredient">Состав не заполнен.</div>'}
                </div>

                ${calculatorHtml(x, i)}

                ${x.method ? `<div class="recipeMethod">
                  <div class="eyebrow">ПРИГОТОВЛЕНИЕ</div>
                  ${esc(x.method)}
                </div>` : ''}

                ${x.serving ? `<div class="recipeServing">
                  <div class="eyebrow">ПОДАЧА / ВЫХОД</div>
                  ${esc(x.serving)}
                </div>` : ''}
              </div>
            </section>

          </div>
        </article>`;
      }).join('') || '<div class="card empty">Ничего не найдено.</div>';

      attachRecipePhotos(list);

      const isInteractiveTarget = target =>
        !!target.closest('input,select,textarea,button,a,[data-recipe-photo],.recipePhotoWrap,.recipeLightbox');

      list.querySelectorAll('[data-recipe-card]').forEach(card => {
        const inner = card.querySelector('.recipeFlipInner');
        const front = card.querySelector('.recipeFront');
        const back = card.querySelector('.recipeBack');

        const syncHeight = flipped => {
          requestAnimationFrame(() => {
            const h = flipped
              ? Math.ceil(back.scrollHeight)
              : Math.ceil(front.offsetHeight);

            inner.style.height = `${Math.max(h, 1)}px`;
          });
        };

        syncHeight(false);

        const toggle = () => {
          const next = !card.classList.contains('flipped');
          syncHeight(next);
          card.classList.toggle('flipped', next);
          card.setAttribute('aria-expanded', String(next));
        };

        card.addEventListener('click', e => {
          if (isInteractiveTarget(e.target)) return;
          toggle();
        });

        card.addEventListener('keydown', e => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          if (isInteractiveTarget(e.target)) return;
          e.preventDefault();
          toggle();
        });

        card._syncRecipeHeight = () => syncHeight(card.classList.contains('flipped'));
      });

      if (window._bfRecipeResizeHandler) {
        window.removeEventListener('resize', window._bfRecipeResizeHandler);
      }
      window._bfRecipeResizeHandler = () => {
        list.querySelectorAll('[data-recipe-card]').forEach(card => card._syncRecipeHeight?.());
      };
      window.addEventListener('resize', window._bfRecipeResizeHandler, { passive: true });

      filtered.forEach((item, i) => {
        const card = list.querySelector(`[data-recipe-card="${i}"]`);
        if (card) attachCalculator(card, item, i);
      });
    };

    document.getElementById('menuSearch').oninput = renderList;

    document.querySelectorAll('[data-cat]').forEach(b => {
      b.onclick = () => {
        cat = b.dataset.cat;
        document.querySelectorAll('[data-cat]').forEach(x => x.classList.toggle('active', x === b));
        renderList();
      };
    });

    renderList();
  };
})();
