import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { fetchStaffProfile, staffLogin } from "@/features/auth/auth-api";
import type { AuthState, AuthUser } from "@/types/auth";

type LoginInput = {
  firstName: string;
  lastName: string;
  code: string;
};

type LoginResult = {
  recoveryConfigured: boolean;
};

type AuthContextValue = {
  state: AuthState;
  login: (input: LoginInput) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  markRecoveryConfigured: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type SessionFailure = {
  status?: number;
  code?: string;
  message?: string;
  fatalSession?: boolean;
};

function mergeUser(session: Session, profile: Awaited<ReturnType<typeof fetchStaffProfile>>) {
  return {
    ...session.user,
    ...(profile ?? {})
  } as AuthUser;
}

function isInvalidRefreshToken(error: unknown) {
  const value = error as SessionFailure | null;
  const code = String(value?.code || "").toLowerCase();
  const message = String(value?.message || "").toLowerCase();

  return (
    value?.fatalSession === true ||
    code.includes("refresh_token_not_found") ||
    code.includes("invalid_refresh_token") ||
    message.includes("refresh token not found") ||
    message.includes("invalid refresh token")
  );
}

function fatalSessionError(code: string) {
  const error = new Error(code);
  Object.assign(error, { fatalSession: true });
  return error;
}

async function clearLocalSession() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Local auth state is cleared by the state transition below even if
    // Supabase cannot complete ancillary cleanup while the network is bad.
  }
}

const AUTH_BOOT_FAIL_OPEN_MS = 12_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "booting",
    session: null,
    user: null
  });

  // Carries the first-login requirement across Supabase auth events.
  // This avoids the old class of bugs where auth state changes faster than routing.
  const recoveryRequiredRef = useRef(false);
  const hydrateGenerationRef = useRef(0);

  const hydrateSession = useCallback(async (session: Session | null) => {
    const generation = ++hydrateGenerationRef.current;
    if (!session) {
      recoveryRequiredRef.current = false;
      setState({ status: "anonymous", session: null, user: null });
      return;
    }

    let currentSession = session;
    try {
      let profile;
      try {
        profile = await fetchStaffProfile(currentSession.access_token);
      } catch (error) {
        if ((error as { status?: number }).status !== 401) throw error;

        // A profile request may finish with an old JWT after Supabase has
        // already refreshed it. Retry before treating the session as lost.
        const current = await supabase.auth.getSession();
        if (generation !== hydrateGenerationRef.current) return;

        let refreshed =
          current.data.session?.access_token !== currentSession.access_token
            ? current.data.session
            : null;

        if (!refreshed) {
          const refresh = await supabase.auth.refreshSession();
          if (generation !== hydrateGenerationRef.current) return;

          if (refresh.error) {
            if (isInvalidRefreshToken(refresh.error)) {
              throw fatalSessionError("session_refresh_token_invalid");
            }
            throw refresh.error;
          }

          refreshed = refresh.data.session;
        }

        if (!refreshed) {
          throw fatalSessionError("session_refresh_unavailable");
        }

        currentSession = refreshed;
        profile = await fetchStaffProfile(currentSession.access_token);
      }

      if (generation !== hydrateGenerationRef.current) return;
      const recoveryRequired =
        recoveryRequiredRef.current || profile?.recovery_configured === false;

      setState({
        status: "authenticated",
        session: currentSession,
        user: mergeUser(currentSession, profile),
        recoveryRequired
      });
    } catch (error) {
      if (generation !== hydrateGenerationRef.current) return;
      const status = (error as SessionFailure).status;

      if (
        isInvalidRefreshToken(error) ||
        status === 401 ||
        status === 403 ||
        status === 404
      ) {
        await clearLocalSession();
        if (generation !== hydrateGenerationRef.current) return;
        recoveryRequiredRef.current = false;
        setState({ status: "anonymous", session: null, user: null });
        return;
      }

      // A temporary profile/network outage must not destroy a valid Auth session
      // or erase the last known profile-based permissions from the UI.
      setState((current) => {
        const previousUser =
          current.status === "authenticated" &&
          current.user.id === currentSession.user.id
            ? current.user
            : null;

        return {
          status: "authenticated",
          session: currentSession,
          user: previousUser ?? (currentSession.user as AuthUser),
          recoveryRequired:
            current.status === "authenticated"
              ? current.recoveryRequired
              : recoveryRequiredRef.current
        };
      });
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Never let the application remain permanently on "Проверяем сессию…".
    // If Supabase session restoration stalls (network, stale refresh token,
    // iOS/PWA resume or browser lock), fail open to the login screen. A later
    // auth event can still restore the authenticated state.
    let bootstrapAbandoned = false;

    const bootFallback = window.setTimeout(() => {
      if (!active) return;
      bootstrapAbandoned = true;

      setState((current) =>
        current.status === "booting"
          ? { status: "anonymous", session: null, user: null }
          : current
      );
    }, AUTH_BOOT_FAIL_OPEN_MS);

    const bootstrapSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!active || bootstrapAbandoned) return;

        if (error && isInvalidRefreshToken(error)) {
          await clearLocalSession();
          if (!active) return;
          await hydrateSession(null);
          return;
        }

        await hydrateSession(data.session);
      } catch (error) {
        if (!active || bootstrapAbandoned) return;

        // A network/bootstrap failure must not trap the user on the splash
        // screen forever. Show login and allow a fresh explicit auth attempt.
        console.warn("BeerFactory auth bootstrap failed", error);
        await hydrateSession(null);
      } finally {
        window.clearTimeout(bootFallback);
      }
    };

    void bootstrapSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      // Keep the callback itself synchronous; hydrate outside Supabase's auth callback.
      setTimeout(() => {
        if (active) void hydrateSession(session);
      }, 0);
    });

    return () => {
      active = false;
      window.clearTimeout(bootFallback);
      listener.subscription.unsubscribe();
    };
  }, [hydrateSession]);

  // Roles and positions are stored in the live profile, not in JWT claims.
  // Refresh on meaningful resume/online events and periodically as a safety net.
  // Five minutes avoids the old 30-second request churn on mobile networks.
  useEffect(() => {
    if (state.status !== "authenticated") return;

    let active = true;
    let refreshing = false;

    const refresh = async () => {
      if (
        !active ||
        refreshing ||
        document.visibilityState === "hidden"
      ) {
        return;
      }

      refreshing = true;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;

        if (data.session) {
          await hydrateSession(data.session);
        } else if (!error || isInvalidRefreshToken(error)) {
          await hydrateSession(null);
        }
      } finally {
        refreshing = false;
      }
    };

    const onFocus = () => {
      void refresh();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    const onOnline = () => {
      void refresh();
    };

    const interval = window.setInterval(() => {
      void refresh();
    }, 5 * 60_000);

    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [state.status, hydrateSession]);

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await staffLogin(input);
      recoveryRequiredRef.current = response.recovery_configured === false;

      const { error } = await supabase.auth.setSession(response.session!);
      if (error) {
        recoveryRequiredRef.current = false;
        throw error;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        recoveryRequiredRef.current = false;
        throw new Error("session_not_persisted");
      }

      await hydrateSession(data.session);

      return {
        recoveryConfigured: !recoveryRequiredRef.current
      };
    },
    [hydrateSession]
  );

  const logout = useCallback(async () => {
    recoveryRequiredRef.current = false;
    await clearLocalSession();
    setState({ status: "anonymous", session: null, user: null });
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await hydrateSession(data.session);
  }, [hydrateSession]);

  const markRecoveryConfigured = useCallback(async () => {
    recoveryRequiredRef.current = false;
    const { data } = await supabase.auth.getSession();
    await hydrateSession(data.session);
  }, [hydrateSession]);

  const value = useMemo(
    () => ({ state, login, logout, refreshProfile, markRecoveryConfigured }),
    [state, login, logout, refreshProfile, markRecoveryConfigured]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
