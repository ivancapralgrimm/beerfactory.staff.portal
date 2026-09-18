
(() => {
  'use strict';

  const TEXT_REPLACEMENTS = [
    [/Секретные коды/g, 'Коды восстановления'],
    [/секретные коды/g, 'коды восстановления'],
    [/Секретный код/g, 'Код восстановления'],
    [/секретный код/g, 'код восстановления']
  ];

  function replaceWording(value) {
    let out = String(value ?? '');
    for (const [from, to] of TEXT_REPLACEMENTS) out = out.replace(from, to);
    return out;
  }

  function patchTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE || !node.nodeValue) return;
    const next = replaceWording(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  function patchElement(el) {
    if (!(el instanceof Element)) return;

    for (const attr of ['placeholder', 'aria-label', 'title']) {
      if (!el.hasAttribute(attr)) continue;
      const value = el.getAttribute(attr);
      const next = replaceWording(value);
      if (next !== value) el.setAttribute(attr, next);
    }

    // На экране входа лишняя подсказка про длину не нужна.
    if (el.id === 'code') {
      el.setAttribute('placeholder', 'Пароль');
    }

    // Header actions are intentionally consolidated inside Profile for the pilot.
    if (
      el.matches?.('.topLogout') ||
      el.matches?.('.top .btn.gold[href="#/admin"]')
    ) {
      el.remove();
      return;
    }

    if (el.id === 'profileBtn') {
      el.setAttribute('aria-label', 'Профиль');
      el.setAttribute('title', 'Профиль');
    }

    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) patchTextNode(child);
    }
  }

  function patchTree(root) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      patchTextNode(root);
      return;
    }

    if (root instanceof Element) {
      patchElement(root);
      root.querySelectorAll('*').forEach(patchElement);
    }
  }

  patchTree(document.body);

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) patchTree(node);
      if (record.type === 'characterData') patchTextNode(record.target);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();
