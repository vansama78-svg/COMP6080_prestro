import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStoreApi, putStoreApi } from "../api/store";
import { useAuth } from "../hooks/useAuth";
import { useError } from "../hooks/useError";
import { EMPTY_STORE, type Presentation } from "../types/presentation";

export function DashboardPage() {
  const { signOut, token } = useAuth();
  const { showError } = useError();
  const navigate = useNavigate();
  const [store, setStore] = useState(EMPTY_STORE);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState("");

  const sortedPresentations = useMemo(() => {
    return [...store.presentations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [store.presentations]);

  useEffect(() => {
    if (!token) {
      return;
    }
    const loadStore = async () => {
      setLoading(true);
      try {
        const next = await getStoreApi(token);
        setStore(next);
      } catch (err) {
        showError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    void loadStore();
  }, [showError, token]);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const handleCreatePresentation = async () => {
    if (!token) {
      showError("Session expired. Please log in again.");
      return;
    }
    if (!name.trim()) {
      showError("Presentation name is required.");
      return;
    }

    const now = new Date().toISOString();
    const newPresentation: Presentation = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      thumbnail: thumbnail.trim(),
      slides: [{ id: crypto.randomUUID(), elements: [] }],
      createdAt: now,
      updatedAt: now,
    };

    const nextStore = {
      presentations: [newPresentation, ...store.presentations],
    };

    try {
      await putStoreApi(token, nextStore);
      setStore(nextStore);
      setIsCreateOpen(false);
      setName("");
      setDescription("");
      setThumbnail("");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to create presentation");
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard__bar">
        <h1 className="dashboard__title">Dashboard</h1>
        <div className="dashboard__actions">
          <button onClick={() => setIsCreateOpen(true)} type="button">
            New presentation
          </button>
          <button onClick={handleLogout} type="button">
            Log out
          </button>
        </div>
      </header>
      <main className="page">
        {loading ? (
          <p className="page__lead">Loading presentations...</p>
        ) : sortedPresentations.length === 0 ? (
          <p className="page__lead">No presentations yet. Create your first one.</p>
        ) : (
          <section aria-label="Presentations" className="presentation-grid">
            {sortedPresentations.map((presentation) => (
              <button
                className="presentation-card"
                key={presentation.id}
                onClick={() => navigate(`/presentation/${presentation.id}/1`)}
                type="button"
              >
                {presentation.thumbnail ? (
                  <img
                    alt={`${presentation.name} thumbnail`}
                    className="presentation-card__thumb"
                    src={presentation.thumbnail}
                  />
                ) : (
                  <div aria-label="No thumbnail" className="presentation-card__thumb presentation-card__thumb--empty" />
                )}
                <div className="presentation-card__meta">
                  <h2 className="presentation-card__title">{presentation.name}</h2>
                  <p className="presentation-card__desc">{presentation.description}</p>
                  <p className="presentation-card__slides">
                    Slides: {String(presentation.slides.length)}
                  </p>
                </div>
              </button>
            ))}
          </section>
        )}
      </main>
      {isCreateOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div aria-modal="true" className="modal" role="dialog">
            <h2 className="modal__title">Create presentation</h2>
            <div className="form">
              <div className="form__field">
                <label htmlFor="new-pres-name">Name</label>
                <input
                  id="new-pres-name"
                  onChange={(e) => setName(e.target.value)}
                  type="text"
                  value={name}
                />
              </div>
              <div className="form__field">
                <label htmlFor="new-pres-description">Description</label>
                <input
                  id="new-pres-description"
                  onChange={(e) => setDescription(e.target.value)}
                  type="text"
                  value={description}
                />
              </div>
              <div className="form__field">
                <label htmlFor="new-pres-thumbnail">Thumbnail URL</label>
                <input
                  id="new-pres-thumbnail"
                  onChange={(e) => setThumbnail(e.target.value)}
                  type="url"
                  value={thumbnail}
                />
              </div>
            </div>
            <div className="modal__footer">
              <button onClick={() => setIsCreateOpen(false)} type="button">
                Cancel
              </button>
              <button onClick={handleCreatePresentation} type="button">
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
