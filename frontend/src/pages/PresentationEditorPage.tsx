import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import hljs from "highlight.js/lib/core";
import c from "highlight.js/lib/languages/c";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import "highlight.js/styles/github.css";
import { useNavigate, useParams } from "react-router-dom";
import { getStoreApi, putStoreApi } from "../api/store";
import { getElementStyle, withAutoplay } from "../lib/slideDeckUtils";
import { useAuth } from "../hooks/useAuth";
import { useError } from "../hooks/useError";
import {
  DEFAULT_SLIDE_BACKGROUND,
  FONT_CHOICES,
  defaultFontFamily,
  resolveSlideBackground,
  slideBackgroundToStyle,
  type CodeElement,
  type ImageElement,
  type Presentation,
  type Slide,
  type SlideBackground,
  type SlideElement,
  type TextElement,
  type VideoElement,
} from "../types/presentation";

hljs.registerLanguage("c", c);
hljs.registerLanguage("python", python);
hljs.registerLanguage("javascript", javascript);

type TextForm = {
  width: string;
  height: string;
  content: string;
  fontSizeEm: string;
  color: string;
  fontFamily: string;
  x: string;
  y: string;
};

type ImageForm = {
  width: string;
  height: string;
  src: string;
  alt: string;
  x: string;
  y: string;
};

type VideoForm = {
  width: string;
  height: string;
  url: string;
  autoplay: boolean;
  x: string;
  y: string;
};

type CodeForm = {
  width: string;
  height: string;
  code: string;
  fontSizeEm: string;
  x: string;
  y: string;
};

type BgDraft = {
  kind: "solid" | "gradient" | "image";
  solid: string;
  gradFrom: string;
  gradTo: string;
  gradDir: "tb" | "lr";
  imageSrc: string;
};

const GRAD_ANGLE: Record<BgDraft["gradDir"], number> = { tb: 180, lr: 90 };

function backgroundToDraft(bg: SlideBackground): BgDraft {
  if (bg.kind === "solid") {
    return {
      kind: "solid",
      solid: bg.color,
      gradFrom: "#ffffff",
      gradTo: "#000000",
      gradDir: "tb",
      imageSrc: "",
    };
  }
  if (bg.kind === "gradient") {
    const gradDir = bg.angleDeg === 90 ? "lr" : "tb";
    return {
      kind: "gradient",
      solid: "#ffffff",
      gradFrom: bg.from,
      gradTo: bg.to,
      gradDir,
      imageSrc: "",
    };
  }
  return {
    kind: "image",
    solid: "#ffffff",
    gradFrom: "#ffffff",
    gradTo: "#000000",
    gradDir: "tb",
    imageSrc: bg.src,
  };
}

function draftToBackground(d: BgDraft): SlideBackground {
  if (d.kind === "solid") {
    return { kind: "solid", color: d.solid };
  }
  if (d.kind === "gradient") {
    return { kind: "gradient", from: d.gradFrom, to: d.gradTo, angleDeg: GRAD_ANGLE[d.gradDir] };
  }
  return { kind: "image", src: d.imageSrc.trim() };
}

const DEFAULT_TEXT_FORM: TextForm = {
  width: "40",
  height: "20",
  content: "",
  fontSizeEm: "1",
  color: "#000000",
  fontFamily: defaultFontFamily(),
  x: "0",
  y: "0",
};

const DEFAULT_IMAGE_FORM: ImageForm = {
  width: "40",
  height: "30",
  src: "",
  alt: "",
  x: "0",
  y: "0",
};

const DEFAULT_VIDEO_FORM: VideoForm = {
  width: "50",
  height: "35",
  url: "",
  autoplay: false,
  x: "0",
  y: "0",
};

const DEFAULT_CODE_FORM: CodeForm = {
  width: "45",
  height: "35",
  code: "",
  fontSizeEm: "1",
  x: "0",
  y: "0",
};

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function parsePercentInput(raw: string, label: string): number {
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0 || n > 100) {
    throw new Error(`${label} must be a number between 0 and 100.`);
  }
  return n;
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

export function PresentationEditorPage() {
  const { token } = useAuth();
  const { showError } = useError();
  const navigate = useNavigate();
  const { presentationId, slideNumber } = useParams();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [editMetaOpen, setEditMetaOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftThumbnail, setDraftThumbnail] = useState("");
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [slidePanelOpen, setSlidePanelOpen] = useState(false);
  const [textForm, setTextForm] = useState<TextForm>(DEFAULT_TEXT_FORM);
  const [imageForm, setImageForm] = useState<ImageForm>(DEFAULT_IMAGE_FORM);
  const [videoForm, setVideoForm] = useState<VideoForm>(DEFAULT_VIDEO_FORM);
  const [codeForm, setCodeForm] = useState<CodeForm>(DEFAULT_CODE_FORM);
  const [defDraft, setDefDraft] = useState<BgDraft>(() => backgroundToDraft(DEFAULT_SLIDE_BACKGROUND));
  const [slideDraft, setSlideDraft] = useState<BgDraft>(() => backgroundToDraft(DEFAULT_SLIDE_BACKGROUND));
  const [slideBgCustom, setSlideBgCustom] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);

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

  const slideCount = presentation ? presentation.slides.length : 0;
  const clampedSlideNumber = presentation
    ? Math.min(Math.max(1, currentSlideNumber), presentation.slides.length)
    : currentSlideNumber;
  const currentSlide = presentation?.slides[clampedSlideNumber - 1];

  useEffect(() => {
    if (!presentationId || !presentation) {
      return;
    }
    if (currentSlideNumber !== clampedSlideNumber) {
      navigate(`/presentation/${presentationId}/${String(clampedSlideNumber)}`, { replace: true });
    }
  }, [clampedSlideNumber, currentSlideNumber, navigate, presentation, presentationId]);

  const savePresentations = async (nextPresentations: Presentation[]) => {
    if (!token) {
      showError("Session expired. Please log in again.");
      return;
    }
    await putStoreApi(token, { presentations: nextPresentations });
    setPresentations(nextPresentations);
  };

  const saveCurrentSlideElements = async (nextElements: SlideElement[]) => {
    if (!presentation || !currentSlide) {
      return;
    }
    const now = new Date().toISOString();
    const nextSlides = presentation.slides.map((slide) =>
      slide.id === currentSlide.id ? { ...slide, elements: nextElements } : slide,
    );
    const nextPresentation: Presentation = {
      ...presentation,
      slides: nextSlides,
      updatedAt: now,
    };
    const nextPresentations = presentations.map((item) =>
      item.id === presentation.id ? nextPresentation : item,
    );
    await savePresentations(nextPresentations);
  };

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

  const openEditMeta = () => {
    if (!presentation) {
      return;
    }
    setDraftName(presentation.name);
    setDraftThumbnail(presentation.thumbnail);
    setEditMetaOpen(true);
  };

  const handleSaveMeta = async () => {
    if (!presentationId || !presentation) {
      return;
    }
    if (!draftName.trim()) {
      showError("Presentation name is required.");
      return;
    }
    const now = new Date().toISOString();
    const nextPresentations = presentations.map((item) =>
      item.id !== presentation.id
        ? item
        : { ...item, name: draftName.trim(), thumbnail: draftThumbnail.trim(), updatedAt: now },
    );
    try {
      await savePresentations(nextPresentations);
      setEditMetaOpen(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to update presentation");
    }
  };

  const goToSlide = useCallback(
    (next: number) => {
      if (presentationId) {
        navigate(`/presentation/${presentationId}/${String(next)}`);
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

  const handleAddSlide = async () => {
    if (!presentation) {
      return;
    }
    const now = new Date().toISOString();
    const nextPresentation: Presentation = {
      ...presentation,
      slides: [...presentation.slides, { id: crypto.randomUUID(), elements: [] }],
      updatedAt: now,
    };
    const nextPresentations = presentations.map((item) =>
      item.id === presentation.id ? nextPresentation : item,
    );
    try {
      await savePresentations(nextPresentations);
      goToSlide(nextPresentation.slides.length);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to add slide");
    }
  };

  const handleDeleteSlide = async () => {
    if (!presentation) {
      return;
    }
    if (presentation.slides.length === 1) {
      showError("Cannot delete the only slide. Please delete the presentation instead.");
      return;
    }
    const now = new Date().toISOString();
    const index = clampedSlideNumber - 1;
    const nextSlides = presentation.slides.filter((_, i) => i !== index);
    const nextPresentation: Presentation = { ...presentation, slides: nextSlides, updatedAt: now };
    const nextPresentations = presentations.map((item) =>
      item.id === presentation.id ? nextPresentation : item,
    );
    try {
      await savePresentations(nextPresentations);
      goToSlide(Math.min(clampedSlideNumber, nextSlides.length));
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete slide");
    }
  };

  const getNextLayer = (): number => {
    if (!currentSlide || currentSlide.elements.length === 0) {
      return 1;
    }
    return Math.max(...currentSlide.elements.map((item) => item.layer)) + 1;
  };

  const handleDeleteElement = async (elementId: string) => {
    if (!currentSlide) {
      return;
    }
    try {
      const nextElements = currentSlide.elements.filter((item) => item.id !== elementId);
      await saveCurrentSlideElements(nextElements);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete element");
    }
  };

  const openThemeModal = () => {
    if (!presentation || !currentSlide) {
      return;
    }
    setDefDraft(backgroundToDraft(presentation.defaultSlideBackground));
    const override = currentSlide.backgroundOverride;
    setSlideBgCustom(Boolean(override));
    setSlideDraft(backgroundToDraft(override ?? presentation.defaultSlideBackground));
    setThemeModalOpen(true);
  };

  const handleSaveDefaultBackground = async () => {
    if (!presentation) {
      return;
    }
    try {
      if (defDraft.kind === "image" && !defDraft.imageSrc.trim()) {
        throw new Error("Please provide an image URL or file for the default background.");
      }
      const nextBg = draftToBackground(defDraft);
      const now = new Date().toISOString();
      const nextPresentation: Presentation = {
        ...presentation,
        defaultSlideBackground: nextBg,
        updatedAt: now,
      };
      const nextPresentations = presentations.map((item) =>
        item.id === presentation.id ? nextPresentation : item,
      );
      await savePresentations(nextPresentations);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save default background");
    }
  };

  const handleApplySlideBackground = async () => {
    if (!presentation || !currentSlide) {
      return;
    }
    try {
      const idx = clampedSlideNumber - 1;
      let override: SlideBackground | undefined;
      if (!slideBgCustom) {
        override = undefined;
      } else {
        if (slideDraft.kind === "image" && !slideDraft.imageSrc.trim()) {
          throw new Error("Please provide an image URL or file for this slide background.");
        }
        override = draftToBackground(slideDraft);
      }
      const now = new Date().toISOString();
      const nextSlides = presentation.slides.map((slide, i) => {
        if (i !== idx) {
          return slide;
        }
        if (override === undefined) {
          const { backgroundOverride: _removed, ...rest } = slide;
          void _removed;
          return { ...rest } as Slide;
        }
        return { ...slide, backgroundOverride: override };
      });
      const nextPresentation: Presentation = { ...presentation, slides: nextSlides, updatedAt: now };
      const nextPresentations = presentations.map((item) =>
        item.id === presentation.id ? nextPresentation : item,
      );
      await savePresentations(nextPresentations);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to update slide background");
    }
  };

  const openPreview = () => {
    if (!presentationId) {
      return;
    }
    window.open(
      `${window.location.origin}/preview/${presentationId}/${String(clampedSlideNumber)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const openTextModal = (element?: TextElement) => {
    setEditingTextId(element?.id ?? null);
    setTextForm(
      element
        ? {
          width: String(element.width),
          height: String(element.height),
          content: element.content,
          fontSizeEm: String(element.fontSizeEm),
          color: element.color,
          fontFamily: element.fontFamily,
          x: String(element.x),
          y: String(element.y),
        }
        : DEFAULT_TEXT_FORM,
    );
    setTextModalOpen(true);
  };

  const openImageModal = (element?: ImageElement) => {
    setEditingImageId(element?.id ?? null);
    setImageForm(
      element
        ? {
          width: String(element.width),
          height: String(element.height),
          src: element.src,
          alt: element.alt,
          x: String(element.x),
          y: String(element.y),
        }
        : DEFAULT_IMAGE_FORM,
    );
    setImageModalOpen(true);
  };

  const openVideoModal = (element?: VideoElement) => {
    setEditingVideoId(element?.id ?? null);
    setVideoForm(
      element
        ? {
          width: String(element.width),
          height: String(element.height),
          url: element.url,
          autoplay: element.autoplay,
          x: String(element.x),
          y: String(element.y),
        }
        : DEFAULT_VIDEO_FORM,
    );
    setVideoModalOpen(true);
  };

  const openCodeModal = (element?: CodeElement) => {
    setEditingCodeId(element?.id ?? null);
    setCodeForm(
      element
        ? {
          width: String(element.width),
          height: String(element.height),
          code: element.code,
          fontSizeEm: String(element.fontSizeEm),
          x: String(element.x),
          y: String(element.y),
        }
        : DEFAULT_CODE_FORM,
    );
    setCodeModalOpen(true);
  };

  const handleSaveText = async () => {
    if (!currentSlide) {
      return;
    }
    try {
      const width = parsePercentInput(textForm.width, "Width");
      const height = parsePercentInput(textForm.height, "Height");
      const x = parsePercentInput(textForm.x, "X position");
      const y = parsePercentInput(textForm.y, "Y position");
      const fontSizeEm = Number(textForm.fontSizeEm);
      if (!textForm.content.trim() || Number.isNaN(fontSizeEm) || fontSizeEm <= 0) {
        throw new Error("Please provide valid text and font size.");
      }
      if (!textForm.fontFamily.trim()) {
        throw new Error("Please choose a font.");
      }
      const existing = currentSlide.elements;
      const nextLayer = getNextLayer();
      const updated: TextElement = {
        id: editingTextId ?? crypto.randomUUID(),
        type: "text",
        x: clampPercent(x),
        y: clampPercent(y),
        width: clampPercent(width),
        height: clampPercent(height),
        content: textForm.content,
        fontSizeEm,
        color: textForm.color,
        fontFamily: textForm.fontFamily,
        layer: editingTextId
          ? existing.find((item) => item.id === editingTextId)?.layer ?? nextLayer
          : nextLayer,
      };
      const nextElements = editingTextId
        ? existing.map((item) => (item.id === editingTextId ? updated : item))
        : [...existing, updated];
      await saveCurrentSlideElements(nextElements);
      setTextModalOpen(false);
      setEditingTextId(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save text element");
    }
  };

  const handleSaveImage = async () => {
    if (!currentSlide) {
      return;
    }
    try {
      const width = parsePercentInput(imageForm.width, "Width");
      const height = parsePercentInput(imageForm.height, "Height");
      const x = parsePercentInput(imageForm.x, "X position");
      const y = parsePercentInput(imageForm.y, "Y position");
      if (!imageForm.src.trim() || !imageForm.alt.trim()) {
        throw new Error("Image source and alt text are required.");
      }
      const existing = currentSlide.elements;
      const nextLayer = getNextLayer();
      const updated: ImageElement = {
        id: editingImageId ?? crypto.randomUUID(),
        type: "image",
        x: clampPercent(x),
        y: clampPercent(y),
        width: clampPercent(width),
        height: clampPercent(height),
        src: imageForm.src.trim(),
        alt: imageForm.alt.trim(),
        layer: editingImageId
          ? existing.find((item) => item.id === editingImageId)?.layer ?? nextLayer
          : nextLayer,
      };
      const nextElements = editingImageId
        ? existing.map((item) => (item.id === editingImageId ? updated : item))
        : [...existing, updated];
      await saveCurrentSlideElements(nextElements);
      setImageModalOpen(false);
      setEditingImageId(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save image element");
    }
  };

  const handleSaveVideo = async () => {
    if (!currentSlide) {
      return;
    }
    try {
      const width = parsePercentInput(videoForm.width, "Width");
      const height = parsePercentInput(videoForm.height, "Height");
      const x = parsePercentInput(videoForm.x, "X position");
      const y = parsePercentInput(videoForm.y, "Y position");
      if (!videoForm.url.trim().includes("youtube.com/embed/")) {
        throw new Error("Please provide a valid YouTube embed URL.");
      }
      const existing = currentSlide.elements;
      const nextLayer = getNextLayer();
      const updated: VideoElement = {
        id: editingVideoId ?? crypto.randomUUID(),
        type: "video",
        x: clampPercent(x),
        y: clampPercent(y),
        width: clampPercent(width),
        height: clampPercent(height),
        url: videoForm.url.trim(),
        autoplay: videoForm.autoplay,
        layer: editingVideoId
          ? existing.find((item) => item.id === editingVideoId)?.layer ?? nextLayer
          : nextLayer,
      };
      const nextElements = editingVideoId
        ? existing.map((item) => (item.id === editingVideoId ? updated : item))
        : [...existing, updated];
      await saveCurrentSlideElements(nextElements);
      setVideoModalOpen(false);
      setEditingVideoId(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save video element");
    }
  };

  const handleSaveCode = async () => {
    if (!currentSlide) {
      return;
    }
    try {
      const width = parsePercentInput(codeForm.width, "Width");
      const height = parsePercentInput(codeForm.height, "Height");
      const x = parsePercentInput(codeForm.x, "X position");
      const y = parsePercentInput(codeForm.y, "Y position");
      const fontSizeEm = Number(codeForm.fontSizeEm);
      if (!codeForm.code.trim() || Number.isNaN(fontSizeEm) || fontSizeEm <= 0) {
        throw new Error("Please provide valid code and font size.");
      }
      const existing = currentSlide.elements;
      const nextLayer = getNextLayer();
      const updated: CodeElement = {
        id: editingCodeId ?? crypto.randomUUID(),
        type: "code",
        x: clampPercent(x),
        y: clampPercent(y),
        width: clampPercent(width),
        height: clampPercent(height),
        code: codeForm.code,
        fontSizeEm,
        layer: editingCodeId
          ? existing.find((item) => item.id === editingCodeId)?.layer ?? nextLayer
          : nextLayer,
      };
      const nextElements = editingCodeId
        ? existing.map((item) => (item.id === editingCodeId ? updated : item))
        : [...existing, updated];
      await saveCurrentSlideElements(nextElements);
      setCodeModalOpen(false);
      setEditingCodeId(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save code element");
    }
  };

  const onImageFileChange = async (file: File | null) => {
    if (!file) {
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImageForm((prev) => ({ ...prev, src: dataUrl }));
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to read image file.");
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        editMetaOpen ||
        confirmDeleteOpen ||
        textModalOpen ||
        imageModalOpen ||
        videoModalOpen ||
        codeModalOpen ||
        themeModalOpen ||
        slidePanelOpen
      ) {
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
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
  }, [
    codeModalOpen,
    confirmDeleteOpen,
    editMetaOpen,
    handleNext,
    handlePrev,
    imageModalOpen,
    slidePanelOpen,
    textModalOpen,
    themeModalOpen,
    videoModalOpen,
  ]);

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

  const canvasBg = currentSlide
    ? slideBackgroundToStyle(resolveSlideBackground(presentation, currentSlide))
    : {};

  const renderDraftFields = (
    draft: BgDraft,
    setDraft: Dispatch<SetStateAction<BgDraft>>,
    idPrefix: string,
  ) => (
    <>
      <div className="form__field">
        <label htmlFor={`${idPrefix}-kind`}>Background type</label>
        <select
          id={`${idPrefix}-kind`}
          onChange={(e) => {
            const kind = e.target.value as BgDraft["kind"];
            setDraft((prev) => ({ ...prev, kind }));
          }}
          value={draft.kind}
        >
          <option value="solid">Solid colour</option>
          <option value="gradient">Gradient</option>
          <option value="image">Image</option>
        </select>
      </div>
      {draft.kind === "solid" ? (
        <div className="form__field">
          <label htmlFor={`${idPrefix}-solid`}>Colour</label>
          <input
            id={`${idPrefix}-solid`}
            onChange={(e) => setDraft((prev) => ({ ...prev, solid: e.target.value }))}
            type="color"
            value={draft.solid}
          />
        </div>
      ) : null}
      {draft.kind === "gradient" ? (
        <>
          <div className="form__grid">
            <div className="form__field">
              <label htmlFor={`${idPrefix}-from`}>From</label>
              <input
                id={`${idPrefix}-from`}
                onChange={(e) => setDraft((prev) => ({ ...prev, gradFrom: e.target.value }))}
                type="color"
                value={draft.gradFrom}
              />
            </div>
            <div className="form__field">
              <label htmlFor={`${idPrefix}-to`}>To</label>
              <input
                id={`${idPrefix}-to`}
                onChange={(e) => setDraft((prev) => ({ ...prev, gradTo: e.target.value }))}
                type="color"
                value={draft.gradTo}
              />
            </div>
          </div>
          <div className="form__field">
            <label htmlFor={`${idPrefix}-dir`}>Direction</label>
            <select
              id={`${idPrefix}-dir`}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  gradDir: e.target.value === "lr" ? "lr" : "tb",
                }))
              }
              value={draft.gradDir}
            >
              <option value="tb">Top to bottom</option>
              <option value="lr">Left to right</option>
            </select>
          </div>
        </>
      ) : null}
      {draft.kind === "image" ? (
        <>
          <div className="form__field">
            <label htmlFor={`${idPrefix}-imgurl`}>Image URL or data URL</label>
            <input
              id={`${idPrefix}-imgurl`}
              onChange={(e) => setDraft((prev) => ({ ...prev, imageSrc: e.target.value }))}
              type="text"
              value={draft.imageSrc}
            />
          </div>
          <div className="form__field">
            <label htmlFor={`${idPrefix}-imgfile`}>Upload image</label>
            <input
              accept="image/*"
              id={`${idPrefix}-imgfile`}
              onChange={(e) => {
                void (async () => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    return;
                  }
                  try {
                    const dataUrl = await readFileAsDataUrl(file);
                    setDraft((prev) => ({ ...prev, imageSrc: dataUrl }));
                  } catch (err) {
                    showError(err instanceof Error ? err.message : "Failed to read image.");
                  }
                })();
              }}
              type="file"
            />
          </div>
        </>
      ) : null}
    </>
  );

  return (
    <div className="editor">
      <header className="dashboard__bar">
        <button onClick={() => navigate("/dashboard")} type="button">
          Back
        </button>
        <div className="editor__title">
          <h1 className="dashboard__title">{presentation.name}</h1>
          <button onClick={openEditMeta} type="button">
            Edit title / thumbnail
          </button>
        </div>
        <button onClick={() => setConfirmDeleteOpen(true)} type="button">
          Delete Presentation
        </button>
      </header>
      <main className="page">
        <div className="slide-deck">
          <div className="slide-deck__top">
            <p className="slide-deck__label">
              Slide {String(clampedSlideNumber)} / {String(slideCount)}
            </p>
            <div className="slide-deck__tools" role="group" aria-label="Slide tools">
              <button onClick={() => setSlidePanelOpen(true)} type="button">
                Slides
              </button>
              <button onClick={openThemeModal} type="button">
                Theme &amp; background
              </button>
              <button onClick={openPreview} type="button">
                Preview
              </button>
              <button onClick={handleAddSlide} type="button">
                New slide
              </button>
              <button onClick={() => openTextModal()} type="button">
                Add text
              </button>
              <button onClick={() => openImageModal()} type="button">
                Add image
              </button>
              <button onClick={() => openVideoModal()} type="button">
                Add video
              </button>
              <button onClick={() => openCodeModal()} type="button">
                Add code
              </button>
              <button onClick={handleDeleteSlide} type="button">
                Delete slide
              </button>
            </div>
          </div>
          <div className="slide-deck__stage">
            <button
              aria-label="Previous slide"
              className="slide-deck__nav"
              disabled={clampedSlideNumber <= 1}
              onClick={handlePrev}
              type="button"
            >
              ◀
            </button>
            <div className="slide-deck__canvas" style={canvasBg}>
              {currentSlide?.elements
                .slice()
                .sort((a, b) => a.layer - b.layer)
                .map((element) => {
                  if (element.type === "text") {
                    return (
                      <div
                        className="slide-text"
                        key={element.id}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          void handleDeleteElement(element.id);
                        }}
                        onDoubleClick={() => openTextModal(element)}
                        style={{
                          ...getElementStyle(element),
                          color: element.color,
                          fontFamily: element.fontFamily,
                          fontSize: `${String(element.fontSizeEm)}em`,
                        }}
                        title="Double click to edit, right click to delete"
                      >
                        {element.content}
                      </div>
                    );
                  }
                  if (element.type === "image") {
                    return (
                      <div
                        className="slide-image"
                        key={element.id}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          void handleDeleteElement(element.id);
                        }}
                        onDoubleClick={() => openImageModal(element)}
                        style={getElementStyle(element)}
                        title="Double click to edit, right click to delete"
                      >
                        <img alt={element.alt} src={element.src} />
                      </div>
                    );
                  }
                  if (element.type === "video") {
                    return (
                      <div
                        className="slide-video"
                        key={element.id}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          void handleDeleteElement(element.id);
                        }}
                        onDoubleClick={() => openVideoModal(element)}
                        style={getElementStyle(element)}
                        title="Double click to edit, right click to delete"
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
                  const highlighted = hljs.highlightAuto(element.code, [
                    "c",
                    "python",
                    "javascript",
                  ]).value;
                  return (
                    <div
                      className="slide-code"
                      key={element.id}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        void handleDeleteElement(element.id);
                      }}
                      onDoubleClick={() => openCodeModal(element)}
                      style={{ ...getElementStyle(element), fontSize: `${String(element.fontSizeEm)}em` }}
                      title="Double click to edit, right click to delete"
                    >
                      <pre>
                        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                      </pre>
                    </div>
                  );
                })}
            </div>
            <button
              aria-label="Next slide"
              className="slide-deck__nav"
              disabled={presentation.slides.length === 0 || clampedSlideNumber >= presentation.slides.length}
              onClick={handleNext}
              type="button"
            >
              ▶
            </button>
          </div>
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

      {slidePanelOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div
            aria-labelledby="slide-panel-title"
            aria-modal="true"
            className="modal modal--slide-panel"
            role="dialog"
          >
            <h2 className="modal__title" id="slide-panel-title">
              Slide control panel
            </h2>
            <ul className="slide-panel-list">
              {presentation.slides.map((slide, i) => (
                <li className="slide-panel-list__item" key={slide.id}>
                  <button
                    className={`slide-panel-item${i + 1 === clampedSlideNumber ? " slide-panel-item--active" : ""}`}
                    onClick={() => {
                      goToSlide(i + 1);
                      setSlidePanelOpen(false);
                    }}
                    type="button"
                  >
                    Slide {String(i + 1)}
                  </button>
                </li>
              ))}
            </ul>
            <div className="modal__footer">
              <button onClick={() => setSlidePanelOpen(false)} type="button">
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {themeModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div aria-modal="true" className="modal modal--wide" role="dialog">
            <h2 className="modal__title">Theme &amp; background</h2>
            <fieldset className="theme-fieldset">
              <legend>Presentation default</legend>
              <p className="theme-hint">
                Applies to new slides and any slide that does not use a custom background.
              </p>
              {renderDraftFields(defDraft, setDefDraft, "def")}
              <div className="modal__footer modal__footer--inline">
                <button onClick={handleSaveDefaultBackground} type="button">
                  Save default
                </button>
              </div>
            </fieldset>
            <fieldset className="theme-fieldset">
              <legend>Current slide</legend>
              <div className="form__field">
                <label>
                  <input
                    checked={slideBgCustom}
                    onChange={(e) => setSlideBgCustom(e.target.checked)}
                    type="checkbox"
                  />{" "}
                  Use custom background on this slide
                </label>
              </div>
              {slideBgCustom ? renderDraftFields(slideDraft, setSlideDraft, "slide") : null}
              <div className="modal__footer modal__footer--inline">
                <button onClick={handleApplySlideBackground} type="button">
                  Apply to this slide
                </button>
              </div>
            </fieldset>
            <div className="modal__footer">
              <button onClick={() => setThemeModalOpen(false)} type="button">
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editMetaOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div aria-modal="true" className="modal" role="dialog">
            <h2 className="modal__title">Edit presentation</h2>
            <div className="form">
              <div className="form__field">
                <label htmlFor="edit-pres-name">Title</label>
                <input
                  id="edit-pres-name"
                  onChange={(e) => setDraftName(e.target.value)}
                  type="text"
                  value={draftName}
                />
              </div>
              <div className="form__field">
                <label htmlFor="edit-pres-thumbnail">Thumbnail URL</label>
                <input
                  id="edit-pres-thumbnail"
                  onChange={(e) => setDraftThumbnail(e.target.value)}
                  type="url"
                  value={draftThumbnail}
                />
              </div>
            </div>
            <div className="modal__footer">
              <button onClick={() => setEditMetaOpen(false)} type="button">
                Cancel
              </button>
              <button onClick={handleSaveMeta} type="button">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {textModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div aria-modal="true" className="modal" role="dialog">
            <h2 className="modal__title">{editingTextId ? "Edit text box" : "Add text box"}</h2>
            <div className="form">
              <div className="form__field">
                <label htmlFor="text-width">Width (%)</label>
                <input
                  id="text-width"
                  onChange={(e) => setTextForm((p) => ({ ...p, width: e.target.value }))}
                  type="number"
                  value={textForm.width}
                />
              </div>
              <div className="form__field">
                <label htmlFor="text-height">Height (%)</label>
                <input
                  id="text-height"
                  onChange={(e) => setTextForm((p) => ({ ...p, height: e.target.value }))}
                  type="number"
                  value={textForm.height}
                />
              </div>
              <div className="form__field">
                <label htmlFor="text-content">Text</label>
                <textarea
                  id="text-content"
                  onChange={(e) => setTextForm((p) => ({ ...p, content: e.target.value }))}
                  value={textForm.content}
                />
              </div>
              <div className="form__field">
                <label htmlFor="text-font-size">Font size (em)</label>
                <input
                  id="text-font-size"
                  onChange={(e) => setTextForm((p) => ({ ...p, fontSizeEm: e.target.value }))}
                  step="0.1"
                  type="number"
                  value={textForm.fontSizeEm}
                />
              </div>
              <div className="form__field">
                <label htmlFor="text-font-family">Font</label>
                <select
                  id="text-font-family"
                  onChange={(e) => setTextForm((p) => ({ ...p, fontFamily: e.target.value }))}
                  value={textForm.fontFamily}
                >
                  {FONT_CHOICES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form__field">
                <label htmlFor="text-color">Text colour</label>
                <input
                  id="text-color"
                  onChange={(e) => setTextForm((p) => ({ ...p, color: e.target.value }))}
                  type="color"
                  value={textForm.color}
                />
              </div>
              <div className="form__grid">
                <div className="form__field">
                  <label htmlFor="text-x">Position X (%)</label>
                  <input
                    id="text-x"
                    onChange={(e) => setTextForm((p) => ({ ...p, x: e.target.value }))}
                    type="number"
                    value={textForm.x}
                  />
                </div>
                <div className="form__field">
                  <label htmlFor="text-y">Position Y (%)</label>
                  <input
                    id="text-y"
                    onChange={(e) => setTextForm((p) => ({ ...p, y: e.target.value }))}
                    type="number"
                    value={textForm.y}
                  />
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <button onClick={() => setTextModalOpen(false)} type="button">
                Cancel
              </button>
              <button onClick={handleSaveText} type="button">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {imageModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div aria-modal="true" className="modal" role="dialog">
            <h2 className="modal__title">{editingImageId ? "Edit image" : "Add image"}</h2>
            <div className="form">
              <div className="form__field">
                <label htmlFor="image-width">Width (%)</label>
                <input
                  id="image-width"
                  onChange={(e) => setImageForm((p) => ({ ...p, width: e.target.value }))}
                  type="number"
                  value={imageForm.width}
                />
              </div>
              <div className="form__field">
                <label htmlFor="image-height">Height (%)</label>
                <input
                  id="image-height"
                  onChange={(e) => setImageForm((p) => ({ ...p, height: e.target.value }))}
                  type="number"
                  value={imageForm.height}
                />
              </div>
              <div className="form__field">
                <label htmlFor="image-src">Image URL / base64</label>
                <input
                  id="image-src"
                  onChange={(e) => setImageForm((p) => ({ ...p, src: e.target.value }))}
                  type="url"
                  value={imageForm.src}
                />
              </div>
              <div className="form__field">
                <label htmlFor="image-file">Or upload local image</label>
                <input
                  accept="image/*"
                  id="image-file"
                  onChange={(e) => {
                    void onImageFileChange(e.target.files?.[0] ?? null);
                  }}
                  type="file"
                />
              </div>
              <div className="form__field">
                <label htmlFor="image-alt">Alt description</label>
                <input
                  id="image-alt"
                  onChange={(e) => setImageForm((p) => ({ ...p, alt: e.target.value }))}
                  type="text"
                  value={imageForm.alt}
                />
              </div>
              <div className="form__grid">
                <div className="form__field">
                  <label htmlFor="image-x">Position X (%)</label>
                  <input
                    id="image-x"
                    onChange={(e) => setImageForm((p) => ({ ...p, x: e.target.value }))}
                    type="number"
                    value={imageForm.x}
                  />
                </div>
                <div className="form__field">
                  <label htmlFor="image-y">Position Y (%)</label>
                  <input
                    id="image-y"
                    onChange={(e) => setImageForm((p) => ({ ...p, y: e.target.value }))}
                    type="number"
                    value={imageForm.y}
                  />
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <button onClick={() => setImageModalOpen(false)} type="button">
                Cancel
              </button>
              <button onClick={handleSaveImage} type="button">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {videoModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div aria-modal="true" className="modal" role="dialog">
            <h2 className="modal__title">{editingVideoId ? "Edit video" : "Add video"}</h2>
            <div className="form">
              <div className="form__field">
                <label htmlFor="video-width">Width (%)</label>
                <input
                  id="video-width"
                  onChange={(e) => setVideoForm((p) => ({ ...p, width: e.target.value }))}
                  type="number"
                  value={videoForm.width}
                />
              </div>
              <div className="form__field">
                <label htmlFor="video-height">Height (%)</label>
                <input
                  id="video-height"
                  onChange={(e) => setVideoForm((p) => ({ ...p, height: e.target.value }))}
                  type="number"
                  value={videoForm.height}
                />
              </div>
              <div className="form__field">
                <label htmlFor="video-url">YouTube embed URL</label>
                <input
                  id="video-url"
                  onChange={(e) => setVideoForm((p) => ({ ...p, url: e.target.value }))}
                  type="url"
                  value={videoForm.url}
                />
              </div>
              <div className="form__field">
                <label>
                  <input
                    checked={videoForm.autoplay}
                    onChange={(e) => setVideoForm((p) => ({ ...p, autoplay: e.target.checked }))}
                    type="checkbox"
                  />{" "}
                  Auto play
                </label>
              </div>
              <div className="form__grid">
                <div className="form__field">
                  <label htmlFor="video-x">Position X (%)</label>
                  <input
                    id="video-x"
                    onChange={(e) => setVideoForm((p) => ({ ...p, x: e.target.value }))}
                    type="number"
                    value={videoForm.x}
                  />
                </div>
                <div className="form__field">
                  <label htmlFor="video-y">Position Y (%)</label>
                  <input
                    id="video-y"
                    onChange={(e) => setVideoForm((p) => ({ ...p, y: e.target.value }))}
                    type="number"
                    value={videoForm.y}
                  />
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <button onClick={() => setVideoModalOpen(false)} type="button">
                Cancel
              </button>
              <button onClick={handleSaveVideo} type="button">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {codeModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div aria-modal="true" className="modal" role="dialog">
            <h2 className="modal__title">{editingCodeId ? "Edit code block" : "Add code block"}</h2>
            <div className="form">
              <div className="form__field">
                <label htmlFor="code-width">Width (%)</label>
                <input
                  id="code-width"
                  onChange={(e) => setCodeForm((p) => ({ ...p, width: e.target.value }))}
                  type="number"
                  value={codeForm.width}
                />
              </div>
              <div className="form__field">
                <label htmlFor="code-height">Height (%)</label>
                <input
                  id="code-height"
                  onChange={(e) => setCodeForm((p) => ({ ...p, height: e.target.value }))}
                  type="number"
                  value={codeForm.height}
                />
              </div>
              <div className="form__field">
                <label htmlFor="code-content">Code</label>
                <textarea
                  id="code-content"
                  onChange={(e) => setCodeForm((p) => ({ ...p, code: e.target.value }))}
                  value={codeForm.code}
                />
              </div>
              <div className="form__field">
                <label htmlFor="code-font-size">Font size (em)</label>
                <input
                  id="code-font-size"
                  onChange={(e) => setCodeForm((p) => ({ ...p, fontSizeEm: e.target.value }))}
                  step="0.1"
                  type="number"
                  value={codeForm.fontSizeEm}
                />
              </div>
              <div className="form__grid">
                <div className="form__field">
                  <label htmlFor="code-x">Position X (%)</label>
                  <input
                    id="code-x"
                    onChange={(e) => setCodeForm((p) => ({ ...p, x: e.target.value }))}
                    type="number"
                    value={codeForm.x}
                  />
                </div>
                <div className="form__field">
                  <label htmlFor="code-y">Position Y (%)</label>
                  <input
                    id="code-y"
                    onChange={(e) => setCodeForm((p) => ({ ...p, y: e.target.value }))}
                    type="number"
                    value={codeForm.y}
                  />
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <button onClick={() => setCodeModalOpen(false)} type="button">
                Cancel
              </button>
              <button onClick={handleSaveCode} type="button">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
