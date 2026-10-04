import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import {
  loadKnowledgeEditorContext,
  type KnowledgeEditorContext,
} from "./knowledge-editor-api";

// Server capabilities are authoritative; working position never grants editing.
export function useKnowledgeEditorAccess() {
  const { state } = useAuth();
  const user = state.status === "authenticated" ? state.user : null;
  const candidate = !!user && user.is_active !== false;
  const userId = user?.id || "";
  const scope = `${userId}:${user?.role}:${user?.is_owner}:${user?.is_active}`;
  const [result, setResult] = useState<{
    scope: string;
    status: "loading" | "allowed" | "denied" | "error";
    context?: KnowledgeEditorContext;
  }>({ scope: "", status: "loading" });
  useEffect(() => {
    if (!candidate) return;
    let active = true,
      generation = 0;
    async function check() {
      const current = ++generation;
      try {
        const context = await loadKnowledgeEditorContext();
        if (active && current === generation)
          setResult({
            scope,
            context,
            status:
              context.can_create || context.can_edit || context.can_publish
                ? "allowed"
                : "denied",
          });
      } catch {
        if (active && current === generation)
          setResult({ scope, status: "error" });
      }
    }
    void check();
    const visible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const timer = window.setInterval(visible, 30_000);
    window.addEventListener("focus", visible);
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", visible);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [candidate, scope]);
  const status = !candidate
    ? "denied"
    : result.scope !== scope
      ? "loading"
      : result.status;
  const context =
    candidate &&
    result.scope === scope &&
    (status === "allowed" || status === "denied")
      ? result.context
      : undefined;
  return {
    status,
    userId,
    hasEditorAccess: status === "allowed",
    canRead: !!context?.can_read,
    canCreate: !!context?.can_create,
    canEdit: !!context?.can_edit,
    canPublish: !!context?.can_publish,
    canManagePermissions: !!context?.can_manage_permissions,
  };
}
