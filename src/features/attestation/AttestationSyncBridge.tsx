import { useEffect } from "react";
import { warmAttestationBank } from "@/features/attestation/attestation-data";
import { syncPendingAttestationAttempts } from "@/features/attestation/attestation-history";

const SYNC_THROTTLE_MS = 5_000;

export function AttestationSyncBridge({
  userId
}: {
  userId: string;
}) {
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    let active = true;
    let running = false;
    let lastRun = 0;

    async function sync(refreshBank: boolean, force = false) {
      if (!active || running) return;

      const now = Date.now();
      if (!force && now - lastRun < SYNC_THROTTLE_MS) return;

      running = true;
      lastRun = now;

      try {
        await syncPendingAttestationAttempts(userId).catch(() => undefined);

        if (refreshBank && active) {
          await warmAttestationBank();
        }
      } finally {
        running = false;
      }
    }

    const onOnline = () => void sync(true, true);
    const onFocus = () => void sync(false);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void sync(false);
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    void sync(true, true);

    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [userId]);

  return null;
}
