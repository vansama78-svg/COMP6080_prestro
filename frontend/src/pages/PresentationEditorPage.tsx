import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import hljs from "highlight.js/lib/core";
import c from "highlight.js/lib/languages/c";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import "highlight.js/styles/github.css";
import { useNavigate, useParams } from "react-router-dom";
import { getStoreApi, putStoreApi } from "../api/store";
import { EditorElementShell } from "../components/EditorElementShell";
import {
  applyRectToElement,
  type RectPct,
} from "../lib/slideElementGeometry";
import { withAutoplay } from "../lib/slideDeckUtils";
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
  content: string;
  fontSizeEm: string;
  color: string;
  fontFamily: string;
};

type ImageForm = {
  src: string;
  alt: string;
};

type VideoForm = {
  url: string;
  autoplay: boolean;
};

type CodeForm = {
  code: string;
  fontSizeEm: string;
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
  content: "",
  fontSizeEm: "1",
  color: "#000000",
  fontFamily: defaultFontFamily(),
};

const DEFAULT_IMAGE_FORM: ImageForm = {
  src: "",
  alt: "",
};

const DEFAULT_VIDEO_FORM: VideoForm = {
  url: "",
  autoplay: false,
};

const DEFAULT_CODE_FORM: CodeForm = {
  code: "",
  fontSizeEm: "1",
};

/** YouTube video IDs are 11 chars from this alphabet. */
const YOUTUBE_VIDEO_ID = /^[\w-]{11}$/;

/**
 * Accepts embed links, watch URLs, youtu.be short links, or a bare 11-char id;
 * returns a canonical https://www.youtube.com/embed/... URL for the iframe.
 */
function normalizeYouTubeEmbedUrl(raw: string): string | null {
  const input = raw.trim();
  if (!input) {
    return null;
  }
  if (YOUTUBE_VIDEO_ID.test(input)) {
    return `https://www.youtube.com/embed/${input}`;
  }
  let url: URL;
  try {
    url = new URL(input.includes("://") ? input : `https://${input}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return YOUTUBE_VIDEO_ID.test(id) ? `https://www.youtube.com/embed/${id}${url.search}` : null;
  }
  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    const path = url.pathname;
    if (path.startsWith("/embed/")) {
      const id = path.slice("/embed/".length).split("/")[0] ?? "";
      return YOUTUBE_VIDEO_ID.test(id)
        ? `https://www.youtube.com/embed/${id}${url.search}`
        : null;
    }
    if (path === "/watch" || path === "/watch/") {
      const v = url.searchParams.get("v");
      return v && YOUTUBE_VIDEO_ID.test(v) ? `https://www.youtube.com/embed/${v}` : null;
    }
    if (path.startsWith("/shorts/")) {
      const id = path.slice("/shorts/".length).split("/")[0] ?? "";
      return YOUTUBE_VIDEO_ID.test(id) ? `https://www.youtube.com/embed/${id}` : null;
    }
  }
  return null;
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
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [dragOverlay, setDragOverlay] = useState<{ id: string; rect: RectPct } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

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

  const prevEditorSlideRef = useRef(clampedSlideNumber);
  const [editorSlideEnter, setEditorSlideEnter] = useState<"next" | "prev">("next");

  useEffect(() => {
    if (prevEditorSlideRef.current !== clampedSlideNumber) {
      setEditorSlideEnter(clampedSlideNumber > prevEditorSlideRef.current ? "next" : "prev");
      prevEditorSlideRef.current = clampedSlideNumber;
    }
  }, [clampedSlideNumber]);

  useEffect(() => {
    if (!presentationId || !presentation) {
      return;
    }
    if (currentSlideNumber !== clampedSlideNumber) {
      navigate(`/presentation/${presentationId}/${String(clampedSlideNumber)}`, { replace: true });
    }
  }, [clampedSlideNumber, currentSlideNumber, navigate, presentation, presentationId]);

  useEffect(() => {
    setSelectedElementId(null);
    setDragOverlay(null);
  }, [clampedSlideNumber, currentSlide?.id]);

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

  const persistElementRect = useCallback(
    async (elementId: string, rect: RectPct) => {
      if (!currentSlide) {
        return;
      }
      setDragOverlay(null);
      const nextElements = currentSlide.elements.map((item) =>
        item.id === elementId ? applyRectToElement(item, rect) : item,
      );
      await saveCurrentSlideElements(nextElements);
    },
    [currentSlide, saveCurrentSlideElements],
  );

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
          content: element.content,
          fontSizeEm: String(element.fontSizeEm),
          color: element.color,
          fontFamily: element.fontFamily,
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
          src: element.src,
          alt: element.alt,
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
          url: element.url,
          autoplay: element.autoplay,
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
          code: element.code,
          fontSizeEm: String(element.fontSizeEm),
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
      const fontSizeEm = Number(textForm.fontSizeEm);
      if (!textForm.content.trim() || Number.isNaN(fontSizeEm) || fontSizeEm <= 0) {
        throw new Error("Please provide valid text and font size.");
      }
      if (!textForm.fontFamily.trim()) {
        throw new Error("Please choose a font.");
      }
      const existing = currentSlide.elements;
      const nextLayer = getNextLayer();
      const prev = editingTextId
        ? existing.find((item): item is TextElement => item.id === editingTextId && item.type === "text")
        : undefined;
      const updated: TextElement = {
        id: editingTextId ?? crypto.randomUUID(),
        type: "text",
        x: prev?.x ?? 0,
        y: prev?.y ?? 0,
        width: prev?.width ?? 40,
        height: prev?.height ?? 20,
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
      if (!imageForm.src.trim() || !imageForm.alt.trim()) {
        throw new Error("Image source and alt text are required.");
      }
      const existing = currentSlide.elements;
      const nextLayer = getNextLayer();
      const prev = editingImageId
        ? existing.find((item): item is ImageElement => item.id === editingImageId && item.type === "image")
        : undefined;
      const updated: ImageElement = {
        id: editingImageId ?? crypto.randomUUID(),
        type: "image",
        x: prev?.x ?? 0,
        y: prev?.y ?? 0,
        width: prev?.width ?? 40,
        height: prev?.height ?? 30,
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
      const embedUrl = normalizeYouTubeEmbedUrl(videoForm.url);
      if (!embedUrl) {
        throw new Error(
          "Please enter a valid YouTube link (watch page, youtu.be, embed URL, or 11-character video ID).",
        );
      }
      const existing = currentSlide.elements;
      const nextLayer = getNextLayer();
      const prev = editingVideoId
        ? existing.find((item): item is VideoElement => item.id === editingVideoId && item.type === "video")
        : undefined;
      const updated: VideoElement = {
        id: editingVideoId ?? crypto.randomUUID(),
        type: "video",
        x: prev?.x ?? 0,
        y: prev?.y ?? 0,
        width: prev?.width ?? 50,
        height: prev?.height ?? 35,
        url: embedUrl,
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
      const fontSizeEm = Number(codeForm.fontSizeEm);
      if (!codeForm.code.trim() || Number.isNaN(fontSizeEm) || fontSizeEm <= 0) {
        throw new Error("Please provide valid code and font size.");
      }
      const existing = currentSlide.elements;
      const nextLayer = getNextLayer();
      const prev = editingCodeId
        ? existing.find((item): item is CodeElement => item.id === editingCodeId && item.type === "code")
        : undefined;
      const updated: CodeElement = {
        id: editingCodeId ?? crypto.randomUUID(),
        type: "code",
        x: prev?.x ?? 0,
        y: prev?.y ?? 0,
        width: prev?.width ?? 45,
        height: prev?.height ?? 35,
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
            <div
              className="slide-deck__canvas"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) {
                  setSelectedElementId(null);
                }
              }}
              ref={canvasRef}
              style={canvasBg}
            >
              <div
                className={`slide-deck__slide-layer slide-deck__slide-layer--enter slide-deck__slide-layer--from-${editorSlideEnter}`}
                key={clampedSlideNumber}
              >
                {currentSlide?.elements
                  .slice()
                  .sort((a, b) => a.layer - b.layer)
                  .map((element) => {
                    const displayEl =
                      dragOverlay?.id === element.id
                        ? applyRectToElement(element, dragOverlay.rect)
                        : element;
                    if (element.type === "text") {
                      const te = displayEl as TextElement;
                      return (
                        <EditorElementShell
                          canvasRef={canvasRef}
                          element={te}
                          key={element.id}
                          onContextDelete={(e) => {
                            e.preventDefault();
                            void handleDeleteElement(element.id);
                          }}
                          onDragEnd={(rect) => persistElementRect(element.id, rect)}
                          onDragProgress={(rect) => setDragOverlay({ id: element.id, rect })}
                          onEdit={() => openTextModal(element as TextElement)}
                          onSelect={() => setSelectedElementId(element.id)}
                          selected={selectedElementId === element.id}
                        >
                          <div
                            className="slide-text"
                            style={{
                              color: te.color,
                              fontFamily: te.fontFamily,
                              fontSize: `${String(te.fontSizeEm)}em`,
                            }}
                          >
                            {te.content}
                          </div>
                        </EditorElementShell>
                      );
                    }
                    if (element.type === "image") {
                      const ie = displayEl as ImageElement;
                      return (
                        <EditorElementShell
                          canvasRef={canvasRef}
                          element={ie}
                          key={element.id}
                          onContextDelete={(e) => {
                            e.preventDefault();
                            void handleDeleteElement(element.id);
                          }}
                          onDragEnd={(rect) => persistElementRect(element.id, rect)}
                          onDragProgress={(rect) => setDragOverlay({ id: element.id, rect })}
                          onEdit={() => openImageModal(element as ImageElement)}
                          onSelect={() => setSelectedElementId(element.id)}
                          selected={selectedElementId === element.id}
                        >
                          <div className="slide-image">
                            <img alt={ie.alt} src={ie.src} />
                          </div>
                        </EditorElementShell>
                      );
                    }
                    if (element.type === "video") {
                      const ve = displayEl as VideoElement;
                      return (
                        <EditorElementShell
                          canvasRef={canvasRef}
                          element={ve}
                          key={element.id}
                          onContextDelete={(e) => {
                            e.preventDefault();
                            void handleDeleteElement(element.id);
                          }}
                          onDragEnd={(rect) => persistElementRect(element.id, rect)}
                          onDragProgress={(rect) => setDragOverlay({ id: element.id, rect })}
                          onEdit={() => openVideoModal(element as VideoElement)}
                          onSelect={() => setSelectedElementId(element.id)}
                          selected={selectedElementId === element.id}
                        >
                          <div className="slide-video">
                            <iframe
                              allow="autoplay; encrypted-media; picture-in-picture"
                              allowFullScreen
                              src={withAutoplay(ve.url, ve.autoplay)}
                              title={`video-${element.id}`}
                            />
                          </div>
                        </EditorElementShell>
                      );
                    }
                    const highlighted = hljs.highlightAuto(element.code, [
                      "c",
                      "python",
                      "javascript",
                    ]).value;
                    const ce = displayEl as CodeElement;
                    return (
                      <EditorElementShell
                        canvasRef={canvasRef}
                        element={ce}
                        key={element.id}
                        onContextDelete={(e) => {
                          e.preventDefault();
                          void handleDeleteElement(element.id);
                        }}
                        onDragEnd={(rect) => persistElementRect(element.id, rect)}
                        onDragProgress={(rect) => setDragOverlay({ id: element.id, rect })}
                        onEdit={() => openCodeModal(element as CodeElement)}
                        onSelect={() => setSelectedElementId(element.id)}
                        selected={selectedElementId === element.id}
                      >
                        <div className="slide-code" style={{ fontSize: `${String(ce.fontSizeEm)}em` }}>
                          <pre>
                            <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                          </pre>
                        </div>
                      </EditorElementShell>
                    );
                  })}
              </div>
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
              <p className="theme-hint">Position and size are adjusted on the slide (drag / corner handles).</p>
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
              <p className="theme-hint">Position and size are adjusted on the slide (drag / corner handles).</p>
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
                <label htmlFor="video-url">YouTube URL</label>
                <input
                  id="video-url"
                  onChange={(e) => setVideoForm((p) => ({ ...p, url: e.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=… or embed / youtu.be"
                  type="text"
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
              <p className="theme-hint">Position and size are adjusted on the slide (drag / corner handles).</p>
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
              <p className="theme-hint">Position and size are adjusted on the slide (drag / corner handles).</p>
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
