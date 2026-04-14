import { useCallback, useMemo, useState, type ReactNode } from "react";
import { logoutApi } from "../api/auth";
import { AuthContext } from "./auth-context";

const STORAGE_KEY = "presto_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY);
  });

  const signIn = useCallback((newToken: string) => {
    localStorage.setItem(STORAGE_KEY, newToken);
    setToken(newToken);
  }, []);

  const signOut = useCallback(async () => {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      try {
        await logoutApi(current);
      } catch {
        // Still clear local session if the network fails
      }
    }
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      signIn,
      signOut,
    }),
    [signIn, signOut, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
