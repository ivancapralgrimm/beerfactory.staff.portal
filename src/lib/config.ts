const fallbackSupabaseUrl = "https://oltbkrvernfgymxtsfys.supabase.co";
const fallbackPublishableKey = "sb_publishable_XRYEGvajuz1wSEyWlD6qRQ_3yTTid0p";
const directRecipeApiBase =
  "https://beerfactory-menu-api.ivan-capral-grimm.workers.dev";

function defaultRecipeApiBase() {
  if (typeof window === "undefined") return directRecipeApiBase;

  // Vercel production/previews use a same-origin external rewrite so Russian
  // clients do not need to connect to workers.dev directly for recipe traffic.
  if (/\.vercel\.app$/i.test(window.location.hostname)) {
    return "/api/recipes";
  }

  // Render stays a static backup and therefore uses the Worker directly.
  return directRecipeApiBase;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/u, "");
}

export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl,
  supabasePublishableKey:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || fallbackPublishableKey,
  recipeApiBase: trimTrailingSlash(
    import.meta.env.VITE_RECIPE_API_BASE || defaultRecipeApiBase()
  ),
  recipeApiFallbackBase: directRecipeApiBase
} as const;

export const edgeFunctions = {
  login: `${config.supabaseUrl}/functions/v1/staff-login`,
  register: `${config.supabaseUrl}/functions/v1/staff-register`,
  recover: `${config.supabaseUrl}/functions/v1/staff-recover`,
  setRecovery: `${config.supabaseUrl}/functions/v1/staff-set-recovery`,
  profile: `${config.supabaseUrl}/functions/v1/staff-profile`,
  adminUsers: `${config.supabaseUrl}/functions/v1/staff-admin-users`,
  handoverPush: `${config.supabaseUrl}/functions/v1/handover-push`
} as const;
