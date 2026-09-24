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

function mergeUser(session: Session, profile: Awaited<ReturnType<typeof fetchStaffProfile>>) {
  return {
    ...session.user,
    ...(profile ?? {})
  } as AuthUser;
}

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
        const { data } = await supabase.auth.getSession();
        if (generation !== hydrateGenerationRef.current) return;
        const refreshed = data.session?.access_token !== currentSession.access_token
          ? data.session
          : (await supabase.auth.refreshSession()).data.session;
        if (!refreshed) throw new Error("session_refresh_unavailable");
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
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403 || status === 404) {
        await supabase.auth.signOut();
        if (generation !== hydrateGenerationRef.current) return;
        recoveryRequiredRef.current = false;
        setState({ status: "anonymous", session: null, user: null });
        return;
      }

      // A temporary profile/network outage must not destroy a valid Auth session.
      setState({
        status: "authenticated",
        session: currentSession,
        user: currentSession.user as AuthUser,
        recoveryRequired: recoveryRequiredRef.current
      });
    }
  }, []);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      void hydrateSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      // Keep the callback itself synchronous; hydrate outside Supabase's auth callback.
      setTimeout(() => {
        if (active) void hydrateSession(session);
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [hydrateSession]);

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
    await supabase.auth.signOut();
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
