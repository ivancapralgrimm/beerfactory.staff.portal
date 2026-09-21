(() => {
  'use strict';

  const AUTH_LABELS = Object.freeze({
    firstName: 'Имя',
    lastName: 'Фамилия',
    code: 'Пароль',
    regFirst: 'Имя',
    regLast: 'Фамилия',
    regPassword: 'Пароль',
    regPassword2: 'Повторите пароль',
    regSecret: 'Секретный код',
    regSecret2: 'Повторите секретный код',
    rFirstName: 'Имя',
    rLastName: 'Фамилия',
    recoveryCode: 'Секретный код',
    newCode: 'Новый пароль',
    setupRecoveryCode: 'Секретный код',
    setupRecoveryCode2: 'Повторите секретный код'
  });

  function ensureSkipLink() {
    if (document.querySelector('.bfSkipLink')) return;

    const a = document.createElement('a');
    a.className = 'bfSkipLink';
    a.href = '#mainContent';
    a.textContent = 'К основному содержимому';
    document.body.prepend(a);
  }

  function ensureAuthLabels() {
    document.querySelectorAll('.loginCard input[id]').forEach(input => {
      const id = input.id;
      if (!id) return;

      const existing = document.querySelector(`label[for="${id}"]`);
      if (existing) return;

      const label = document.createElement('label');
      label.className = 'bfSrOnly';
      label.htmlFor = id;
      label.textContent = AUTH_LABELS[id] || input.placeholder || 'Поле формы';
      input.before(label);
    });

    document.querySelectorAll('.loginError').forEach(el => {
      el.setAttribute('role','alert');
      el.setAttribute('aria-live','polite');
    });
  }

  function patchAccessibility(root = document) {
    const main = root.querySelector?.('main.main') || document.querySelector('main.main');
    if (main) {
      main.id = 'mainContent';
      main.setAttribute('tabindex','-1');
    }

    const nav = root.querySelector?.('.bottom .nav') || document.querySelector('.bottom .nav');
    if (nav) nav.setAttribute('aria-label','Основная навигация');

    document.querySelectorAll('.bottom .nav a').forEach(link => {
      if (link.classList.contains('active')) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });

    document.querySelectorAll('.toast').forEach(el => {
      el.setAttribute('role','status');
      el.setAttribute('aria-live','polite');
      el.setAttribute('aria-atomic','true');
    });

    document.querySelectorAll('.recipeLightbox,.learnLightbox').forEach(el => {
      el.setAttribute('role','dialog');
      el.setAttribute('aria-modal','true');
    });

    document.querySelectorAll('.adminDeleteDialog').forEach(el => {
      el.setAttribute('role','dialog');
      el.setAttribute('aria-modal','true');
    });

    ensureAuthLabels();

    const h1 = document.querySelector('main.main h1');
    if (h1?.textContent?.trim()) {
      document.title = `BeerFactory · ${h1.textContent.trim()}`;
    }
  }

  function trapDialogFocus(event) {
    if (event.key !== 'Tab') return;

    const dialog = document.querySelector('.adminDeleteOverlay .adminDeleteDialog');
    if (!dialog) return;

    const items = [...dialog.querySelectorAll(
      'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'
    )].filter(el => !el.hidden && el.offsetParent !== null);

    if (!items.length) return;

    const first = items[0];
    const last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  ensureSkipLink();
  patchAccessibility();

  const observer = new MutationObserver(() => patchAccessibility());
  observer.observe(document.body,{childList:true,subtree:true});

  document.addEventListener('keydown',trapDialogFocus);
})();
