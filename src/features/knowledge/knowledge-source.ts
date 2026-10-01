export function resolveKnowledgeSource(input: {
  requested?: string;
  mode?: string;
  deploymentEnv?: string;
  branch?: string;
}): "legacy" | "supabase" {
  // Production remains on legacy until the separate reviewed cutover.
  if (input.deploymentEnv === "production") return "legacy";
  if (input.requested === "legacy") return "legacy";
  if (
    input.requested === "supabase" ||
    input.mode === "r40.5-preview" ||
    (input.deploymentEnv === "preview" && input.branch === "r40.5")
  )
    return "supabase";
  return "legacy";
}
