import {
  useCallback,
  useEffect,
  useState
} from "react";
import {
  loadHandoverFeed,
  subscribeToHandovers
} from "@/features/handover/handover-api";
import type {
  HandoverNote
} from "@/features/handover/types";

type HandoverFeedState = {
  notes: HandoverNote[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

export function useHandoverFeed() {
  const [state, setState] =
    useState<HandoverFeedState>({
      notes: [],
      loading: true,
      refreshing: false,
      error: null
    });

  const refresh = useCallback(
    async (quiet = false) => {
      setState((current) => ({
        ...current,
        loading: quiet ? current.loading : true,
        refreshing: quiet,
        error: quiet ? current.error : null
      }));

      try {
        const notes = await loadHandoverFeed();

        setState({
          notes,
          loading: false,
          refreshing: false,
          error: null
        });
      } catch {
        setState((current) => ({
          ...current,
          loading: false,
          refreshing: false,
          error:
            "Не удалось синхронизировать передачу смены."
        }));
      }
    },
    []
  );

  useEffect(() => {
    void refresh(false);

    const unsubscribe =
      subscribeToHandovers(() => {
        void refresh(true);
      });

    const onFocus = () => void refresh(true);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh(true);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener(
      "visibilitychange",
      onVisibility
    );

    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener(
        "visibilitychange",
        onVisibility
      );
    };
  }, [refresh]);

  return {
    ...state,
    refresh
  };
}
