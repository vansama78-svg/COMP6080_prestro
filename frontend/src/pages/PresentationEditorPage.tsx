import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getStoreApi, putStoreApi } from "../api/store";
import { useAuth } from "../hooks/useAuth";
import { useError } from "../hooks/useError";
import { type Presentation } from "../types/presentation";

export function PresentationEditorPage() {
  const { token } = useAuth();
  const { showError } = useError();
  const navigate = useNavigate();
  const { presentationId, slideNumber } = useParams();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const currentSlideNumber = Math.max(1, Number(slideNumber ?? "1") || 1);

  useEffect(() => {
    if (!token) {
      return;
    }
    const loadStore = async () => {
      setLoading(true);
      try {
        const store = await getStoreApi(token);
        setPresentations(store.presentations);
      } catch (err) {
        showError(err instanceof Error ? err.message : "Failed to load presentation");
      } finally {
        setLoading(false);
      }
    };
    void loadStore();
  }, [showError, token]);

  const presentation = useMemo(() => {
    return presentations.find((item) => item.id === presentationId);
  }, [presentationId, presentations]);

  const handleDeletePresentation = async () => {
    if (!token || !presentation) {
      return;
    }
    const nextPresentations = presentations.filter((item) => item.id !== presentation.id);
    try {
      await putStoreApi(token, { presentations: nextPresentations });
      navigate("/dashboard");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete presentation");
    }
  };

  if (loading) {
    return (
      <main className="page">
        <p className="page__lead">Loading presentation...</p>
      </main>
    );
  }

  if (!presentation) {
    return (
      <main className="page">
        <h1 className="page__title">Presentation not found</h1>
        <button onClick={() => navigate("/dashboard")} type="button">
          Back to dashboard
        </button>
      </main>
    );
  }

  return (
    <div className="editor">
      <header className="dashboard__bar">
        <button onClick={() => navigate("/dashboard")} type="button">
          Back
        </button>
        <h1 className="dashboard__title">{presentation.name}</h1>
        <button onClick={() => setConfirmDeleteOpen(true)} type="button">
          Delete Presentation
        </button>
      </header>
      <main className="page">
        <div className="slide-deck">
          <p className="slide-deck__label">Slide {String(currentSlideNumber)}</p>
          <div className="slide-deck__canvas" />
        </div>
      </main>
      {confirmDeleteOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div aria-modal="true" className="modal" role="dialog">
            <h2 className="modal__title">Are you sure?</h2>
            <p>This will permanently delete this presentation.</p>
            <div className="modal__footer">
              <button onClick={() => setConfirmDeleteOpen(false)} type="button">
                No
              </button>
              <button onClick={handleDeletePresentation} type="button">
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
