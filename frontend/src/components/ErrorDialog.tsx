import { useEffect, useId, useRef } from "react";
import { useError } from "../hooks/useError";

export function ErrorDialog() {
  const { message, dismissError } = useError();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (message) {
      closeRef.current?.focus();
    }
  }, [message]);

  if (!message) {
    return null;
  }

  return (
    <div className="error-dialog-backdrop" role="presentation">
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="error-dialog"
        role="alertdialog"
      >
        <div className="error-dialog__header">
          <h2 className="error-dialog__title" id={titleId}>
            Error
          </h2>
          <button
            ref={closeRef}
            aria-label="Close"
            className="error-dialog__close"
            onClick={dismissError}
            type="button"
          >
            ×
          </button>
        </div>
        <p className="error-dialog__body">{message}</p>
        <div className="error-dialog__footer">
          <button onClick={dismissError} type="button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
