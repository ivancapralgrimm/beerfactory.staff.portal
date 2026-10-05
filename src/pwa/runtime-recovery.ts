const UPDATE_BANNER_ID = "bf-pwa-update-banner";
const RELOAD_GUARD_KEY = "bf-runtime-reload-at";
const SAFE_STARTUP_UPDATE_MS = 12_000;
const UPDATE_CHECK_INTERVAL_MS = 5 * 60_000;

function guardedReload() {
  const now = Date.now();
  const previous = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);

  if (Number.isFinite(previous) && now - previous < 15_000) {
    return;
  }

  sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
  window.location.reload();
}

function applyWaitingWorker(worker: ServiceWorker) {
  let changed = false;

  const onControllerChange = () => {
    if (changed) return;
    changed = true;
    guardedReload();
  };

  navigator.serviceWorker.addEventListener(
    "controllerchange",
    onControllerChange,
    { once: true }
  );

  worker.postMessage({ type: "SKIP_WAITING" });

  // iOS can occasionally miss controllerchange while restoring a standalone
  // web app. A guarded fallback reload prevents the app from staying stale.
  window.setTimeout(() => {
    if (!changed) guardedReload();
  }, 4_000);
}

function showUpdateBanner(worker: ServiceWorker) {
  if (document.getElementById(UPDATE_BANNER_ID)) return;

  const panel = document.createElement("div");
  panel.id = UPDATE_BANNER_ID;
  panel.setAttribute("role", "status");
  panel.style.cssText = [
    "position:fixed",
    "left:12px",
    "right:12px",
    "bottom:calc(76px + env(safe-area-inset-bottom, 0px))",
    "z-index:9999",
    "display:flex",
    "align-items:center",
    "justify-content:space-between",
    "gap:10px",
    "padding:10px 12px",
    "border:1px solid #8b5636",
    "border-radius:14px",
    "background:#5d321f",
    "color:#fff1d9",
    "box-shadow:0 8px 24px rgba(35,20,12,.28)",
    "font:700 13px/1.25 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
  ].join(";");

  const text = document.createElement("span");
  text.textContent = "Доступна новая версия портала.";

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Обновить";
  button.style.cssText = [
    "min-height:44px",
    "padding:0 14px",
    "border:1px solid rgba(255,241,217,.55)",
    "border-radius:11px",
    "background:#7b4528",
    "color:#fff7e9",
    "font:800 13px/1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
  ].join(";");

  button.addEventListener("click", () => {
    button.disabled = true;
    button.textContent = "Обновляем…";
    applyWaitingWorker(worker);
  });

  panel.append(text, button);
  document.body.append(panel);
}

function handleWaitingWorker(
  worker: ServiceWorker,
  startedAt: number
) {
  if (
    Date.now() - startedAt <= SAFE_STARTUP_UPDATE_MS &&
    document.visibilityState === "visible"
  ) {
    applyWaitingWorker(worker);
    return;
  }

  showUpdateBanner(worker);
}

async function registerPortalServiceWorker(startedAt: number) {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none"
  });

  if (registration.waiting && navigator.serviceWorker.controller) {
    handleWaitingWorker(registration.waiting, startedAt);
  }

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener("statechange", () => {
      if (
        worker.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        handleWaitingWorker(worker, startedAt);
      }
    });
  });

  let lastCheck = 0;
  const check = () => {
    const now = Date.now();
    if (now - lastCheck < UPDATE_CHECK_INTERVAL_MS) return;
    lastCheck = now;
    void registration.update().catch(() => undefined);
  };

  window.addEventListener("online", check);
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });

  check();
}

export function installRuntimeRecovery() {
  if (!import.meta.env.PROD) return;

  const startedAt = Date.now();

  // Vite fires this when an already-open app asks for a lazy chunk that was
  // replaced by a newer deployment. Reload once instead of leaving a dead page.
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    guardedReload();
  });

  window.addEventListener("load", () => {
    void registerPortalServiceWorker(startedAt).catch((error) => {
      console.warn("BeerFactory service worker registration failed", error);
    });
  });
}
