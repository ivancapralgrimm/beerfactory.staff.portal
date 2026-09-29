import { createClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

export const supabase = createClient(
  config.supabaseUrl,
  config.supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
);
