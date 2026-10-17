export function resolveKnowledgeSource(input: {
  requested?: string;
  mode?: string;
  deploymentEnv?: string;
}): "legacy" | "supabase" {
  // Legacy is an explicit emergency rollback. Production and preview builds
  // use the server-authoritative Knowledge implementation by default.
  if (input.requested === "legacy") return "legacy";
  if (input.requested === "supabase") return "supabase";
  if (input.mode === "production" || input.mode === "preview")
    return "supabase";
  if (input.deploymentEnv === "preview") return "supabase";
  return "legacy";
}
