(() => {
  'use strict';

  const STATUS_ID = 'bfConnectivityStatus';
  const UPDATE_ID = 'bfReleaseUpdate';

  function ensureConnectivity() {
    let el = document.getElementById(STATUS_ID);
    if (el) return el;

    el = document.createElement('div');
    el.id = STATUS_ID;
    el.className = 'bfConnectivity';
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    el.hidden = true;
    document.body.appendChild(el);
    return el;
  }

  function renderConnectivity() {
    const el = ensureConnectivity();
    const offline = navigator.onLine === false;
    el.hidden = !offline;
    el.textContent = offline
      ? 'Офлайн · рецепты и знания доступны из сохранённой версии'
      : '';
    document.documentElement.classList.toggle('bfOffline', offline);
  }

  function showReleaseUpdate() {
    if (document.getElementById(UPDATE_ID)) return;

    const el = document.createElement('div');
    el.id = UPDATE_ID;
    el.className = 'bfReleaseUpdate';
    el.setAttribute('role','status');
    el.innerHTML = `
      <span>Доступна новая версия портала.</span>
      <button type="button" class="btn" id="bfReleaseReload">Обновить</button>
    `;
    document.body.appendChild(el);

    document.getElementById('bfReleaseReload').onclick = () => location.reload();
  }

  renderConnectivity();
  window.addEventListener('online', renderConnectivity);
  window.addEventListener('offline', renderConnectivity);

  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    let notified = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !notified) {
        notified = true;
        showReleaseUpdate();
      }
    });
  }

  // Operational mutations must remain server-confirmed. This is only a shared
  // runtime signal for modules that want to render connectivity-aware UI.
  window.BeerFactoryRuntime = Object.freeze({
    isOnline: () => navigator.onLine !== false
  });
})();
