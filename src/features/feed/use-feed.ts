import { useCallback, useEffect, useRef, useState } from "react";
import { loadFeed, subscribeToFeed } from "@/features/feed/feed-api";
import type { FeedPost } from "@/features/feed/types";
import { installCoalescedResumeRefresh } from "@/lib/coalesced-resume-refresh";

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
  const activeRef = useRef(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const trailingRefreshRef = useRef<Promise<void> | null>(null);
  const requestGenerationRef = useRef(0);

  const refresh = useCallback((quiet = false): Promise<void> => {
    if (!activeRef.current) return Promise.resolve();

    if (inFlightRef.current) {
      if (!trailingRefreshRef.current) {
        trailingRefreshRef.current = inFlightRef.current
          .catch(() => undefined)
          .then(() => {
            trailingRefreshRef.current = null;
            return refresh(true);
          });
      }
      return trailingRefreshRef.current;
    }

    const generation = ++requestGenerationRef.current;
    setState((current) => ({
      ...current,
      loading: quiet ? current.loading : true,
      refreshing: quiet,
      error: quiet ? current.error : null
    }));

    const request = (async () => {
      try {
        const posts = await loadFeed();
        if (generation !== requestGenerationRef.current) return;
        setState({ posts, loading: false, refreshing: false, error: null });
      } catch {
        if (generation !== requestGenerationRef.current) return;
        setState((current) => ({
          ...current,
          loading: false,
          refreshing: false,
          error: "Не удалось синхронизировать Ленту."
        }));
      }
    })().finally(() => {
      if (inFlightRef.current === request) inFlightRef.current = null;
    });

    inFlightRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    activeRef.current = true;
    void refresh(false);
    const unsubscribe = subscribeToFeed(() => void refresh(true));
    const removeResumeRefresh = installCoalescedResumeRefresh(
      () => refresh(true),
      { includeOnline: true }
    );

    return () => {
      activeRef.current = false;
      requestGenerationRef.current += 1;
      trailingRefreshRef.current = null;
      unsubscribe();
      removeResumeRefresh();
    };
  }, [refresh]);

  return { ...state, refresh };
}
