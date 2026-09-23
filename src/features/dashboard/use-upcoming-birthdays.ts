import {
  useCallback,
  useEffect,
  useState
} from "react";
import {
  loadUpcomingBirthdays
} from "@/features/dashboard/dashboard-api";
import type {
  UpcomingBirthday
} from "@/features/dashboard/types";

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

  const refresh = useCallback(
    async (quiet = false) => {
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

      try {
        const birthdays =
          await loadUpcomingBirthdays();

        setState({
          birthdays,
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
            "Не удалось загрузить ближайшие дни рождения."
        }));
      }
    },
    []
  );

  useEffect(() => {
    void refresh(false);

    const onFocus = () => {
      void refresh(true);
    };

    const onVisibility = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void refresh(true);
      }
    };

    window.addEventListener(
      "focus",
      onFocus
    );

    document.addEventListener(
      "visibilitychange",
      onVisibility
    );

    return () => {
      window.removeEventListener(
        "focus",
        onFocus
      );

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
