const fallbackSupabaseUrl = "https://oltbkrvernfgymxtsfys.supabase.co";
const fallbackPublishableKey = "sb_publishable_XRYEGvajuz1wSEyWlD6qRQ_3yTTid0p";

export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl,
  supabasePublishableKey:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || fallbackPublishableKey,
  recipeApiBase:
    import.meta.env.VITE_RECIPE_API_BASE ||
    "https://beerfactory-menu-api.ivan-capral-grimm.workers.dev"
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
