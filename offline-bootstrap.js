(() => {
  'use strict';

  // Fail remote API calls immediately when the device is genuinely offline.
  // The portal still allows same-origin requests so the service worker can
  // satisfy cached app-shell, recipe and knowledge assets.
  const nativeFetch = window.fetch.bind(window);

  function requestUrl(input) {
    try {
      if (typeof Request !== 'undefined' && input instanceof Request) {
        return new URL(input.url, location.href);
      }
      return new URL(String(input), location.href);
    } catch (_) {
      return null;
    }
  }

  function offlineError(url) {
    const error = new TypeError('Network unavailable while device is offline');
    error.code = 'BF_OFFLINE';
    error.url = url || '';
    return error;
  }

  window.fetch = function beerFactoryFetch(input, init) {
    const url = requestUrl(input);
    const remote = !!url && url.origin !== location.origin;

    if (remote && navigator.onLine === false) {
      return Promise.reject(offlineError(url.href));
    }

    return nativeFetch(input, init);
  };
})();
