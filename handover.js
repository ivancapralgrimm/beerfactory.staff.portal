(() => {
  'use strict';

  const CATEGORY_LABELS = {
    bar: 'Бар',
    kitchen: 'Кухня',
    hall: 'Зал',
    equipment: 'Оборудование',
    purchasing: 'Закупки',
    other: 'Другое'
  };

  const PRIORITY_LABELS = {
    normal: 'Обычная',
    high: 'Важная',
    critical: 'Критичная'
  };

  const STATUS_LABELS = {
    new: 'Новая',
    acknowledged: 'Принята',
    resolved: 'Решена'
  };

  let selectedCategory = 'all';
  let selectedStatus = 'active';

  const escHandover = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const formatTime = value => {
    try {
      return new Date(value).toLocaleString('ru-RU', {
        day:'2-digit',
        month:'2-digit',
        hour:'2-digit',
        minute:'2-digit'
      });
    } catch {
      return String(value || '');
    }
  };

  async function fetchProfiles(ids) {
    const map = new Map();
    const unique = [...new Set((ids || []).filter(Boolean))];
    if (!unique.length) return map;

    const { data, error } = await sb
      .from('profiles')
      .select('id,first_name,last_name,position')
      .in('id', unique);

    if (!error) {
      for (const p of data || []) map.set(p.id, p);
    }
    return map;
  }

  function profileName(id, profiles) {
    const p = profiles.get(id);
    return p ? [p.first_name,p.last_name].filter(Boolean).join(' ') : 'Сотрудник';
  }

  async function loadHandovers() {
    const { data, error } = await sb
      .from('notes')
      .select('id,shift_id,author_id,body,priority,category,status,acknowledged_by,acknowledged_at,resolved_by,resolved_at,created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const rows = data || [];
    const ids = rows.flatMap(x => [x.author_id,x.acknowledged_by,x.resolved_by]).filter(Boolean);
    const profiles = await fetchProfiles(ids);

    rows.sort((a,b) => {
      const rank = { new:0, acknowledged:1, resolved:2 };
      const byStatus = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      if (byStatus !== 0) return byStatus;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return { rows, profiles };
  }

  function visibleRows(rows) {
    return rows.filter(row => {
      const categoryOk = selectedCategory === 'all' || row.category === selectedCategory;
      const statusOk =
        selectedStatus === 'all' ||
        (selectedStatus === 'active' && row.status !== 'resolved') ||
        (selectedStatus === 'resolved' && row.status === 'resolved');
      return categoryOk && statusOk;
    });
  }

  function renderFilters(rows) {
    const cats = ['all',...new Set(rows.map(x => x.category).filter(Boolean))];
    return `
      <div class="handoverFilters">
        <div class="rail handoverRail" id="handoverCategories">
          ${cats.map(key => `
            <button class="chip ${selectedCategory===key?'active':''}" data-handover-category="${escHandover(key)}">
              ${key === 'all' ? 'Все' : escHandover(CATEGORY_LABELS[key] || key)}
            </button>
          `).join('')}
        </div>

        <div class="handoverStatusTabs" role="group" aria-label="Статус передачи">
          ${[
            ['active','Активные'],
            ['resolved','Решённые'],
            ['all','Все']
          ].map(([key,label]) => `
            <button class="handoverStatusTab ${selectedStatus===key?'active':''}" data-handover-status="${key}">
              ${label}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  function noteActions(row) {
    if (row.status === 'resolved') return '';

    const acknowledge = row.status === 'new'
      ? `<button class="btn" data-handover-ack="${escHandover(row.id)}" type="button">Принял</button>`
      : '';

    return `
      <div class="handoverActions">
        ${acknowledge}
        <button class="btn primary" data-handover-resolve="${escHandover(row.id)}" type="button">Решено</button>
      </div>
    `;
  }

  function noteCard(row, profiles) {
    const author = profileName(row.author_id, profiles);
    const ack = row.acknowledged_by ? profileName(row.acknowledged_by, profiles) : '';
    const resolver = row.resolved_by ? profileName(row.resolved_by, profiles) : '';

    const meta = [
      `${author} · ${formatTime(row.created_at)}`,
      row.status === 'acknowledged' && ack ? `Принял: ${ack}` : '',
      row.status === 'resolved' && resolver ? `Решил: ${resolver}` : ''
    ].filter(Boolean);

    return `
      <article class="card handoverItem priority-${escHandover(row.priority)} status-${escHandover(row.status)}">
        <div class="handoverTop">
          <div class="handoverTags">
            <span class="handoverTag category">${escHandover(CATEGORY_LABELS[row.category] || 'Другое')}</span>
            <span class="handoverTag priority ${escHandover(row.priority)}">${escHandover(PRIORITY_LABELS[row.priority] || row.priority)}</span>
          </div>
          <span class="handoverStatus ${escHandover(row.status)}">${escHandover(STATUS_LABELS[row.status] || row.status)}</span>
        </div>

        <p class="handoverBody">${escHandover(row.body)}</p>

        <div class="handoverMeta">
          ${meta.map(x => `<span>${escHandover(x)}</span>`).join('')}
        </div>

        ${noteActions(row)}
      </article>
    `;
  }

  async function acknowledge(id) {
    const { error } = await sb.rpc('acknowledge_handover', { p_note_id: id });
    if (error) throw error;
  }

  async function resolve(id) {
    const { error } = await sb.rpc('resolve_handover', { p_note_id: id });
    if (error) throw error;
  }

  async function createHandover() {
    const body = document.getElementById('handoverBody')?.value.trim();
    const category = document.getElementById('handoverCategory')?.value || 'other';
    const priority = document.getElementById('handoverPriority')?.value || 'normal';

    if (!body) {
      toast('Напиши, что нужно передать следующей смене');
      return;
    }

    const button = document.getElementById('handoverSubmit');
    if (button) {
      button.disabled = true;
      button.textContent = 'Сохраняем…';
    }

    try {
      const { error } = await sb.from('notes').insert({
        author_id: currentUser.id,
        body,
        category,
        priority
      });

      if (error) throw error;

      toast('Передача добавлена');
      await window.notes();
    } catch (error) {
      console.error('BeerFactory handover create:', error);
      toast('Не удалось сохранить передачу');
      if (button) {
        button.disabled = false;
        button.textContent = 'Добавить';
      }
    }
  }

  async function renderList(rows, profiles) {
    const host = document.getElementById('handoverList');
    const count = document.getElementById('handoverCount');
    if (!host) return;

    const filtered = visibleRows(rows);
    if (count) count.textContent = String(filtered.length);

    host.innerHTML = filtered.length
      ? filtered.map(row => noteCard(row, profiles)).join('')
      : '<div class="card empty">Здесь пока ничего нет.</div>';

    host.querySelectorAll('[data-handover-ack]').forEach(button => {
      button.onclick = async () => {
        button.disabled = true;
        try {
          await acknowledge(button.dataset.handoverAck);
          toast('Передача принята');
          await window.notes();
        } catch (error) {
          console.error('BeerFactory handover acknowledge:', error);
          toast('Не удалось подтвердить');
          button.disabled = false;
        }
      };
    });

    host.querySelectorAll('[data-handover-resolve]').forEach(button => {
      button.onclick = async () => {
        button.disabled = true;
        try {
          await resolve(button.dataset.handoverResolve);
          toast('Отмечено как решённое');
          await window.notes();
        } catch (error) {
          console.error('BeerFactory handover resolve:', error);
          toast('Не удалось закрыть передачу');
          button.disabled = false;
        }
      };
    });
  }

  window.notes = async function handoverR32() {
    window.scrollTo(0,0);

    shell(`
      <div class="pageTitle">
        <div class="eyebrow">ПЕРЕДАЧА СМЕНЫ</div>
        <h1>Что нельзя потерять</h1>
        <p>Короткие рабочие сообщения между сменами. Не чат и не склад случайных мыслей.</p>
      </div>

      <section class="card cardPad handoverComposer">
        <div class="handoverComposerGrid">
          <label>
            <span>Категория</span>
            <select class="search" id="handoverCategory">
              ${Object.entries(CATEGORY_LABELS).map(([key,label]) => `<option value="${key}">${label}</option>`).join('')}
            </select>
          </label>

          <label>
            <span>Приоритет</span>
            <select class="search" id="handoverPriority">
              <option value="normal">Обычная</option>
              <option value="high">Важная</option>
              <option value="critical">Критичная</option>
            </select>
          </label>
        </div>

        <label class="handoverBodyField">
          <span>Передача</span>
          <textarea id="handoverBody" maxlength="2000" placeholder="Например: кран №4 пенит, не использовать до проверки."></textarea>
        </label>

        <button class="btn primary" id="handoverSubmit" type="button">Добавить</button>
      </section>

      <section class="section">
        <div class="sectionHead">
          <div>
            <div class="eyebrow">АКТИВНОЕ</div>
            <h2>Передача</h2>
          </div>
          <span class="pill"><span id="handoverCount">0</span> записей</span>
        </div>

        <div id="handoverFilterHost"></div>
        <div class="handoverList" id="handoverList">
          <div class="card empty">Загрузка…</div>
        </div>
      </section>
    `, '/notes');

    document.getElementById('handoverSubmit').onclick = createHandover;

    try {
      const { rows, profiles } = await loadHandovers();

      const filters = document.getElementById('handoverFilterHost');
      filters.innerHTML = renderFilters(rows);

      const bindFilters = () => {
        filters.querySelectorAll('[data-handover-category]').forEach(button => {
          button.onclick = async () => {
            selectedCategory = button.dataset.handoverCategory || 'all';
            filters.innerHTML = renderFilters(rows);
            bindFilters();
            await renderList(rows, profiles);
          };
        });

        filters.querySelectorAll('[data-handover-status]').forEach(button => {
          button.onclick = async () => {
            selectedStatus = button.dataset.handoverStatus || 'active';
            filters.innerHTML = renderFilters(rows);
            bindFilters();
            await renderList(rows, profiles);
          };
        });
      };

      bindFilters();
      await renderList(rows, profiles);
    } catch (error) {
      console.error('BeerFactory handover load:', error);
      document.getElementById('handoverList').innerHTML = `
        <div class="card cardPad">
          <h3>Не удалось загрузить передачу</h3>
          <p style="color:var(--muted)">Нужен доступ к Supabase. Повторите позже.</p>
        </div>`;
    }
  };
})();
