import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "../../lib/supabase";
import {
  getAuthErrorMessage,
  getCurrentProfile,
  getCurrentSession,
  onAuthStateChange,
  signInWithEmail,
  signOut as signOutService,
  signUpWithEmail,
  type AppProfile,
} from "../../services/authService";

export type AppRole = "guest" | "user" | "admin";

type SignUpResult = {
  requiresEmailConfirmation: boolean;
};

type AuthContextValue = {
  user: SupabaseUser | null;
  profile: AppProfile | null;
  role: AppRole;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setUser(null);
      setProfile(null);
      return;
    }

    const session = await getCurrentSession();
    const currentUser = session?.user ?? null;
    setUser(currentUser);
    setProfile(currentUser ? await getCurrentProfile(currentUser.id) : null);
  }, []);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    async function init() {
      if (!isSupabaseConfigured()) {
        if (mounted) {
          setUser(null);
          setProfile(null);
          setError(null);
          setLoading(false);
        }
        return;
      }

      try {
        const session = await getCurrentSession();
        const currentUser = session?.user ?? null;
        const currentProfile = currentUser ? await getCurrentProfile(currentUser.id) : null;

        if (mounted) {
          setUser(currentUser);
          setProfile(currentProfile);
          setError(null);
        }

        subscription = onAuthStateChange((_event, nextSession) => {
          const nextUser = nextSession?.user ?? null;
          setUser(nextUser);
          if (!nextUser) {
            setProfile(null);
            return;
          }

          getCurrentProfile(nextUser.id)
            .then((nextProfile) => setProfile(nextProfile))
            .catch((err) => setError(getAuthErrorMessage(err)));
        });
      } catch (err) {
        if (mounted) {
          setUser(null);
          setProfile(null);
          setError(getAuthErrorMessage(err));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await signInWithEmail({ email, password });
      setUser(result.user);
      setProfile(result.profile);
      setError(null);
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string): Promise<SignUpResult> => {
    setLoading(true);
    try {
      const result = await signUpWithEmail({ name, email, password });
      setUser(result.session ? result.user : null);
      setProfile(result.session ? result.profile : null);
      setError(null);
      return { requiresEmailConfirmation: !result.session };
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await signOutService();
      setUser(null);
      setProfile(null);
      setError(null);
    } catch (err) {
      const message = getAuthErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const role: AppRole = profile?.role === "admin" ? "admin" : user ? "user" : "guest";

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile,
    role,
    isAuthenticated: Boolean(user),
    isAdmin: role === "admin",
    loading,
    error,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  }), [user, profile, role, loading, error, signIn, signUp, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
