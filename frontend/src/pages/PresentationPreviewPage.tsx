import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import hljs from "highlight.js/lib/core";
import c from "highlight.js/lib/languages/c";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import "highlight.js/styles/github.css";
import { useNavigate, useParams } from "react-router-dom";
import { getStoreApi } from "../api/store";
import { getElementStyle, withAutoplay } from "../lib/slideDeckUtils";
import { useAuth } from "../hooks/useAuth";
import { useError } from "../hooks/useError";
import {
  resolveSlideBackground,
  slideBackgroundToStyle,
  type Presentation,
  type SlideElement,
} from "../types/presentation";

hljs.registerLanguage("c", c);
hljs.registerLanguage("python", python);
hljs.registerLanguage("javascript", javascript);

export function PresentationPreviewPage() {
  const { token } = useAuth();
  const { showError } = useError();
  const navigate = useNavigate();
  const { presentationId, slideNumber } = useParams();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);

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

  const currentSlideNumber = Math.max(1, Number(slideNumber ?? "1") || 1);
  const slideCount = presentation ? presentation.slides.length : 0;
  const clampedSlideNumber = presentation
    ? Math.min(Math.max(1, currentSlideNumber), presentation.slides.length)
    : currentSlideNumber;
  const currentSlide = presentation?.slides[clampedSlideNumber - 1];

  const prevPreviewSlideRef = useRef(clampedSlideNumber);
  const [previewEnter, setPreviewEnter] = useState<"next" | "prev">("next");

  useEffect(() => {
    if (prevPreviewSlideRef.current !== clampedSlideNumber) {
      setPreviewEnter(clampedSlideNumber > prevPreviewSlideRef.current ? "next" : "prev");
      prevPreviewSlideRef.current = clampedSlideNumber;
    }
  }, [clampedSlideNumber]);

  useEffect(() => {
    if (!presentationId || !presentation) {
      return;
    }
    if (currentSlideNumber !== clampedSlideNumber) {
      navigate(`/preview/${presentationId}/${String(clampedSlideNumber)}`, { replace: true });
    }
  }, [clampedSlideNumber, currentSlideNumber, navigate, presentation, presentationId]);

  const goToSlide = useCallback(
    (next: number) => {
      if (presentationId) {
        navigate(`/preview/${presentationId}/${String(next)}`);
      }
    },
    [navigate, presentationId],
  );

  const handlePrev = useCallback(() => {
    if (clampedSlideNumber > 1) {
      goToSlide(clampedSlideNumber - 1);
    }
  }, [clampedSlideNumber, goToSlide]);

  const handleNext = useCallback(() => {
    if (presentation && clampedSlideNumber < presentation.slides.length) {
      goToSlide(clampedSlideNumber + 1);
    }
  }, [clampedSlideNumber, goToSlide, presentation]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNext, handlePrev]);

  const exitToEditor = () => {
    if (!presentationId) {
      return;
    }
    navigate(`/presentation/${presentationId}/${String(clampedSlideNumber)}`);
  };

  if (loading) {
    return (
      <main className="preview-page">
        <p className="preview-page__lead">Loading preview...</p>
      </main>
    );
  }

  if (!presentation || !currentSlide) {
    return (
      <main className="preview-page">
        <h1 className="preview-page__title">Presentation not found</h1>
        <button onClick={() => navigate("/dashboard")} type="button">
          Back to dashboard
        </button>
      </main>
    );
  }

  const canvasStyle = slideBackgroundToStyle(
    resolveSlideBackground(presentation, currentSlide),
  );

  const sortedElements = currentSlide.elements.slice().sort((a, b) => a.layer - b.layer);

  return (
    <div className="preview-page">
      <header className="preview-page__bar">
        <p className="preview-page__heading">{presentation.name}</p>
        <p className="preview-page__counter">
          Slide {String(clampedSlideNumber)} / {String(slideCount)}
        </p>
        <div className="preview-page__controls">
          <button
            aria-label="Previous slide"
            disabled={clampedSlideNumber <= 1}
            onClick={handlePrev}
            type="button"
          >
            ◀
          </button>
          <button
            aria-label="Next slide"
            disabled={clampedSlideNumber >= slideCount}
            onClick={handleNext}
            type="button"
          >
            ▶
          </button>
          <button onClick={exitToEditor} type="button">
            Exit preview
          </button>
        </div>
      </header>
      <div className="preview-page__shell">
        <div
          className={`preview-page__canvas preview-page__canvas--enter preview-page__canvas--from-${previewEnter}`}
          key={clampedSlideNumber}
          style={canvasStyle}
        >
          {sortedElements.map((element: SlideElement) => {
            if (element.type === "text") {
              return (
                <div
                  className="preview-block preview-block--text"
                  key={element.id}
                  style={{
                    ...getElementStyle(element),
                    color: element.color,
                    fontFamily: element.fontFamily,
                    fontSize: `${String(element.fontSizeEm)}em`,
                  }}
                >
                  {element.content}
                </div>
              );
            }
            if (element.type === "image") {
              return (
                <div
                  className="preview-block preview-block--image"
                  key={element.id}
                  style={getElementStyle(element)}
                >
                  <img alt={element.alt} src={element.src} />
                </div>
              );
            }
            if (element.type === "video") {
              return (
                <div
                  className="preview-block preview-block--video"
                  key={element.id}
                  style={getElementStyle(element)}
                >
                  <iframe
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    src={withAutoplay(element.url, element.autoplay)}
                    title={`video-${element.id}`}
                  />
                </div>
              );
            }
            const highlighted = hljs.highlightAuto(element.code, ["c", "python", "javascript"]).value;
            return (
              <div
                className="preview-block preview-block--code"
                key={element.id}
                style={{ ...getElementStyle(element), fontSize: `${String(element.fontSizeEm)}em` }}
              >
                <pre>
                  <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                </pre>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
