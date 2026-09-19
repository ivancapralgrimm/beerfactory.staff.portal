(() => {
  'use strict';

  const previousAdminUsers = window.adminUsers;
  if (typeof previousAdminUsers !== 'function') return;

  let pendingDelete = null;

  const escDelete = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  function closeDeleteDialog() {
    document.getElementById('adminDeleteOverlay')?.remove();
    pendingDelete = null;
    document.body.classList.remove('adminDeleteOpen');
  }

  async function requestDeleteUser(userId) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('auth_required');

    const response = await fetch(ADMIN_FUNCTION, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + session.access_token
      },
      body: JSON.stringify({
        action: 'delete_user',
        user_id: userId
      })
    });

    let payload = {};
    try { payload = await response.json(); } catch {}

    if (!response.ok) {
      const err = new Error(payload?.error || 'delete_failed');
      err.payload = payload;
      throw err;
    }

    return payload;
  }

  function openDeleteDialog(userId, name) {
    closeDeleteDialog();

    pendingDelete = { userId, name };

    const overlay = document.createElement('div');
    overlay.id = 'adminDeleteOverlay';
    overlay.className = 'adminDeleteOverlay';
    overlay.innerHTML = `
      <div class="adminDeleteDialog" role="dialog" aria-modal="true" aria-labelledby="adminDeleteTitle">
        <div class="eyebrow">НЕОБРАТИМОЕ ДЕЙСТВИЕ</div>
        <h2 id="adminDeleteTitle">Удалить пользователя?</h2>
        <p class="adminDeleteName">${escDelete(name)}</p>

        <div class="adminDeleteInfo">
          <p>Будут удалены аккаунт, профиль и личные данные пользователя в портале.</p>
          <p>Его аттестации, прогресс обучения, уведомления, сообщения и созданные им передачи смены будут удалены.</p>
          <p>Общие рабочие записи сохранятся, но ссылка на удалённого сотрудника будет очищена.</p>
        </div>

        <label class="adminDeleteConfirmField">
          <span>Для подтверждения введите УДАЛИТЬ</span>
          <input class="search" id="adminDeleteConfirm" autocomplete="off" spellcheck="false" placeholder="УДАЛИТЬ">
        </label>

        <div class="adminDeleteActions">
          <button class="btn" id="adminDeleteCancel" type="button">Отмена</button>
          <button class="btn danger" id="adminDeleteSubmit" type="button" disabled>Удалить навсегда</button>
        </div>

        <div class="loginError" id="adminDeleteError"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add('adminDeleteOpen');

    const input = document.getElementById('adminDeleteConfirm');
    const submit = document.getElementById('adminDeleteSubmit');
    const cancel = document.getElementById('adminDeleteCancel');
    const error = document.getElementById('adminDeleteError');

    input.addEventListener('input', () => {
      submit.disabled = input.value.trim().toUpperCase() !== 'УДАЛИТЬ';
    });

    cancel.onclick = closeDeleteDialog;

    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeDeleteDialog();
    });

    const onKey = event => {
      if (event.key === 'Escape') {
        document.removeEventListener('keydown', onKey);
        closeDeleteDialog();
      }
    };
    document.addEventListener('keydown', onKey, { once: false });

    submit.onclick = async () => {
      if (!pendingDelete || input.value.trim().toUpperCase() !== 'УДАЛИТЬ') return;

      submit.disabled = true;
      cancel.disabled = true;
      input.disabled = true;
      submit.textContent = 'Удаляем…';
      error.textContent = '';

      try {
        await requestDeleteUser(pendingDelete.userId);
        closeDeleteDialog();
        toast('Пользователь и его данные удалены');
        await window.adminUsers();
      } catch (err) {
        const code = err?.message || '';

        if (code === 'cannot_delete_self') {
          error.textContent = 'Свой аккаунт удалить отсюда нельзя.';
        } else if (code === 'owner_protected') {
          error.textContent = 'Главного администратора удалить нельзя.';
        } else if (code === 'auth_delete_failed' && err?.payload?.prepared) {
          error.textContent = 'Данные очищены и доступ отключён, но Auth-запись не удалилась. Нужна техническая очистка.';
        } else if (code === 'forbidden') {
          error.textContent = 'Удаление доступно только администратору.';
        } else {
          error.textContent = 'Не удалось удалить пользователя.';
        }

        submit.disabled = false;
        cancel.disabled = false;
        input.disabled = false;
        submit.textContent = 'Удалить навсегда';
      }
    };

    setTimeout(() => input.focus(), 30);
  }

  function enhanceDeleteButtons() {
    if (String(currentUser?.role || '').toLowerCase() !== 'admin') return;

    const list = document.getElementById('adminUsersList');
    if (!list) return;

    list.querySelectorAll('article.card').forEach(card => {
      if (card.querySelector('[data-delete-user]')) return;

      const idSource =
        card.querySelector('[data-active]') ||
        card.querySelector('[data-role]') ||
        card.querySelector('[data-password]') ||
        card.querySelector('[data-secret]');

      const userId =
        idSource?.dataset?.active ||
        idSource?.dataset?.role ||
        idSource?.dataset?.password ||
        idSource?.dataset?.secret;

      if (!userId || userId === currentUser?.id) return;

      const eyebrow = card.querySelector('.eyebrow')?.textContent || '';
      if (eyebrow.includes('ГЛАВНЫЙ АДМИН')) return;

      const actions = card.querySelector('.actions');
      if (!actions) return;

      const name = card.querySelector('h3')?.textContent?.trim() || 'Пользователь';

      const button = document.createElement('button');
      button.className = 'btn danger adminDeleteUserBtn';
      button.type = 'button';
      button.dataset.deleteUser = userId;
      button.textContent = 'Удалить пользователя';
      button.onclick = () => openDeleteDialog(userId, name);

      actions.appendChild(button);
    });
  }

  window.adminUsers = async function adminUsersR34() {
    await previousAdminUsers();
    enhanceDeleteButtons();
  };
})();
