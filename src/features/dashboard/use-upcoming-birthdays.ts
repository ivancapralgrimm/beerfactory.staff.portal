import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {
  loadUpcomingBirthdays
} from "@/features/dashboard/dashboard-api";
import type {
  UpcomingBirthday
} from "@/features/dashboard/types";
import { installCoalescedResumeRefresh } from "@/lib/coalesced-resume-refresh";

type BirthdayState = {
  birthdays: UpcomingBirthday[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

export function useUpcomingBirthdays() {
  const [state, setState] =
    useState<BirthdayState>({
      birthdays: [],
      loading: true,
      refreshing: false,
      error: null
    });
  const inFlightRef = useRef<Promise<void> | null>(null);
  const requestGenerationRef = useRef(0);

  const refresh = useCallback(
    (quiet = false) => {
      if (inFlightRef.current) return inFlightRef.current;

      const generation = ++requestGenerationRef.current;
      setState((current) => ({
        ...current,
        loading:
          quiet
            ? current.loading
            : true,
        refreshing: quiet,
        error:
          quiet
            ? current.error
            : null
      }));

      const request = (async () => {
        try {
          const birthdays =
            await loadUpcomingBirthdays();

          if (generation !== requestGenerationRef.current) return;
          setState({
            birthdays,
            loading: false,
            refreshing: false,
            error: null
          });
        } catch {
          if (generation !== requestGenerationRef.current) return;
          setState((current) => ({
            ...current,
            loading: false,
            refreshing: false,
            error:
              "Не удалось загрузить ближайшие дни рождения."
          }));
        }
      })().finally(() => {
        if (inFlightRef.current === request) inFlightRef.current = null;
      });

      inFlightRef.current = request;
      return request;
    },
    []
  );

  useEffect(() => {
    void refresh(false);
    const removeResumeRefresh = installCoalescedResumeRefresh(
      () => refresh(true)
    );

    return () => {
      requestGenerationRef.current += 1;
      removeResumeRefresh();
    };
  }, [refresh]);

  return {
    ...state,
    refresh
  };
}
