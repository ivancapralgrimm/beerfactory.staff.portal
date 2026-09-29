import { useCallback, useEffect, useState } from "react";
import {
  getKnowledgeReadState,
  getLocalReadIds,
  markArticleReadRemote,
  markLocalArticleRead
} from "@/features/knowledge/knowledge-progress";
import type {
  KnowledgeProgressSource,
  KnowledgeProgressState
} from "@/features/knowledge/types";

export function useKnowledgeProgress(userId: string) {
  const [state, setState] = useState<KnowledgeProgressState>(() => ({
    readIds: getLocalReadIds(userId),
    source: "device",
    loading: Boolean(userId)
  }));

  useEffect(() => {
    let active = true;

    setState({
      readIds: getLocalReadIds(userId),
      source: "device",
      loading: Boolean(userId)
    });

    if (!userId) return () => undefined;

    void getKnowledgeReadState(userId)
      .then((result) => {
        if (!active) return;
        setState({
          readIds: result.readIds,
          source: result.source,
          loading: false
        });
      })
      .catch(() => {
        if (!active) return;
        setState({
          readIds: getLocalReadIds(userId),
          source: "device",
          loading: false
        });
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const markRead = useCallback(
    async (articleId: string) => {
      const localIds = markLocalArticleRead(userId, articleId);

      setState((current) => ({
        ...current,
        readIds: new Set([...current.readIds, ...localIds])
      }));

      let source: KnowledgeProgressSource = "device";

      try {
        await markArticleReadRemote(userId, articleId);
        source = "profile";
      } finally {
        setState((current) => ({
          ...current,
          source,
          loading: false
        }));
      }

      return source;
    },
    [userId]
  );

  return { state, markRead };
}
