/* BeerFactory r40.3 QA auth timing probe v2. Preview-only. */
(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const nativeCreateClient = window.supabase.createClient.bind(window.supabase);

  const LOGIN_PROD = 'https://oltbkrvernfgymxtsfys.supabase.co/functions/v1/staff-login';
  const LOGIN_QA = 'https://oltbkrvernfgymxtsfys.supabase.co/functions/v1/staff-login-qa';
  const PROFILE = 'https://oltbkrvernfgymxtsfys.supabase.co/functions/v1/staff-profile';

  const state = {
    loginFetchMs: null,
    edge: null,
    setSessionMs: null,
    getSessionMs: null,
    profileFetchMs: null
  };

  const log = (label, payload) => {
    console.info(label + ' ' + JSON.stringify(payload));
  };

  const publish = () => {
    const report = {
      browser_fetch_ms: state.loginFetchMs,
      set_session_ms: state.setSessionMs,
      get_session_ms: state.getSessionMs,
      profile_fetch_ms: state.profileFetchMs,
      edge: state.edge
    };
    window.__BF_AUTH_QA_LAST__ = report;
    log('[BF AUTH QA]', report);
  };

  window.fetch = async function(input, init) {
    const sourceUrl = typeof input === 'string' ? input : input?.url;
    const isLogin = sourceUrl === LOGIN_PROD;
    const isProfile = sourceUrl === PROFILE;
    let nextInput = input;

    if (isLogin) {
      nextInput = typeof input === 'string'
        ? LOGIN_QA
        : new Request(LOGIN_QA, input);
    }

    const started = performance.now();
    const response = await nativeFetch(nextInput, init);
    const elapsed = Math.round(performance.now() - started);

    if (isLogin) {
      state.loginFetchMs = elapsed;
      try {
        const body = await response.clone().json();
        state.edge = body?.timings || null;
      } catch {
        state.edge = null;
      }
      publish();
    } else if (isProfile) {
      state.profileFetchMs = elapsed;
      log('[BF AUTH QA PROFILE]', {profile_fetch_ms: elapsed});
      publish();
    }

    return response;
  };

  window.supabase.createClient = function(...args) {
    const client = nativeCreateClient(...args);

    if (client?.auth?.setSession) {
      const nativeSetSession = client.auth.setSession.bind(client.auth);
      client.auth.setSession = async (...sessionArgs) => {
        const started = performance.now();
        const result = await nativeSetSession(...sessionArgs);
        state.setSessionMs = Math.round(performance.now() - started);
        log('[BF AUTH QA SESSION]', {set_session_ms: state.setSessionMs});
        publish();
        return result;
      };
    }

    if (client?.auth?.getSession) {
      const nativeGetSession = client.auth.getSession.bind(client.auth);
      client.auth.getSession = async (...sessionArgs) => {
        const started = performance.now();
        const result = await nativeGetSession(...sessionArgs);
        state.getSessionMs = Math.round(performance.now() - started);
        log('[BF AUTH QA GETSESSION]', {get_session_ms: state.getSessionMs});
        publish();
        return result;
      };
    }

    return client;
  };
})();
