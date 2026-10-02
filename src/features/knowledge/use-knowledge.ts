import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { knowledgeSource, loadKnowledgeArticles } from "./knowledge-data";
import type { KnowledgeArticle } from "./types";
import { installCoalescedResumeRefresh } from "@/lib/coalesced-resume-refresh";

type KnowledgeState =
  | { status: "loading"; articles: KnowledgeArticle[]; error: null }
  | { status: "ready"; articles: KnowledgeArticle[]; error: null }
  | { status: "error"; articles: KnowledgeArticle[]; error: Error };

export function useKnowledgeArticles() {
  const { state: auth } = useAuth();
  const scope =
    auth.status === "authenticated"
      ? `${auth.user.id}:${auth.user.role}:${auth.user.is_owner}:${auth.user.is_active}`
      : "";
  const [state, setState] = useState<KnowledgeState>({
    status: "loading",
    articles: [],
    error: null,
  });
  const generation = useRef(0);
  const loadedScope = useRef(scope);
  const active = useRef(false);

  const load = useCallback(
    async (force = false) => {
      const current = ++generation.current;
      loadedScope.current = scope;
      setState((previous) =>
        force && previous.status === "ready"
          ? previous
          : { status: "loading", articles: [], error: null },
      );

      try {
        const articles = await loadKnowledgeArticles({
          force,
          scope,
          onMediaReady: (withMedia) => {
            if (active.current && current === generation.current) {
              setState({ status: "ready", articles: withMedia, error: null });
            }
          },
        });
        if (active.current && current === generation.current)
          setState({ status: "ready", articles, error: null });
      } catch (error) {
        if (active.current && current === generation.current)
          setState({
            status: "error",
            articles: [],
            error:
              error instanceof Error
                ? error
                : new Error("knowledge_materials_unavailable"),
          });
      }
    },
    [scope],
  );

  useEffect(() => {
    active.current = true;
    void load();

    const onKnowledgeChanged = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    window.addEventListener("bf-knowledge-changed", onKnowledgeChanged);

    const onMediaReady = (event: Event) => {
      const detail = (event as CustomEvent<{
        scope: string;
        articles: KnowledgeArticle[];
      }>).detail;
      if (!detail || detail.scope !== scope || !active.current) return;
      setState({ status: "ready", articles: detail.articles, error: null });
    };
    window.addEventListener("bf-knowledge-media-ready", onMediaReady);

    const removeResumeRefresh =
      knowledgeSource === "supabase"
        ? installCoalescedResumeRefresh(() => load(true), {
            includeOnline: true,
          })
        : () => undefined;

    return () => {
      active.current = false;
      generation.current++;
      window.removeEventListener("bf-knowledge-changed", onKnowledgeChanged);
      window.removeEventListener("bf-knowledge-media-ready", onMediaReady);
      removeResumeRefresh();
    };
  }, [load]);

  return {
    state:
      loadedScope.current === scope
        ? state
        : { status: "loading" as const, articles: [], error: null },
    reload: () => load(true),
  };
}
