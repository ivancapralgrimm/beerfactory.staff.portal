(() => {
  'use strict';

  const originalAdminUsers = window.adminUsers;
  if (typeof originalAdminUsers !== 'function') return;

  let activeTab = 'users';

  let auditCache = null;
  let auditLoadedAt = 0;
  let auditFilter = 'all';

  let attemptCache = null;
  let attemptLoadedAt = 0;
  let attemptFilter = 'all';

  const escAdmin = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const dateTime = value => {
    try {
      return new Date(value).toLocaleString('ru-RU', {
        day:'2-digit',
        month:'2-digit',
        year:'numeric',
        hour:'2-digit',
        minute:'2-digit'
      });
    } catch {
      return String(value || '');
    }
  };

  const profileName = (id, people) => {
    const p = people.get(id);
    return p
      ? [p.first_name,p.last_name].filter(Boolean).join(' ')
      : 'Сотрудник';
  };

  async function fetchPeople(ids) {
    const people = new Map();
    const unique = [...new Set((ids || []).filter(Boolean))];
    if (!unique.length) return people;

    const { data, error } = await sb
      .from('profiles')
      .select('id,first_name,last_name,position')
      .in('id', unique);

    if (!error) {
      for (const p of data || []) people.set(p.id, p);
    }
    return people;
  }

  /* ===== Attestation visibility ===== */

  async function loadAttempts(force = false) {
    const pane = document.getElementById('adminAttemptsPane');
    if (!pane) return;

    if (!force && attemptCache && Date.now() - attemptLoadedAt < 30000) {
      renderAttempts(attemptCache.rows, attemptCache.people);
      return;
    }

    pane.innerHTML = '<div class="card empty">Загрузка результатов…</div>';

    try {
      const { data: rows, error } = await sb
        .from('quiz_attempts')
        .select('id,user_id,category,category_id,score,passed,total_questions,correct_answers,category_results,created_at,finished_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const people = await fetchPeople((rows || []).map(x => x.user_id));

      attemptCache = { rows: rows || [], people };
      attemptLoadedAt = Date.now();
      renderAttempts(attemptCache.rows, attemptCache.people);
    } catch (error) {
      console.error('BeerFactory attempts:', error);
      pane.innerHTML = `
        <div class="card cardPad">
          <div class="eyebrow">АТТЕСТАЦИИ</div>
          <h2>Не удалось загрузить результаты</h2>
          <p style="color:var(--muted)">Повторите загрузку.</p>
          <button class="btn" id="attemptRetry" type="button">Повторить</button>
        </div>`;
      document.getElementById('attemptRetry')?.addEventListener('click', () => loadAttempts(true));
    }
  }

  function attemptCategories(rows) {
    return [...new Set(rows.map(x => x.category || x.category_id).filter(Boolean))];
  }

  function filteredAttempts(rows) {
    if (attemptFilter === 'all') return rows;
    return rows.filter(row => (row.category || row.category_id) === attemptFilter);
  }

  function weakTopics(row) {
    const raw = row?.category_results?.weak_topics;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(x => x && x.topic)
      .map(x => ({
        topic: String(x.topic),
        correct: Number(x.correct || 0),
        total: Number(x.total || 0)
      }));
  }

  function renderAttempts(rows, people) {
    const pane = document.getElementById('adminAttemptsPane');
    if (!pane) return;

    const categories = attemptCategories(rows);
    const filtered = filteredAttempts(rows);

    const completed = filtered.length;
    const passed = filtered.filter(x => x.passed).length;
    const average = completed
      ? Math.round(filtered.reduce((sum,x) => sum + Number(x.score || 0), 0) / completed)
      : 0;

    pane.innerHTML = `
      <section class="adminConsoleTools">
        <div class="adminConsoleFilters" role="group" aria-label="Фильтр аттестаций">
          <button class="chip ${attemptFilter==='all'?'active':''}" data-attempt-filter="all">Все</button>
          ${categories.map(category => `
            <button class="chip ${attemptFilter===category?'active':''}" data-attempt-filter="${escAdmin(category)}">${escAdmin(category)}</button>
          `).join('')}
        </div>
        <button class="btn adminConsoleRefresh" id="attemptRefresh" type="button">Обновить</button>
      </section>

      <div class="adminAttemptMetrics">
        <div class="card adminAttemptMetric"><span>Попыток</span><b>${completed}</b></div>
        <div class="card adminAttemptMetric"><span>Зачтено</span><b>${passed}</b></div>
        <div class="card adminAttemptMetric"><span>Средний</span><b>${average}%</b></div>
      </div>

      <div class="adminAttemptList">
        ${filtered.length ? filtered.map(row => {
          const weak = weakTopics(row);
          return `
            <article class="card adminAttemptItem">
              <div class="adminAttemptTop">
                <div>
                  <div class="eyebrow">${escAdmin(row.category || row.category_id || 'АТТЕСТАЦИЯ')}</div>
                  <h3>${escAdmin(profileName(row.user_id, people))}</h3>
                </div>
                <span class="adminScore ${row.passed ? 'passed' : 'failed'}">${Number(row.score || 0)}%</span>
              </div>

              <div class="adminAttemptMeta">
                <span>${Number(row.correct_answers || 0)} / ${Number(row.total_questions || 0)}</span>
                <span>·</span>
                <span>${escAdmin(dateTime(row.finished_at || row.created_at))}</span>
              </div>

              ${weak.length ? `
                <div class="adminWeakTopics">
                  <strong>Ошибки по темам</strong>
                  <div>
                    ${weak.map(x => `
                      <span>${escAdmin(x.topic)} · ${x.correct}/${x.total}</span>
                    `).join('')}
                  </div>
                </div>
              ` : `<p class="adminAttemptClean">Слабые темы не выявлены.</p>`}
            </article>
          `;
        }).join('') : `
          <div class="card empty">
            Результатов пока нет. После r29 новые попытки будут сохраняться в Supabase.
          </div>
        `}
      </div>
    `;

    pane.querySelectorAll('[data-attempt-filter]').forEach(button => {
      button.onclick = () => {
        attemptFilter = button.dataset.attemptFilter || 'all';
        renderAttempts(rows, people);
      };
    });

    document.getElementById('attemptRefresh')?.addEventListener('click', () => loadAttempts(true));
  }

  /* ===== Audit ===== */

  const actionLabel = action => ({
    recipe_governance_update: 'РЕЦЕПТ',
    profile_role_update: 'РОЛЬ',
    profile_activation_update: 'ДОСТУП',
    credential_reset: 'БЕЗОПАСНОСТЬ',
    profile_delete: 'УДАЛЕНИЕ',
    operational_critical_update: 'ОПЕРАЦИОННОЕ'
  }[action] || 'СИСТЕМА');

  const actionTone = action => ({
    recipe_governance_update: 'recipe',
    profile_role_update: 'role',
    profile_activation_update: 'access',
    credential_reset: 'security',
    profile_delete: 'critical',
    operational_critical_update: 'critical'
  }[action] || 'system');

  function auditDiffLines(row) {
    const before = row.before_data || {};
    const after = row.after_data || {};
    const metadata = row.metadata || {};
    const lines = [];

    if (row.action === 'recipe_governance_update') {
      if (before.status !== after.status && after.status) {
        lines.push(`Статус: ${before.status || '—'} → ${after.status}`);
      }
      if (before.version !== after.version && after.version) {
        lines.push(`Версия: ${before.version || '—'} → ${after.version}`);
      }
      if (before.change_note !== after.change_note && after.change_note) {
        lines.push(`Изменение: ${after.change_note}`);
      }
      if (after.updated_by) lines.push(`Ответственный: ${after.updated_by}`);
      return lines;
    }

    if (row.action === 'profile_role_update') {
      lines.push(`Роль: ${before.role || '—'} → ${after.role || '—'}`);
      return lines;
    }

    if (row.action === 'profile_activation_update') {
      const a = before.is_active === false ? 'отключён' : 'активен';
      const b = after.is_active === false ? 'отключён' : 'активен';
      lines.push(`Доступ: ${a} → ${b}`);
      return lines;
    }

    if (row.action === 'credential_reset') {
      lines.push(metadata.credential === 'recovery_code'
        ? 'Изменён код восстановления'
        : 'Изменён пароль');
      return lines;
    }

    if (row.action === 'profile_delete') {
      lines.push('Аккаунт и персональные данные пользователя удалены.');
      return lines;
    }

    const keys = [...new Set([...Object.keys(before),...Object.keys(after)])];
    for (const key of keys.slice(0,4)) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        lines.push(`${key}: ${String(before[key] ?? '—')} → ${String(after[key] ?? '—')}`);
      }
    }
    return lines;
  }

  async function loadAudit(force = false) {
    const pane = document.getElementById('adminAuditPane');
    if (!pane) return;

    if (!force && auditCache && Date.now() - auditLoadedAt < 30000) {
      renderAudit(auditCache.rows, auditCache.people);
      return;
    }

    pane.innerHTML = '<div class="card empty">Загрузка журнала…</div>';

    try {
      const { data: rows, error } = await sb
        .from('audit_log')
        .select('id,actor_id,action,entity_type,entity_id,entity_name,before_data,after_data,metadata,created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const people = await fetchPeople((rows || []).map(x => x.actor_id));

      auditCache = { rows: rows || [], people };
      auditLoadedAt = Date.now();
      renderAudit(auditCache.rows, auditCache.people);
    } catch (error) {
      console.error('BeerFactory audit:', error);
      pane.innerHTML = `
        <div class="card cardPad">
          <div class="eyebrow">ЖУРНАЛ</div>
          <h2>Не удалось загрузить историю</h2>
          <p style="color:var(--muted)">Раздел доступен только администраторам.</p>
          <button class="btn" id="auditRetry" type="button">Повторить</button>
        </div>`;
      document.getElementById('auditRetry')?.addEventListener('click', () => loadAudit(true));
    }
  }

  function filteredAudit(rows) {
    if (auditFilter === 'recipes') return rows.filter(x => x.action === 'recipe_governance_update');
    if (auditFilter === 'team') return rows.filter(x =>
      ['profile_role_update','profile_activation_update','credential_reset','profile_delete'].includes(x.action)
    );
    return rows;
  }

  function renderAudit(rows, people) {
    const pane = document.getElementById('adminAuditPane');
    if (!pane) return;

    const filtered = filteredAudit(rows);

    pane.innerHTML = `
      <section class="adminConsoleTools">
        <div class="adminConsoleFilters" role="group" aria-label="Фильтр журнала">
          <button class="chip ${auditFilter==='all'?'active':''}" data-audit-filter="all">Все</button>
          <button class="chip ${auditFilter==='recipes'?'active':''}" data-audit-filter="recipes">Рецепты</button>
          <button class="chip ${auditFilter==='team'?'active':''}" data-audit-filter="team">Сотрудники</button>
        </div>
        <button class="btn adminConsoleRefresh" id="auditRefresh" type="button">Обновить</button>
      </section>

      <div class="adminConsoleSummary">
        <span>Последние записи</span>
        <b>${filtered.length}</b>
      </div>

      <div class="adminAuditList">
        ${filtered.length ? filtered.map(row => {
          const lines = auditDiffLines(row);
          return `
            <article class="card adminAuditItem">
              <div class="adminAuditTop">
                <span class="adminAuditTag ${actionTone(row.action)}">${actionLabel(row.action)}</span>
                <time>${escAdmin(dateTime(row.created_at))}</time>
              </div>
              <h3>${escAdmin(row.entity_name || row.entity_type || 'Запись')}</h3>
              <p class="adminAuditActor">${escAdmin(profileName(row.actor_id, people))}</p>
              ${lines.length ? `<div class="adminAuditChanges">${lines.map(x => `<div>${escAdmin(x)}</div>`).join('')}</div>` : ''}
            </article>
          `;
        }).join('') : `
          <div class="card empty">
            Пока записей нет. Журнал начал собираться только после включения аудита.
          </div>
        `}
      </div>
    `;

    pane.querySelectorAll('[data-audit-filter]').forEach(button => {
      button.onclick = () => {
        auditFilter = button.dataset.auditFilter || 'all';
        renderAudit(rows, people);
      };
    });

    document.getElementById('auditRefresh')?.addEventListener('click', () => loadAudit(true));
  }

  /* ===== Admin shell tabs ===== */

  function setTab(tab) {
    activeTab = ['users','attempts','audit'].includes(tab) ? tab : 'users';

    const users = document.getElementById('adminUsersPane');
    const attempts = document.getElementById('adminAttemptsPane');
    const audit = document.getElementById('adminAuditPane');

    if (!users || !attempts || !audit) return;

    users.hidden = activeTab !== 'users';
    attempts.hidden = activeTab !== 'attempts';
    audit.hidden = activeTab !== 'audit';

    document.querySelectorAll('[data-admin-tab]').forEach(button => {
      const on = button.dataset.adminTab === activeTab;
      button.classList.toggle('active', on);
      button.setAttribute('aria-selected', String(on));
    });

    if (activeTab === 'attempts') loadAttempts(false);
    if (activeTab === 'audit') loadAudit(false);
  }

  function enhanceAdminPage() {
    if (String(currentUser?.role || '').toLowerCase() !== 'admin') return;

    const main = document.querySelector('main.main');
    if (!main || document.getElementById('adminModeTabs')) return;

    const title = main.querySelector('.pageTitle');
    if (!title) return;

    const nodes = [...main.children].filter(node => node !== title);

    const usersPane = document.createElement('div');
    usersPane.id = 'adminUsersPane';
    for (const node of nodes) usersPane.appendChild(node);

    const tabs = document.createElement('div');
    tabs.id = 'adminModeTabs';
    tabs.className = 'adminModeTabs';
    tabs.setAttribute('role','tablist');
    tabs.innerHTML = `
      <button class="adminModeTab" type="button" role="tab" data-admin-tab="users">Сотрудники</button>
      <button class="adminModeTab" type="button" role="tab" data-admin-tab="attempts">Аттестации</button>
      <button class="adminModeTab" type="button" role="tab" data-admin-tab="audit">Журнал</button>
    `;

    const attemptsPane = document.createElement('div');
    attemptsPane.id = 'adminAttemptsPane';
    attemptsPane.hidden = true;

    const auditPane = document.createElement('div');
    auditPane.id = 'adminAuditPane';
    auditPane.hidden = true;

    title.insertAdjacentElement('afterend', tabs);
    tabs.insertAdjacentElement('afterend', usersPane);
    usersPane.insertAdjacentElement('afterend', attemptsPane);
    attemptsPane.insertAdjacentElement('afterend', auditPane);

    tabs.querySelectorAll('[data-admin-tab]').forEach(button => {
      button.onclick = () => setTab(button.dataset.adminTab);
    });

    setTab(activeTab);
  }

  window.adminUsers = async function adminUsersR30() {
    await originalAdminUsers();
    enhanceAdminPage();
  };
})();
