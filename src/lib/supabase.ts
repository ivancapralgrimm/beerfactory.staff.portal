import { createClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

const SUPABASE_HTTP_TIMEOUT_MS = 15_000;

async function boundedSupabaseFetch(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  const onUpstreamAbort = () => controller.abort();

  if (upstreamSignal?.aborted) {
    controller.abort();
  } else {
    upstreamSignal?.addEventListener("abort", onUpstreamAbort, { once: true });
  }

  const timeout = window.setTimeout(
    () => controller.abort(),
    SUPABASE_HTTP_TIMEOUT_MS
  );

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeout);
    upstreamSignal?.removeEventListener("abort", onUpstreamAbort);
  }
}

export const supabase = createClient(
  config.supabaseUrl,
  config.supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    },
    global: {
      fetch: boundedSupabaseFetch
    }
  }
);
