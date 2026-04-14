import { useContext } from "react";
import { ErrorContext } from "../context/error-context";

export function useError() {
  const ctx = useContext(ErrorContext);
  if (ctx === null) {
    throw new Error("useError must be used within ErrorProvider");
  }
  return ctx;
}
