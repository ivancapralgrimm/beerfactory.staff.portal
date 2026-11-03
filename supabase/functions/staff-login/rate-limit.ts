type RateLimitResult = { data: unknown; error: unknown; status: number };
type RateLimitClient = {
  rpc(name: "login_rate_limit_allowed", args: { p_fingerprint: string; p_limit: number }): {
    abortSignal(signal: AbortSignal): PromiseLike<RateLimitResult>;
  };
};

/** Retry only the read-only gate, never a denied limit or a credential check.
 * The live gateway intermittently returns 401 for the first service RPC.
 * Persistent gateway/configuration failures must stay closed as unavailable.
 */
export async function readLoginRateLimit(
  client: RateLimitClient,
  fingerprint: string,
  limit: number,
): Promise<"allowed" | "blocked" | "unavailable"> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await client.rpc("login_rate_limit_allowed", {
        p_fingerprint: fingerprint,
        p_limit: limit,
      }).abortSignal(AbortSignal.timeout(4_000));

      if (!result.error) {
        if (result.data === true) return "allowed";
        if (result.data === false) return "blocked";
        return "unavailable";
      }

      const transient = result.status === 0 || result.status === 401 ||
        result.status === 408 || result.status >= 500;
      if (!transient) return "unavailable";
    } catch {
      // A single retry is safe because this RPC only reads limit state.
    }
    if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 150));
  }
  return "unavailable";
}
