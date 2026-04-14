import { createContext } from "react";

export type ErrorContextValue = {
  message: string | null;
  showError: (_msg: string) => void;
  dismissError: () => void;
};

export const ErrorContext = createContext<ErrorContextValue | null>(null);
