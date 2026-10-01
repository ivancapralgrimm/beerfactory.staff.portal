import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { knowledgeSource, loadKnowledgeArticles } from "./knowledge-data";
import type { KnowledgeArticle } from "./types";

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
      setState({ status: "loading", articles: [], error: null });
      try {
        const articles = await loadKnowledgeArticles({ force, scope });
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
    const refresh = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    window.addEventListener("bf-knowledge-changed", refresh);
    if (knowledgeSource === "supabase") {
      window.addEventListener("focus", refresh);
      window.addEventListener("online", refresh);
      document.addEventListener("visibilitychange", refresh);
    }
    return () => {
      active.current = false;
      generation.current++;
      window.removeEventListener("bf-knowledge-changed", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
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
