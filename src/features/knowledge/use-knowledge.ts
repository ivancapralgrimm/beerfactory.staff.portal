import { useCallback, useEffect, useState } from "react";
import { loadKnowledgeArticles } from "@/features/knowledge/knowledge-data";
import type { KnowledgeArticle } from "@/features/knowledge/types";

type KnowledgeState =
  | { status: "loading"; articles: KnowledgeArticle[]; error: null }
  | { status: "ready"; articles: KnowledgeArticle[]; error: null }
  | { status: "error"; articles: KnowledgeArticle[]; error: Error };

export function useKnowledgeArticles() {
  const [state, setState] = useState<KnowledgeState>({
    status: "loading",
    articles: [],
    error: null
  });

  const load = useCallback(async (force = false) => {
    setState((current) =>
      current.status === "ready"
        ? current
        : { status: "loading", articles: current.articles, error: null }
    );

    try {
      const articles = await loadKnowledgeArticles({ force });
      setState({ status: "ready", articles, error: null });
    } catch (error) {
      setState({
        status: "error",
        articles: [],
        error:
          error instanceof Error
            ? error
            : new Error("knowledge_materials_unavailable")
      });
    }
  }, []);

  useEffect(() => {
    let active = true;

    void loadKnowledgeArticles()
      .then((articles) => {
        if (active) setState({ status: "ready", articles, error: null });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          status: "error",
          articles: [],
          error:
            error instanceof Error
              ? error
              : new Error("knowledge_materials_unavailable")
        });
      });

    return () => {
      active = false;
    };
  }, []);

  return {
    state,
    reload: () => load(true)
  };
}
