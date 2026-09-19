(() => {
  'use strict';

  const STATUS_LABELS = {
    not_started: 'Не открыта',
    active: 'Открыта',
    closed: 'Закрыта'
  };

  const localShiftDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const CHECK_LABELS = {
    opening: 'Открытие',
    closing: 'Закрытие'
  };

  const escShift = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const dateLabel = value => {
    try {
      return new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU', {
        day:'2-digit',
        month:'2-digit',
        year:'numeric'
      });
    } catch {
      return String(value || '');
    }
  };

  const timeLabel = value => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleTimeString('ru-RU', {
        hour:'2-digit',
        minute:'2-digit'
      });
    } catch {
      return String(value || '');
    }
  };

  async function loadShiftState() {
    const shiftDate = localShiftDate();
    const { data: shift, error: shiftError } = await sb.rpc('ensure_shift_for_date', { p_shift_date: shiftDate });
    if (shiftError || !shift) throw shiftError || new Error('shift_unavailable');

    const [{ data: definitions, error: defError }, { data: checks, error: checksError }] = await Promise.all([
      sb.from('shift_check_definitions')
        .select('item_key,check_type,label,sort_order,critical,is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      sb.from('shift_checks')
        .select('id,shift_id,check_type,item_key,label,completed,completed_by,completed_at')
        .eq('shift_id', shift.id)
    ]);

    if (defError) throw defError;
    if (checksError) throw checksError;

    const checkMap = new Map((checks || []).map(x => [`${x.check_type}:${x.item_key}`, x]));
    const rows = (definitions || []).map(def => ({
      ...def,
      check: checkMap.get(`${def.check_type}:${def.item_key}`) || null
    }));

    return { shift, rows };
  }

  function progress(rows, type) {
    const list = rows.filter(x => x.check_type === type);
    const completed = list.filter(x => x.check?.completed).length;
    return { list, completed, total: list.length };
  }

  function checkList(rows, type, locked) {
    const items = rows.filter(x => x.check_type === type);

    return `
      <div class="shiftChecklist">
        ${items.map(item => {
          const checked = !!item.check?.completed;
          return `
            <label class="shiftCheck ${item.critical ? 'critical' : ''} ${locked ? 'locked' : ''}">
              <input
                type="checkbox"
                data-shift-check-type="${escShift(type)}"
                data-shift-check-key="${escShift(item.item_key)}"
                ${checked ? 'checked' : ''}
                ${locked ? 'disabled' : ''}
              >
              <span class="shiftCheckBox" aria-hidden="true"></span>
              <span class="shiftCheckText">
                <strong>${escShift(item.label)}</strong>
                ${item.critical ? '<small>Критичный пункт</small>' : ''}
              </span>
            </label>
          `;
        }).join('')}
      </div>
    `;
  }

  async function setCheck(type, key, completed, input) {
    input.disabled = true;

    const { error } = await sb.rpc('set_shift_check_for_date', {
      p_shift_date: localShiftDate(),
      p_check_type: type,
      p_item_key: key,
      p_completed: completed
    });

    if (error) {
      input.checked = !completed;
      input.disabled = false;
      throw error;
    }

    await window.shift();
  }

  async function confirmShift(action) {
    const rpc = action === 'open' ? 'confirm_open_shift_for_date' : 'confirm_close_shift_for_date';
    const { error } = await sb.rpc(rpc, { p_shift_date: localShiftDate() });
    if (error) throw error;
    await window.shift();
  }

  function errorMessage(error) {
    const message = String(error?.message || error || '');

    if (message.includes('opening_incomplete')) return 'Сначала отметьте все пункты открытия.';
    if (message.includes('closing_incomplete')) return 'Сначала отметьте все пункты закрытия.';
    if (message.includes('shift_not_open')) return 'Смена ещё не открыта.';
    if (message.includes('shift_closed')) return 'Эта смена уже закрыта.';
    if (message.includes('opening_locked')) return 'Открытие уже подтверждено.';
    if (message.includes('closing_locked')) return 'Закрытие доступно только после открытия смены.';
    return 'Не удалось сохранить изменение.';
  }

  window.shift = async function shiftR36() {
    window.scrollTo(0, 0);

    shell(`
      <div class="pageTitle">
        <div class="eyebrow">СМЕНА</div>
        <h1>Открытие / закрытие</h1>
        <p>Чек-лист общий для команды и сохраняется в профиле смены, а не на конкретном телефоне.</p>
      </div>

      <section class="card cardPad" id="shiftWorkflowHost">
        <div class="empty">Загрузка смены…</div>
      </section>

      <section class="section">
        <div class="card cardPad">
          <div class="eyebrow">ПЕРЕДАЧА</div>
          <h3>Есть проблема, которую нельзя потерять?</h3>
          <p style="color:var(--muted)">Передайте её следующей смене отдельно от чек-листа.</p>
          <a class="btn" href="#/notes">Открыть передачу →</a>
        </div>
      </section>
    `, '/shift');

    const host = document.getElementById('shiftWorkflowHost');

    try {
      const { shift, rows } = await loadShiftState();
      const opening = progress(rows, 'opening');
      const closing = progress(rows, 'closing');

      const openingLocked = shift.status !== 'not_started';
      const closingLocked = shift.status !== 'active';

      host.innerHTML = `
        <div class="shiftStatusHero status-${escShift(shift.status)}">
          <div>
            <div class="eyebrow">${escShift(dateLabel(shift.shift_date))}</div>
            <h2>${escShift(STATUS_LABELS[shift.status] || shift.status)}</h2>
          </div>
          <div class="shiftTimes">
            <span>Открыта <b>${escShift(timeLabel(shift.opened_at))}</b></span>
            <span>Закрыта <b>${escShift(timeLabel(shift.closed_at))}</b></span>
          </div>
        </div>

        <section class="shiftPhase">
          <div class="sectionHead">
            <div>
              <div class="eyebrow">${CHECK_LABELS.opening.toUpperCase()}</div>
              <h2>${opening.completed} / ${opening.total}</h2>
            </div>
            <span class="pill ${opening.completed === opening.total && opening.total ? 'done' : ''}">
              ${openingLocked ? 'зафиксировано' : 'в процессе'}
            </span>
          </div>

          <div class="progress shiftProgress">
            <i style="width:${opening.total ? opening.completed/opening.total*100 : 0}%"></i>
          </div>

          ${checkList(rows, 'opening', openingLocked)}

          ${shift.status === 'not_started' ? `
            <button class="btn primary shiftConfirm" id="confirmOpenShift" type="button"
              ${opening.completed !== opening.total || !opening.total ? 'disabled' : ''}>
              Подтвердить открытие
            </button>
          ` : ''}
        </section>

        <section class="shiftPhase">
          <div class="sectionHead">
            <div>
              <div class="eyebrow">${CHECK_LABELS.closing.toUpperCase()}</div>
              <h2>${closing.completed} / ${closing.total}</h2>
            </div>
            <span class="pill ${closing.completed === closing.total && closing.total ? 'done' : ''}">
              ${shift.status === 'closed' ? 'зафиксировано' : shift.status === 'active' ? 'в процессе' : 'после открытия'}
            </span>
          </div>

          <div class="progress shiftProgress">
            <i style="width:${closing.total ? closing.completed/closing.total*100 : 0}%"></i>
          </div>

          ${checkList(rows, 'closing', closingLocked)}

          ${shift.status === 'active' ? `
            <button class="btn gold shiftConfirm" id="confirmCloseShift" type="button"
              ${closing.completed !== closing.total || !closing.total ? 'disabled' : ''}>
              Подтвердить закрытие
            </button>
          ` : ''}
        </section>

        <div class="shiftWorkflowMessage" id="shiftWorkflowMessage" role="status"></div>
      `;

      host.querySelectorAll('[data-shift-check-key]').forEach(input => {
        input.onchange = async () => {
          const type = input.dataset.shiftCheckType;
          const key = input.dataset.shiftCheckKey;
          const completed = input.checked;

          try {
            await setCheck(type, key, completed, input);
          } catch (error) {
            document.getElementById('shiftWorkflowMessage').textContent = errorMessage(error);
          }
        };
      });

      const openButton = document.getElementById('confirmOpenShift');
      if (openButton) {
        openButton.onclick = async () => {
          openButton.disabled = true;
          openButton.textContent = 'Открываем…';
          try {
            await confirmShift('open');
            toast('Смена открыта');
          } catch (error) {
            document.getElementById('shiftWorkflowMessage').textContent = errorMessage(error);
            openButton.disabled = false;
            openButton.textContent = 'Подтвердить открытие';
          }
        };
      }

      const closeButton = document.getElementById('confirmCloseShift');
      if (closeButton) {
        closeButton.onclick = async () => {
          closeButton.disabled = true;
          closeButton.textContent = 'Закрываем…';
          try {
            await confirmShift('close');
            toast('Смена закрыта');
          } catch (error) {
            document.getElementById('shiftWorkflowMessage').textContent = errorMessage(error);
            closeButton.disabled = false;
            closeButton.textContent = 'Подтвердить закрытие';
          }
        };
      }
    } catch (error) {
      console.error('BeerFactory shift workflow:', error);
      host.innerHTML = `
        <div class="shiftOfflineState">
          <div class="eyebrow">СМЕНА НЕДОСТУПНА</div>
          <h2>Не удалось подключиться к рабочему чек-листу</h2>
          <p>Чек-лист не подменяется локальной копией: иначе два телефона могли бы показывать разную «правду».</p>
          <button class="btn" id="shiftRetry" type="button">Повторить</button>
        </div>
      `;
      document.getElementById('shiftRetry')?.addEventListener('click', () => window.shift());
    }
  };
})();
