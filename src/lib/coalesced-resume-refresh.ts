type CoalescedResumeRefreshOptions = {
  includeOnline?: boolean;
  debounceMs?: number;
  minIntervalMs?: number;
};

/**
 * Coalesces the burst of focus/visibility/online events produced when a mobile
 * PWA resumes. It never hides refreshes permanently: if an event arrives while
 * a refresh is running, one trailing refresh is queued.
 */
export function installCoalescedResumeRefresh(
  refresh: () => void | Promise<void>,
  options: CoalescedResumeRefreshOptions = {},
) {
  const includeOnline = options.includeOnline === true;
  const debounceMs = options.debounceMs ?? 180;
  const minIntervalMs = options.minIntervalMs ?? 650;

  let disposed = false;
  let timer: number | null = null;
  let running = false;
  let trailing = false;
  let lastStartedAt = 0;

  const schedule = () => {
    if (disposed || document.visibilityState === "hidden") return;

    if (running) {
      trailing = true;
      return;
    }

    if (timer !== null) return;

    const elapsed = Date.now() - lastStartedAt;
    const delay = Math.max(debounceMs, minIntervalMs - elapsed, 0);

    timer = window.setTimeout(() => {
      timer = null;
      if (disposed || document.visibilityState === "hidden") return;

      running = true;
      lastStartedAt = Date.now();

      void Promise.resolve(refresh()).finally(() => {
        running = false;
        if (disposed) return;
        if (trailing) {
          trailing = false;
          schedule();
        }
      });
    }, delay);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") schedule();
  };

  window.addEventListener("focus", schedule);
  document.addEventListener("visibilitychange", onVisibilityChange);
  if (includeOnline) window.addEventListener("online", schedule);

  return () => {
    disposed = true;
    if (timer !== null) window.clearTimeout(timer);
    window.removeEventListener("focus", schedule);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (includeOnline) window.removeEventListener("online", schedule);
  };
}
