import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "user";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: Role | null;
  isLoading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadRole = async (uid: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .order("role", { ascending: true });
    if (data && data.length) {
      // admin > user (alphabetical: admin first)
      const hasAdmin = data.some((r) => r.role === "admin");
      setRole(hasAdmin ? "admin" : "user");
    } else {
      setRole(null);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setIsLoading(true);
        // defer to avoid recursion warnings
        setTimeout(() => {
          loadRole(s.user.id).finally(() => setIsLoading(false));
        }, 0);
      } else {
        setRole(null);
        setIsLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadRole(s.user.id).finally(() => setIsLoading(false));
      else setIsLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    role,
    isLoading,
    isAdmin: role === "admin",
    isAuthenticated: !!session,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshRole: async () => {
      if (session?.user) await loadRole(session.user.id);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
