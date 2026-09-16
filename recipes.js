(() => {
  const STYLE_ID = 'bf-recipes-r12-style';
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      .recipePhoto{width:100%;max-height:260px;object-fit:cover;border-radius:14px;margin:12px 0}
      .recipeMethod,.recipeServing{margin-top:14px;color:var(--muted);white-space:pre-wrap}
      .recipeIngredients{display:grid;gap:7px;margin-top:10px}
      .recipeIngredient{padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.035)}
      .recipeCalc{margin-top:16px;padding:14px;border:1px solid rgba(223,139,78,.24);border-radius:14px;background:rgba(189,99,49,.07)}
      .recipeCalc h4{margin:0 0 10px}.recipeCalcGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .recipeCalc label{font-size:11px;color:var(--muted);display:grid;gap:5px}
      .recipeCalc select{width:100%;min-height:46px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.055);color:var(--cream);border-radius:14px;padding:10px 12px}
      .recipeCalcActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .scaledRecipe{display:grid;gap:7px;margin-top:12px}
      .scaledRecipe .recipeIngredient{border-color:rgba(199,160,75,.22)}
      .sourceBadge{font-size:10px;color:var(--dim)}
      @media(max-width:600px){.recipeCalcGrid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  const clean = v => String(v ?? '').trim();
  const lines = v => clean(v).split(/\n|·/).map(x => x.trim()).filter(Boolean);

  const get = (row, ...keys) => {
    for (const k of keys) if (row && row[k] != null && clean(row[k]) !== '') return row[k];
    return '';
  };

  function normalizeRow(row, fallbackCategory = 'Меню') {
    const category = clean(get(row, 'category', 'Category', 'Категория', 'cat')) || fallbackCategory;
    const subcategory = clean(get(row, 'subcategory', 'Subcategory', 'Подкатегория', 'subcat'));
    const compound = get(row, 'ingredients', 'Ingredients', 'Состав', 'compound');
    const method = get(row, 'method', 'Method', 'Метод', 'Приготовление', 'Описание');
    const serving = get(row, 'serving', 'Serving', 'Подача', 'Граммовка', 'Вес');
    const tagsRaw = get(row, 'tags', 'Tags', 'Теги');
    const ingredientLines = Array.isArray(compound) ? compound.map(clean).filter(Boolean) : lines(compound);

    return {
      id: clean(get(row, 'id', 'Id', 'ID', '_id')) || crypto.randomUUID(),
      name: clean(get(row, 'name', 'Name', 'Название', 'Title')) || 'Без названия',
      category,
      subcategory,
      desc: clean(get(row, 'desc', 'description', 'Description', 'Описание')) || clean(method) || 'Открыть техкарту',
      ingredients: ingredientLines,
      method: clean(method),
      serving: clean(serving),
      photo: clean(get(row, 'photo', 'Photo', 'Фото-ссылка', 'Фото')),
      tags: Array.isArray(tagsRaw) ? tagsRaw : clean(tagsRaw).split(/\s+/).filter(Boolean)
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

  window.loadMenu = async function loadMenuR12() {
    if (state.menuSchemaVersion === 12 && Array.isArray(state.menu) && state.menu.length) return state.menu;

    try {
      const r = await fetch(API_BASE + '/menu', {
        signal: AbortSignal.timeout(7000),
        cache: 'no-store'
      });
      if (!r.ok) throw new Error('menu_http_' + r.status);

      const d = await r.json();
      const rows = rowsFromPayload(d);
      if (!rows.length) throw new Error('menu_empty');

      state.menu = rows;
      state.menuSource = 'api';
      state.menuSchemaVersion = 12;
      save();
      return rows;
    } catch (e) {
      console.warn('BeerFactory recipes API unavailable:', e);

      const fallback = (typeof localMenu === 'function' ? localMenu() : []).map(x => normalizeRow(x));
      state.menu = fallback;
      state.menuSource = 'local';
      state.menuSchemaVersion = 12;
      save();
      return fallback;
    }
  };

  const UNIT_RX = /(мл|л|гр|г|кг|шт|порц(?:ия|ии|ий)?|порц|ст\.л|ч\.л|уп|кап(?:ля|ли|ель)|дэш(?:а|ей)?|dash(?:es)?)/i;

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

  function targetUnits(parsed) {
    if (!parsed) return [];
    if (parsed.info.group === 'volume') return [{v:'мл',f:1},{v:'л',f:1000}];
    if (parsed.info.group === 'mass') return [{v:'г',f:1},{v:'кг',f:1000}];
    return [{v:parsed.unit,f:1}];
  }

  function calculatorHtml(item, idx) {
    if (!isCalculable(item)) return '';

    const parsed = item.ingredients
      .map((line, i) => ({line, i, p:parseIngredient(line)}))
      .filter(x => x.p);

    const first = parsed[0];

    return `<div class="recipeCalc" data-calc="${idx}">
      <h4>Калькулятор рецепта</h4>

      <div class="recipeCalcGrid">
        <label>
          Коэффициент
          <input class="search calcMultiplier" type="number" min="0.01" step="0.1" value="1">
        </label>

        <label>
          Или базовый ингредиент
          <select class="calcBase">
            ${parsed.map(x =>
              `<option value="${x.i}">${esc(x.p.label)} · ${esc(x.p.valueText)} ${esc(x.p.unit)}</option>`
            ).join('')}
          </select>
        </label>

        <label>
          Нужное количество
          <input class="search calcTarget" type="number" min="0.01" step="0.01" placeholder="Например: 750">
        </label>

        <label>
          Единица
          <select class="calcTargetUnit">
            ${targetUnits(first?.p).map(u => `<option value="${u.f}">${esc(u.v)}</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="recipeCalcActions">
        <button class="btn primary calcByBase" type="button">Рассчитать по ингредиенту</button>
        <button class="btn calcReset" type="button">Сбросить</button>
      </div>

      <div class="scaledRecipe"></div>
    </div>`;
  }

  function attachCalculator(card, item, idx) {
    const calc = card.querySelector(`[data-calc="${idx}"]`);
    if (!calc) return;

    const out = calc.querySelector('.scaledRecipe');
    const multInput = calc.querySelector('.calcMultiplier');
    const baseSelect = calc.querySelector('.calcBase');
    const targetInput = calc.querySelector('.calcTarget');
    const unitSelect = calc.querySelector('.calcTargetUnit');

    const parsedAt = i => parseIngredient(item.ingredients[Number(i)] || '');

    const renderScaled = multiplier => {
      const m = Math.max(0.01, Number(multiplier) || 1);
      multInput.value = String(Math.round(m * 10000) / 10000);

      out.innerHTML = item.ingredients
        .map(line => `<div class="recipeIngredient">${esc(scaleLine(line, m))}</div>`)
        .join('');
    };

    const refreshUnits = () => {
      const p = parsedAt(baseSelect.value);
      unitSelect.innerHTML = targetUnits(p)
        .map(u => `<option value="${u.f}">${esc(u.v)}</option>`)
        .join('');
    };

    multInput.addEventListener('input', () => renderScaled(multInput.value));
    baseSelect.addEventListener('change', refreshUnits);

    calc.querySelector('.calcByBase').onclick = () => {
      const p = parsedAt(baseSelect.value);
      const target = Number(String(targetInput.value).replace(',', '.'));
      const targetFactor = Number(unitSelect.value) || 1;

      if (!p || !Number.isFinite(target) || target <= 0) {
        return toast('Введите нужное количество');
      }

      const multiplier = (target * targetFactor) / (p.value * p.info.factor);
      renderScaled(multiplier);
    };

    calc.querySelector('.calcReset').onclick = () => {
      targetInput.value = '';
      renderScaled(1);
    };

    refreshUnits();
    renderScaled(1);
  }

  window.menu = async function menuR12() {
    shell(`<div class="pageTitle">
      <div class="eyebrow">РЕЦЕПТЫ · NOCODB</div>
      <h1>Рецепты</h1>
      <p>Поиск по названию, категории и составу. Для настоек, кордиалов и заготовок доступен пересчёт.</p>
      <input class="search" id="menuSearch" placeholder="Поиск по рецептам...">
    </div>

    <div class="rail" id="menuCats"></div>

    <section class="section">
      <div class="menuGrid" id="menuList">
        <div class="card empty">Загрузка рецептов…</div>
      </div>
    </section>`, '/menu');

    const data = await window.loadMenu();
    let cat = 'Все';

    const cats = ['Все', ...new Set(data.map(x => x.category).filter(Boolean))];

    document.getElementById('menuCats').innerHTML = cats
      .map((x,i) => `<button class="chip ${i===0?'active':''}" data-cat="${esc(x)}">${esc(x)}</button>`)
      .join('');

    const renderList = () => {
      const q = document.getElementById('menuSearch').value.toLowerCase().trim();

      const filtered = data.filter(x =>
        (cat === 'Все' || x.category === cat) &&
        `${x.name} ${x.category} ${x.subcategory} ${x.desc} ${x.ingredients.join(' ')} ${x.tags.join(' ')}`
          .toLowerCase()
          .includes(q)
      );

      const list = document.getElementById('menuList');

      list.innerHTML = filtered.map((x,i) => `<article class="card item" data-recipe-card="${i}">
        <div class="meta">
          <span>${esc(x.category || 'Меню')}</span>
          ${x.subcategory ? `<span>•</span><span>${esc(x.subcategory)}</span>` : ''}
          <span>•</span>
          <span class="sourceBadge">${state.menuSource === 'api' ? 'NocoDB через Worker' : 'локальный резерв'}</span>
        </div>

        <h3>${esc(x.name)}</h3>
        <p>${esc(x.desc)}</p>

        <button class="btn" data-open="${i}">Открыть техкарту</button>

        <div class="detail" id="detail-${i}">
          ${x.photo ? `<img class="recipePhoto" src="${esc(x.photo)}" alt="${esc(x.name)}">` : ''}

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
      </article>`).join('') || '<div class="card empty">Ничего не найдено.</div>';

      list.querySelectorAll('[data-open]').forEach(b => {
        b.onclick = () => document.getElementById('detail-' + b.dataset.open).classList.toggle('open');
      });

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
