import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ErrorContext } from "./error-context";

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const showError = useCallback((msg: string) => {
    setMessage(msg);
  }, []);

  const dismissError = useCallback(() => {
    setMessage(null);
  }, []);

  const value = useMemo(
    () => ({
      message,
      showError,
      dismissError,
    }),
    [dismissError, message, showError],
  );

  return <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>;
}
