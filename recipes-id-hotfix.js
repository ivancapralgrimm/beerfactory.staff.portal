(() => {
  'use strict';

  if (typeof window.loadMenu !== 'function' || window._bfRecipeIdHotfix243) return;
  window._bfRecipeIdHotfix243 = true;

  const originalLoadMenu = window.loadMenu;
  const clean = value => String(value ?? '').trim();

  function hashId(value) {
    const source = String(value).toLowerCase();
    let hash = 2166136261;
    for (let i = 0; i < source.length; i++) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `bf-route-${(hash >>> 0).toString(36)}`;
  }

  function routedId(item) {
    const rawId = clean(item?.recordId || item?.id || item?._id);
    const category = clean(item?.category) || 'Меню';
    const name = clean(item?.name) || 'Без названия';
    return hashId(`${category}|${rawId}|${name}`);
  }

  window.loadMenu = async function loadMenuRoutingHotfix243() {
    const rows = await originalLoadMenu();
    return (Array.isArray(rows) ? rows : []).map(item => ({
      ...item,
      recordId: clean(item?.recordId || item?.id || item?._id),
      id: routedId(item)
    }));
  };
})();
