import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useKnowledgeEditorAccess } from "./use-editor-access";

export type KnowledgeLifecycleCapabilities = {
  knowledgeLifecycle: boolean;
  knowledgeUnderline: boolean;
  knowledgeMediaCleanup: boolean;
};
const unavailable: KnowledgeLifecycleCapabilities = {knowledgeLifecycle: false, knowledgeUnderline: false, knowledgeMediaCleanup: false};

export async function loadKnowledgeLifecycleCapabilities(): Promise<KnowledgeLifecycleCapabilities> {
  try {
    const {data, error} = await supabase.rpc("get_material_lifecycle_capabilities");
    if (!error && data?.schemaVersion === 1) return {
      knowledgeLifecycle: data.knowledgeLifecycle === true,
      knowledgeUnderline: data.knowledgeUnderline === true,
      knowledgeMediaCleanup: data.knowledgeMediaCleanup === true,
    };
  } catch { /* An absent or unavailable capability always closes destructive actions. */ }
  return unavailable;
}

/** Older servers do not expose this RPC. Never infer cascade safety from ordinary edit permission. */
export function useKnowledgeLifecycleCapabilities() {
  const access = useKnowledgeEditorAccess();
  const scope = access.userId;
  const [result, setResult] = useState<{scope: string; capabilities: KnowledgeLifecycleCapabilities}>({scope: "", capabilities: unavailable});
  useEffect(() => {
    if (!scope || !access.hasEditorAccess) return;
    let active = true, generation = 0;
    async function check() {
      const current = ++generation;
      const capabilities = await loadKnowledgeLifecycleCapabilities();
      if (active && current === generation) setResult({scope, capabilities});
    }
    void check();
    const visible = () => { if (document.visibilityState === "visible") void check(); };
    window.addEventListener("focus", visible);
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; window.removeEventListener("focus", visible); window.removeEventListener("online", visible); document.removeEventListener("visibilitychange", visible); };
  }, [scope, access.hasEditorAccess]);
  return scope && result.scope === scope && access.hasEditorAccess ? result.capabilities : unavailable;
}
