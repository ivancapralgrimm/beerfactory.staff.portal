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

  const hydrateSession = useCallback(async (session: Session | null) => {
    if (!session) {
      recoveryRequiredRef.current = false;
      setState({ status: "anonymous", session: null, user: null });
      return;
    }

    try {
      const profile = await fetchStaffProfile(session.access_token);
      const recoveryRequired =
        recoveryRequiredRef.current || profile?.recovery_configured === false;

      setState({
        status: "authenticated",
        session,
        user: mergeUser(session, profile),
        recoveryRequired
      });
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403 || status === 404) {
        await supabase.auth.signOut();
        recoveryRequiredRef.current = false;
        setState({ status: "anonymous", session: null, user: null });
        return;
      }

      // A temporary profile/network outage must not destroy a valid Auth session.
      setState({
        status: "authenticated",
        session,
        user: session.user as AuthUser,
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
