import { useCallback, useEffect, useState } from "react";
import { loadFeed, subscribeToFeed } from "@/features/feed/feed-api";
import type { FeedPost } from "@/features/feed/types";

type FeedState = {
  posts: FeedPost[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

export function useFeed() {
  const [state, setState] = useState<FeedState>({
    posts: [],
    loading: true,
    refreshing: false,
    error: null
  });

  const refresh = useCallback(async (quiet = false) => {
    setState((current) => ({
      ...current,
      loading: quiet ? current.loading : true,
      refreshing: quiet,
      error: quiet ? current.error : null
    }));

    try {
      const posts = await loadFeed();
      setState({ posts, loading: false, refreshing: false, error: null });
    } catch {
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        error: "Не удалось синхронизировать Ленту."
      }));
    }
  }, []);

  useEffect(() => {
    void refresh(false);
    const unsubscribe = subscribeToFeed(() => void refresh(true));
    const onFocus = () => void refresh(true);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  return { ...state, refresh };
}
