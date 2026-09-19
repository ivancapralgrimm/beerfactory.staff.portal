(() => {
  'use strict';

  const escDash = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const localDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2,'0');
    const d = String(now.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  };

  const shiftLabel = status => ({
    not_started: 'Не открыта',
    active: 'Смена открыта',
    closed: 'Смена закрыта'
  }[status] || 'Не открыта');

  const shiftAction = status => ({
    not_started: ['Открыть смену','#/shift'],
    active: ['Продолжить смену','#/shift'],
    closed: ['Посмотреть смену','#/shift']
  }[status] || ['Открыть смену','#/shift']);

  async function loadDashboardData() {
    const today = localDate();

    const [shiftRes,handoverRes,attemptRes,progressRes] = await Promise.all([
      sb.from('shifts')
        .select('id,shift_date,status,opened_at,closed_at')
        .eq('shift_date', today)
        .maybeSingle(),

      sb.from('notes')
        .select('id,body,priority,category,status,created_at')
        .neq('status','resolved')
        .order('created_at',{ascending:false})
        .limit(20),

      currentUser?.id
        ? sb.from('quiz_attempts')
            .select('category,score,passed,created_at,finished_at')
            .eq('user_id',currentUser.id)
            .order('created_at',{ascending:false})
            .limit(1)
            .maybeSingle()
        : Promise.resolve({data:null,error:null}),

      currentUser?.id
        ? sb.from('training_progress')
            .select('article_id',{count:'exact',head:true})
            .eq('user_id',currentUser.id)
            .eq('completed',true)
        : Promise.resolve({count:0,error:null})
    ]);

    return {
      shift: shiftRes.data || null,
      handovers: handoverRes.data || [],
      attempt: attemptRes.data || null,
      completedKnowledge: progressRes.count || 0,
      errors: {
        shift: shiftRes.error || null,
        handover: handoverRes.error || null,
        attempt: attemptRes.error || null,
        progress: progressRes.error || null
      }
    };
  }

  const priorityRank = value => ({critical:0,high:1,normal:2})[value] ?? 3;

  function topHandovers(rows) {
    return [...rows]
      .sort((a,b) => {
        const p = priorityRank(a.priority)-priorityRank(b.priority);
        return p || (new Date(b.created_at)-new Date(a.created_at));
      })
      .slice(0,3);
  }

  function recipeHref(id) {
    return `?recipe=${encodeURIComponent(id)}#/menu`;
  }

  async function runGlobalSearch(query) {
    const host = document.getElementById('homeSearchResults');
    if (!host) return;

    const q = String(query || '').trim();
    if (q.length < 2) {
      host.innerHTML = '';
      return;
    }

    host.innerHTML = '<div class="homeSearchLoading">Ищем…</div>';

    try {
      const [recipes,knowledge] = await Promise.all([
        typeof window.searchRecipes === 'function' ? window.searchRecipes(q) : [],
        typeof window.searchKnowledge === 'function' ? window.searchKnowledge(q) : []
      ]);

      const items = [
        ...recipes.map(x => ({
          ...x,
          href: recipeHref(x.id),
          kicker: `${x.category}${x.archived ? ' · Архив' : ''}`
        })),
        ...knowledge.map(x => ({
          ...x,
          href: `#/article/${encodeURIComponent(x.id)}`,
          kicker: `Знания · ${x.category}`
        }))
      ].slice(0,8);

      host.innerHTML = items.length ? `
        <div class="homeSearchList">
          ${items.map(item => `
            <a class="homeSearchItem" href="${escDash(item.href)}">
              <span>
                <small>${escDash(item.kicker)}</small>
                <strong>${escDash(item.title)}</strong>
              </span>
              <b>→</b>
            </a>
          `).join('')}
        </div>
      ` : '<div class="homeSearchEmpty">Ничего не найдено.</div>';
    } catch (error) {
      console.error('BeerFactory global search:', error);
      host.innerHTML = '<div class="homeSearchEmpty">Поиск сейчас недоступен.</div>';
    }
  }

  window.home = async function homeR36() {
    shell(`
      <section class="homeDashboard">
        <div class="homeWelcome">
          <div class="eyebrow">BEERFACTORY · STAFF</div>
          <h1>${currentUser?.first_name ? `Привет, ${escDash(currentUser.first_name)}.` : 'Рабочая смена.'}</h1>
          <p>Здесь только то, что может понадобиться сейчас.</p>
        </div>

        <section class="card homeGlobalSearch">
          <label for="homeSearch">
            <span>Быстрый поиск</span>
            <input class="search" id="homeSearch" autocomplete="off" placeholder="Рецепт, ингредиент, инструкция…">
          </label>
          <div id="homeSearchResults"></div>
        </section>

        <div class="homeStatusGrid" id="homeStatusGrid">
          <div class="card homeStatusCard"><div class="empty">Загрузка…</div></div>
        </div>

        <section class="homeFocus" id="homeFocus">
          <div class="sectionHead">
            <div><div class="eyebrow">СЕЙЧАС</div><h2>Фокус смены</h2></div>
          </div>
          <div class="card empty">Загрузка…</div>
        </section>

        <section class="homeQuick">
          <div class="sectionHead">
            <div><div class="eyebrow">БЫСТРО</div><h2>Рабочие разделы</h2></div>
          </div>
          <div class="homeQuickGrid">
            <a class="card homeQuickTile" href="#/menu"><span>01</span><strong>Рецепты</strong><small>Техкарты и калькулятор</small></a>
            <a class="card homeQuickTile" href="#/training"><span>02</span><strong>Знания</strong><small>Материалы и сервис</small></a>
            <a class="card homeQuickTile" href="#/attestation"><span>03</span><strong>Аттестация</strong><small>Проверить знания</small></a>
            <a class="card homeQuickTile" href="#/notes"><span>04</span><strong>Передача</strong><small>Между сменами</small></a>
          </div>
        </section>
      </section>
    `,'/');

    let searchTimer = null;
    const search = document.getElementById('homeSearch');
    search.oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => runGlobalSearch(search.value), 180);
    };

    const statusHost = document.getElementById('homeStatusGrid');
    const focusHost = document.getElementById('homeFocus');

    try {
      const data = await loadDashboardData();
      const status = data.shift?.status || 'not_started';
      const [actionLabel,actionHref] = shiftAction(status);
      const activeHandovers = data.handovers.length;
      const critical = data.handovers.filter(x => x.priority === 'critical').length;
      const latestAttempt = data.attempt;
      const e = data.errors || {};

      const shiftCard = e.shift ? `
        <div class="card homeStatusCard shift">
          <span>Смена</span>
          <strong>Недоступно</strong>
          <small>Не удалось получить состояние смены.</small>
        </div>
      ` : `
        <a class="card homeStatusCard shift ${escDash(status)}" href="${actionHref}">
          <span>Смена</span>
          <strong>${escDash(shiftLabel(status))}</strong>
          <small>${escDash(actionLabel)} →</small>
        </a>
      `;

      const handoverCard = e.handover ? `
        <div class="card homeStatusCard handover">
          <span>Передача</span>
          <strong>Недоступно</strong>
          <small>Не удалось получить записи передачи.</small>
        </div>
      ` : `
        <a class="card homeStatusCard handover" href="#/notes">
          <span>Передача</span>
          <strong>${activeHandovers}</strong>
          <small>${critical ? `Критичных: ${critical}` : 'Активных записей'}</small>
        </a>
      `;

      const learningCard = e.progress ? `
        <div class="card homeStatusCard learning">
          <span>Знания</span>
          <strong>Недоступно</strong>
          <small>Прогресс сейчас не загружен.</small>
        </div>
      ` : `
        <a class="card homeStatusCard learning" href="#/training">
          <span>Знания</span>
          <strong>${data.completedKnowledge}</strong>
          <small>Прочитано статей</small>
        </a>
      `;

      const attestationCard = e.attempt ? `
        <div class="card homeStatusCard attestation">
          <span>Последний тест</span>
          <strong>Недоступно</strong>
          <small>История попыток сейчас не загружена.</small>
        </div>
      ` : `
        <a class="card homeStatusCard attestation" href="#/attestation">
          <span>Последний тест</span>
          <strong>${latestAttempt ? `${Number(latestAttempt.score || 0)}%` : '—'}</strong>
          <small>${latestAttempt ? (latestAttempt.passed ? 'Зачтено' : 'Нужно повторить') : 'Попыток ещё нет'}</small>
        </a>
      `;

      statusHost.innerHTML = shiftCard + handoverCard + learningCard + attestationCard;

      if (e.handover) {
        focusHost.innerHTML = `
          <div class="sectionHead">
            <div><div class="eyebrow">СЕЙЧАС</div><h2>Фокус смены</h2></div>
          </div>
          <div class="card homeQuiet">
            <strong>Передача смены недоступна.</strong>
            <span>Не подменяем ошибку пустым списком.</span>
          </div>
        `;
      } else {
        const focus = topHandovers(data.handovers);
        focusHost.innerHTML = `
          <div class="sectionHead">
            <div><div class="eyebrow">СЕЙЧАС</div><h2>Фокус смены</h2></div>
            ${activeHandovers ? `<span class="pill">${activeHandovers}</span>` : ''}
          </div>
          ${focus.length ? `
            <div class="homeFocusList">
              ${focus.map(row => `
                <a class="card homeFocusItem priority-${escDash(row.priority)}" href="#/notes">
                  <span class="homeFocusPriority">${row.priority === 'critical' ? 'КРИТИЧНО' : row.priority === 'high' ? 'ВАЖНО' : 'ПЕРЕДАЧА'}</span>
                  <strong>${escDash(row.body)}</strong>
                  <small>${escDash(row.category || 'Другое')}</small>
                </a>
              `).join('')}
            </div>
          ` : `
            <div class="card homeQuiet">
              <strong>Активных передач нет.</strong>
              <span>Редкое и подозрительно приятное состояние.</span>
            </div>
          `}
        `;
      }
    } catch (error) {
      console.error('BeerFactory home dashboard:', error);
      statusHost.innerHTML = `
        <div class="card homeStatusCard">
          <span>Система</span>
          <strong>Нет связи</strong>
          <small>Рецепты и знания могут продолжать работать из кэша.</small>
        </div>
      `;
      focusHost.innerHTML = `
        <div class="sectionHead">
          <div><div class="eyebrow">СЕЙЧАС</div><h2>Фокус смены</h2></div>
        </div>
        <div class="card homeQuiet">
          <strong>Операционные данные недоступны.</strong>
          <span>Не показываем старое состояние как актуальное.</span>
        </div>
      `;
    }
  };
})();
