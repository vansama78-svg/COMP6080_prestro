import { createContext } from "react";

export type AuthContextValue = {
  token: string | null;
  isAuthenticated: boolean;
  signIn: (_token: string) => void;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
