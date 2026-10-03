const TEST_QUERY = "bf_failover_test";
const TEST_FALLBACK_ORIGIN = "https://bfstaff-r405.onrender.com";
const PRODUCTION_FALLBACK_ORIGIN = "https://bfstaff.onrender.com";

// Test package: real automatic failover is intentionally OFF.
// After visual QA, this can be flipped in a separate production patch.
const ENABLE_REAL_FAILOVER = false;

const TEST_REDIRECT_DELAY_MS = 900;
const ORIGIN_PROBE_TIMEOUT_MS = 2500;
const FALLBACK_PROBE_TIMEOUT_MS = 2500;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("timeout")), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function targetUrl(origin: string) {
  const current = new URL(window.location.href);
  const target = new URL(origin);

  current.protocol = target.protocol;
  current.host = target.host;
  current.searchParams.delete(TEST_QUERY);

  return current.toString();
}

function redirectTo(origin: string) {
  if (window.location.origin === origin) return;
  window.location.replace(targetUrl(origin));
}

async function currentOriginResponds() {
  const probe = `${window.location.origin}/__bf_origin_probe__?t=${Date.now()}`;

  try {
    await withTimeout(
      fetch(probe, {
        method: "HEAD",
        cache: "no-store",
        credentials: "omit",
      }),
      ORIGIN_PROBE_TIMEOUT_MS,
    );
    // Any HTTP response, including 404, proves that the origin is reachable.
    return true;
  } catch {
    return false;
  }
}

async function fallbackOriginResponds() {
  const probe = `${PRODUCTION_FALLBACK_ORIGIN}/assets/icons/icon-192.png?bf_probe=${Date.now()}`;

  try {
    await withTimeout(
      fetch(probe, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        credentials: "omit",
      }),
      FALLBACK_PROBE_TIMEOUT_MS,
    );
    return true;
  } catch {
    return false;
  }
}

async function runRealFailoverProbe() {
  if (window.location.origin === PRODUCTION_FALLBACK_ORIGIN) return;
  if (await currentOriginResponds()) return;
  if (!(await fallbackOriginResponds())) return;

  redirectTo(PRODUCTION_FALLBACK_ORIGIN);
}

export function installHostFailover() {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);

  // Reversible visual QA: append ?bf_failover_test=1 before the hash route.
  // Example: https://preview.example/?bf_failover_test=1#/
  if (params.get(TEST_QUERY) === "1") {
    window.setTimeout(
      () => redirectTo(TEST_FALLBACK_ORIGIN),
      TEST_REDIRECT_DELAY_MS,
    );
    return;
  }

  if (!ENABLE_REAL_FAILOVER) return;

  const run = () => {
    window.setTimeout(() => {
      void runRealFailoverProbe();
    }, 300);
  };

  if (document.readyState === "complete") {
    run();
  } else {
    window.addEventListener("load", run, { once: true });
  }
}
