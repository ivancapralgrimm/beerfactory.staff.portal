/* BeerFactory r40.3 QA auth timing probe.
   Preview-only shim: routes the existing staff-login request to the isolated
   staff-login-qa Edge Function and logs internal server timings.
   Remove before production merge. */
(() => {
  'use strict';

  const originalFetch = window.fetch.bind(window);
  const LOGIN_PROD = 'https://oltbkrvernfgymxtsfys.supabase.co/functions/v1/staff-login';
  const LOGIN_QA = 'https://oltbkrvernfgymxtsfys.supabase.co/functions/v1/staff-login-qa';

  window.fetch = async function bfQaFetch(input, init) {
    const sourceUrl = typeof input === 'string' ? input : input?.url;
    const isLogin = sourceUrl === LOGIN_PROD;
    let nextInput = input;

    if (isLogin) {
      nextInput = typeof input === 'string'
        ? LOGIN_QA
        : new Request(LOGIN_QA, input);
    }

    const started = performance.now();
    const response = await originalFetch(nextInput, init);

    if (isLogin) {
      const networkTotalMs = Math.round(performance.now() - started);
      response.clone().json().then((body) => {
        const report = {
          status: response.status,
          browser_fetch_ms: networkTotalMs,
          edge: body?.timings || null
        };
        window.__BF_AUTH_QA_LAST__ = report;
        console.info('[BF AUTH QA]', report);
      }).catch(() => {
        console.info('[BF AUTH QA]', {
          status: response.status,
          browser_fetch_ms: networkTotalMs,
          edge: null
        });
      });
    }

    return response;
  };
})();
