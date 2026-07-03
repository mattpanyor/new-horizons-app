"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  useMemo,
  forwardRef,
} from "react";
import type { StoryPage } from "@/types/story";
import { toRoman } from "@/lib/story";
import { parseClueText } from "@/lib/investigation/clueText";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };
const serif = { fontFamily: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif" };

const INK = "#2c2114";
const GOLD = "#8a6d3b";
const GOLD_HI = "#e7d7a8";

// Parchment insets, as CSS strings and matching fractions (for measurement).
// OUTER = leather-spine-side margin, GUTTER = centre-spine-side margin.
const OUTER = "32.7%";
const GUTTER = "8.1%";
const BODY_TOP = "16%";
const BODY_BOTTOM = "11%";
const OUTER_F = 0.327;
const GUTTER_F = 0.081;
const BODY_TOP_F = 0.16;
const BODY_BOTTOM_F = 0.11;
const PAGE_ASPECT = 941 / 836;

// Run layout effects on the client, plain effects during SSR (no warning).
const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/* ------------------------------------------------------------------ */
/* Content model                                                       */
/* ------------------------------------------------------------------ */

interface TextItem {
  type: "text";
  text: string;
  dropCap: boolean;
}
interface ImageItem {
  type: "image";
  url: string;
  alt: string;
}
type Item = TextItem | ImageItem;

interface Section {
  heading: string | null;
  items: Item[];
}
interface PhysPage {
  heading: string | null;
  items: Item[];
}

// Flatten a parsed section into atoms: heading (own field) + paragraph/image
// items. The first paragraph of a section carries the drop cap.
function toSections(pages: StoryPage[]): Section[] {
  return pages.map((p) => {
    const items: Item[] = [];
    let firstPara = true;
    for (const block of p.blocks) {
      if (block.type === "image") {
        items.push({ type: "image", url: block.url, alt: block.alt });
      } else {
        for (const para of block.paragraphs) {
          items.push({ type: "text", text: para, dropCap: firstPara });
          firstPara = false;
        }
      }
    }
    return { heading: p.heading, items };
  });
}

/* ------------------------------------------------------------------ */
/* Shared content nodes (used by both the book and the hidden measurer) */
/* ------------------------------------------------------------------ */

const paraStyle = {
  ...serif,
  color: INK,
  fontSize: "clamp(11px, 2.5cqw, 18px)",
  lineHeight: 1.5,
  marginBottom: "0.7em",
} as const;

const dropCapStyle = {
  ...cinzel,
  color: "#7a5c26",
  fontSize: "3.4em",
  lineHeight: 0.72,
  paddingRight: "0.08em",
  marginTop: "0.04em",
  textShadow: "0 1px 1px rgba(0,0,0,0.25)",
} as const;

// A Kanka @mention rendered as a link to the campaign, styled for parchment.
function MentionLink({ name, url }: { name: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-amber-800 hover:text-amber-900 underline decoration-dotted underline-offset-2 decoration-amber-700/50"
    >
      {name}
    </a>
  );
}

const Paragraph = forwardRef<HTMLParagraphElement, { text: string; dropCap: boolean }>(
  function Paragraph({ text, dropCap }, ref) {
    const tokens = parseClueText(text);
    return (
      <p ref={ref} className="text-justify" style={paraStyle}>
        {tokens.map((tok, i) => {
          if (tok.kind === "mention") {
            return <MentionLink key={i} name={tok.name} url={tok.url} />;
          }
          // Drop cap on the first character of a section's opening paragraph.
          if (dropCap && i === 0 && tok.value.length > 0) {
            return (
              <span key={i}>
                <span className="float-left" style={dropCapStyle}>
                  {tok.value.charAt(0)}
                </span>
                {tok.value.slice(1)}
              </span>
            );
          }
          return <span key={i}>{tok.value}</span>;
        })}
      </p>
    );
  }
);

const HeadingBlock = forwardRef<HTMLDivElement, { text: string }>(function HeadingBlock({ text }, ref) {
  return (
    <div ref={ref} className="text-center" style={{ marginBottom: "1.15em" }}>
      <h2
        className="uppercase"
        style={{ ...cinzel, color: INK, letterSpacing: "0.1em", lineHeight: 1.1, fontSize: "clamp(14px, 3.2cqw, 26px)" }}
      >
        {text}
      </h2>
      <div
        style={{
          margin: "0.55em auto 0",
          height: 1,
          width: "72%",
          background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
        }}
      />
    </div>
  );
});

function RealImage({ item, onImageClick }: { item: ImageItem; onImageClick: (url: string) => void }) {
  return (
    <figure className="clear-both" style={{ margin: "1em 0" }}>
      <button
        type="button"
        onClick={() => onImageClick(item.url)}
        className="block mx-auto max-w-full cursor-zoom-in p-0 border-0 bg-transparent"
        aria-label="View image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.alt}
          style={{
            display: "block",
            margin: "0 auto",
            width: "auto",
            height: "auto",
            maxWidth: "100%",
            maxHeight: "50cqh",
            border: `2px solid ${GOLD}`,
            borderRadius: "2px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
          }}
        />
      </button>
    </figure>
  );
}

// Placeholder of the exact rendered image size, for measuring flow height
// without waiting on the real <img> to paint.
const ImagePlaceholder = forwardRef<HTMLElement, { w: number; h: number }>(function ImagePlaceholder(
  { w, h },
  ref
) {
  return (
    <figure ref={ref} className="clear-both" style={{ margin: "1em 0" }}>
      <div style={{ margin: "0 auto", width: w, height: h, border: `2px solid ${GOLD}` }} />
    </figure>
  );
});

/* ------------------------------------------------------------------ */
/* Leaf                                                                */
/* ------------------------------------------------------------------ */

function Leaf({
  page,
  side,
  visible,
  onImageClick,
}: {
  page: PhysPage | null;
  side: "left" | "right";
  visible: boolean;
  onImageClick: (url: string) => void;
}) {
  const isLeft = side === "left";
  const left = isLeft ? OUTER : GUTTER;
  const right = isLeft ? GUTTER : OUTER;
  const bg = isLeft ? "/storybook/page-left.webp" : "/storybook/page-right.webp";

  return (
    <div
      className="relative flex-1 min-w-0 select-none"
      style={{
        aspectRatio: "836 / 941",
        containerType: "size",
        backgroundImage: `url(${bg})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div
        className="absolute inset-0 transition-opacity duration-200 ease-in-out"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <div className="absolute overflow-hidden" style={{ left, right, top: BODY_TOP, bottom: BODY_BOTTOM }}>
          {page?.heading && <HeadingBlock text={page.heading} />}
          {page?.items.map((it, i) =>
            it.type === "text" ? (
              <Paragraph key={i} text={it.text} dropCap={it.dropCap} />
            ) : (
              <RealImage key={i} item={it} onImageClick={onImageClick} />
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Book                                                                */
/* ------------------------------------------------------------------ */

interface Props {
  title: string;
  chapter: number;
  chapterTitle: string | null;
  sessionNumber: number | null;
  pages: StoryPage[];
}

export default function StoryBook({ title, chapter, chapterTitle, sessionNumber, pages }: Props) {
  const sections = useMemo(() => toSections(pages), [pages]);
  const imageUrls = useMemo(
    () => sections.flatMap((s) => s.items.filter((i): i is ImageItem => i.type === "image").map((i) => i.url)),
    [sections]
  );

  const [perView, setPerView] = useState(1);
  const [bookW, setBookW] = useState(0);
  const [natSizes, setNatSizes] = useState<Map<string, { w: number; h: number }>>(new Map());
  const [physPages, setPhysPages] = useState<PhysPage[]>(() =>
    sections.map((s) => ({ heading: s.heading, items: s.items }))
  );

  const [spread, setSpread] = useState(0);
  const [renderSpread, setRenderSpread] = useState(0);
  const [contentVisible, setContentVisible] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const bookRef = useRef<HTMLDivElement>(null);
  const measRefs = useRef(new Map<string, HTMLElement>());
  const bind = (key: string) => (el: HTMLElement | null) => {
    if (el) measRefs.current.set(key, el);
    else measRefs.current.delete(key);
  };

  const imagesReady = imageUrls.every((u) => natSizes.has(u));

  // One / two page spread by viewport width.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const apply = () => setPerView(mq.matches ? 2 : 1);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Track the book's rendered width so pagination measures at the real size.
  useIso(() => {
    if (!bookRef.current) return;
    const el = bookRef.current;
    const update = () => setBookW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Preload images to learn their natural dimensions.
  useEffect(() => {
    let cancelled = false;
    const missing = imageUrls.filter((u) => !natSizes.has(u));
    if (missing.length === 0) return;
    for (const url of missing) {
      const img = new Image();
      const record = (w: number, h: number) => {
        if (cancelled) return;
        setNatSizes((prev) => {
          if (prev.has(url)) return prev;
          const next = new Map(prev);
          next.set(url, { w, h });
          return next;
        });
      };
      img.onload = () => record(img.naturalWidth || 16, img.naturalHeight || 9);
      img.onerror = () => record(16, 9);
      img.src = url;
    }
    return () => {
      cancelled = true;
    };
  }, [imageUrls, natSizes]);

  const leafW = perView === 2 ? (bookW - 1) / 2 : bookW;
  const leafH = leafW * PAGE_ASPECT;
  const bodyW = leafW * (1 - OUTER_F - GUTTER_F);
  const bodyH = leafH * (1 - BODY_TOP_F - BODY_BOTTOM_F);

  // Measure each section's atoms and pack them into physical pages.
  useIso(() => {
    if (bookW <= 0 || bodyH <= 0) return;
    if (!imagesReady) {
      setPhysPages(sections.map((s) => ({ heading: s.heading, items: s.items })));
      return;
    }

    const result: PhysPage[] = [];
    sections.forEach((sec, si) => {
      const flow = measRefs.current.get(`flow-${si}`);
      if (!flow) return;
      const flowTop = flow.getBoundingClientRect().top;

      type M = { kind: "heading" | "item"; item?: Item; heading?: string; top: number; height: number };
      const measured: M[] = [];
      if (sec.heading) {
        const el = measRefs.current.get(`h-${si}`);
        if (el) {
          const r = el.getBoundingClientRect();
          measured.push({ kind: "heading", heading: sec.heading, top: r.top - flowTop, height: r.height });
        }
      }
      sec.items.forEach((it, j) => {
        const el = measRefs.current.get(`it-${si}-${j}`);
        if (!el) return;
        const r = el.getBoundingClientRect();
        measured.push({ kind: "item", item: it, top: r.top - flowTop, height: r.height });
      });

      let pageStart = 0;
      let cur: PhysPage | null = null;
      for (const m of measured) {
        if (cur === null) {
          cur = { heading: null, items: [] };
          result.push(cur);
          pageStart = m.top;
        } else if (m.top + m.height - pageStart > bodyH && cur.items.length > 0) {
          cur = { heading: null, items: [] };
          result.push(cur);
          pageStart = m.top;
        }
        if (m.kind === "heading") cur.heading = m.heading ?? null;
        else if (m.item) cur.items.push(m.item);
      }
    });

    setPhysPages(result.length > 0 ? result : [{ heading: null, items: [] }]);
  }, [sections, bookW, perView, imagesReady, bodyH]);

  const totalSpreads = Math.max(1, Math.ceil(physPages.length / perView));
  const maxSpread = totalSpreads - 1;
  const safeSpread = Math.min(spread, maxSpread);
  const safeRender = Math.min(renderSpread, maxSpread);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const go = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(target, maxSpread));
      setSpread(clamped);
      if (clamped === safeRender) {
        setContentVisible(true);
        return;
      }
      setContentVisible(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setRenderSpread(clamped);
        setContentVisible(true);
      }, 210);
    },
    [maxSpread, safeRender]
  );

  const next = useCallback(() => go(safeSpread + 1), [go, safeSpread]);
  const prev = useCallback(() => go(safeSpread - 1), [go, safeSpread]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightbox) {
        if (e.key === "Escape") setLightbox(null);
        return;
      }
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, lightbox]);

  const start = safeRender * perView;
  const visible: (PhysPage | null)[] = [];
  for (let k = 0; k < perView; k++) visible.push(physPages[start + k] ?? null);

  const atStart = safeSpread === 0;
  const atEnd = safeSpread >= maxSpread;

  const imgDisplaySize = (url: string) => {
    const nat = natSizes.get(url) ?? { w: 16, h: 9 };
    const maxH = 0.5 * leafH; // 50cqh
    const scale = Math.min(bodyW / nat.w, maxH / nat.h, 1);
    return { w: nat.w * scale, h: nat.h * scale };
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-3 py-8 gap-5">
      {/* Title band */}
      <div className="text-center">
        <p className="text-[11px] tracking-[0.4em] uppercase" style={{ ...cinzel, color: "#c8b681" }}>
          Chapter {toRoman(chapter)}
          {chapterTitle ? ` — ${chapterTitle}` : ""}
          {sessionNumber !== null ? ` · Session ${sessionNumber}` : ""}
        </p>
        <h1
          className="mt-1 text-2xl sm:text-4xl tracking-[0.08em]"
          style={{ ...cinzel, color: GOLD_HI, textShadow: "0 0 22px rgba(180,150,80,0.4)" }}
        >
          {title}
        </h1>
      </div>

      {/* Book */}
      <div
        className="relative w-full"
        style={{ maxWidth: perView === 2 ? "min(1240px, 97vw)" : "min(560px, 94vw)" }}
      >
        <div ref={bookRef} className="flex w-full" style={{ filter: "drop-shadow(0 30px 55px rgba(0,0,0,0.7))" }}>
          <Leaf page={visible[0]} side="left" visible={contentVisible} onImageClick={setLightbox} />
          {perView === 2 && (
            <Leaf page={visible[1]} side="right" visible={contentVisible} onImageClick={setLightbox} />
          )}
        </div>

        {/* Persistent flip arrows over the ornate side furniture */}
        <button
          onClick={prev}
          disabled={atStart}
          aria-label="Previous page"
          className="group absolute left-0 top-0 h-full flex items-center justify-start pl-1 sm:pl-2 disabled:cursor-default cursor-pointer"
          style={{ width: "13%" }}
        >
          <span
            className={`flex items-center justify-center rounded-full border text-2xl leading-none pb-1 transition-all duration-300 ${
              atStart ? "opacity-0" : "opacity-70 group-hover:opacity-100 group-hover:scale-110"
            }`}
            style={{ width: 44, height: 44, color: GOLD_HI, borderColor: `${GOLD_HI}88`, background: "rgba(20,14,6,0.6)", textShadow: "0 0 10px rgba(0,0,0,0.8)" }}
          >
            ‹
          </span>
        </button>
        <button
          onClick={next}
          disabled={atEnd}
          aria-label="Next page"
          className="group absolute right-0 top-0 h-full flex items-center justify-end pr-1 sm:pr-2 disabled:cursor-default cursor-pointer"
          style={{ width: "13%" }}
        >
          <span
            className={`flex items-center justify-center rounded-full border text-2xl leading-none pb-1 transition-all duration-300 ${
              atEnd ? "opacity-0" : "opacity-70 group-hover:opacity-100 group-hover:scale-110"
            }`}
            style={{ width: 44, height: 44, color: GOLD_HI, borderColor: `${GOLD_HI}88`, background: "rgba(20,14,6,0.6)", textShadow: "0 0 10px rgba(0,0,0,0.8)" }}
          >
            ›
          </span>
        </button>
      </div>

      {/* Spread indicator */}
      <p className="text-[11px] tracking-[0.3em] uppercase" style={{ ...cinzel, color: "#9c8a5f" }}>
        {safeSpread + 1} / {totalSpreads}
      </p>

      {/* Hidden measurer: lays out every section at the real page size. */}
      {bookW > 0 && imagesReady && (
        <div
          aria-hidden
          style={{ position: "absolute", left: -99999, top: 0, visibility: "hidden", pointerEvents: "none", width: leafW, height: leafH, containerType: "size" }}
        >
          {sections.map((sec, si) => (
            <div key={si} ref={bind(`flow-${si}`)} style={{ position: "relative", width: bodyW }}>
              {sec.heading && <HeadingBlock ref={bind(`h-${si}`)} text={sec.heading} />}
              {sec.items.map((it, j) =>
                it.type === "text" ? (
                  <Paragraph key={j} ref={bind(`it-${si}-${j}`)} text={it.text} dropCap={it.dropCap} />
                ) : (
                  <ImagePlaceholder key={j} ref={bind(`it-${si}-${j}`)} {...imgDisplaySize(it.url)} />
                )
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image lightbox — frame echoes the book's gilded leather edge */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-6 sm:p-12"
          style={{ background: "rgba(4,3,2,0.3)", backdropFilter: "blur(2px)", animation: "sbFade 160ms ease-out" }}
          onClick={() => setLightbox(null)}
        >
          <style>{`@keyframes sbFade{from{opacity:0}to{opacity:1}}@keyframes sbZoom{from{opacity:0;transform:scale(0.82)}to{opacity:1;transform:scale(1)}}`}</style>
          <button
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute top-4 right-5 flex items-center justify-center rounded-full border text-xl leading-none pb-0.5 cursor-pointer transition-transform hover:scale-110"
            style={{ width: 40, height: 40, color: GOLD_HI, borderColor: `${GOLD_HI}88`, background: "rgba(20,14,6,0.7)" }}
          >
            ✕
          </button>
          <div
            className="rounded-[3px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              animation: "sbZoom 220ms cubic-bezier(0.2, 0.8, 0.3, 1)",
              border: `2px solid ${GOLD}`,
              background: "#1a130a",
              boxShadow: [
                "0 0 0 3px #17110a",
                `0 0 0 5px ${GOLD_HI}`,
                "0 0 0 9px #1a130a",
                `0 0 0 11px ${GOLD}`,
                "0 24px 55px rgba(0,0,0,0.8)",
              ].join(", "),
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="" className="block object-contain" style={{ maxWidth: "66vw", maxHeight: "66vh" }} />
          </div>
        </div>
      )}
    </div>
  );
}
