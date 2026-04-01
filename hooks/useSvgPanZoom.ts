import { useState, useRef, useCallback, useEffect } from "react";

interface ViewBox { x: number; y: number; w: number; h: number }

interface UseSvgPanZoomOptions {
  width: number;
  height: number;
  initialViewBox?: { x: number; y: number; w: number; h: number };
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
}

export function useSvgPanZoom({
  width,
  height,
  initialViewBox,
  minZoom = 0.4,
  maxZoom = 10,
  zoomStep = 0.15,
}: UseSvgPanZoomOptions) {
  const defaultVb: ViewBox = initialViewBox ?? { x: 0, y: 0, w: width, h: height };

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const vbRef = useRef<ViewBox>(defaultVb);
  const [vb, setVb] = useState<ViewBox>(defaultVb);
  const [cursorGrab, setCursorGrab] = useState(false);

  const panStart = useRef<{ x: number; y: number; vbX: number; vbY: number } | null>(null);
  const pinchStart = useRef<{ dist: number; vb: ViewBox } | null>(null);
  const didDragRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const wheelRafRef = useRef<number | null>(null);
  const pinchRafRef = useRef<number | null>(null);
  const animRafRef = useRef<number | null>(null);
  const wheelHandlerRef = useRef<(e: WheelEvent) => void>(() => {});

  const zoom = width / vb.w;

  /** Apply viewBox imperatively to the SVG element (no React re-render) */
  const applyVb = useCallback((v: ViewBox) => {
    vbRef.current = v;
    if (svgRef.current) {
      svgRef.current.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
    }
  }, []);

  /** Synced setter — updates both imperative ref/DOM and React state */
  const syncedSetVb = useCallback((next: ViewBox | ((prev: ViewBox) => ViewBox)) => {
    const resolved = typeof next === "function" ? next(vbRef.current) : next;
    applyVb(resolved);
    setVb(resolved);
  }, [applyVb]);

  /** Convert screen coordinates to SVG coordinates (reads from vbRef for freshness) */
  const screenToSvg = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return { x: width / 2, y: height / 2 };
      const rect = el.getBoundingClientRect();
      const v = vbRef.current;
      return {
        x: v.x + ((clientX - rect.left) / rect.width) * v.w,
        y: v.y + ((clientY - rect.top) / rect.height) * v.h,
      };
    },
    [width, height]
  );

  /** Zoom at a point — imperative during gesture, commits React state */
  const zoomAt = useCallback((svgX: number, svgY: number, factor: number) => {
    const prev = vbRef.current;
    const newZoom = Math.min(maxZoom, Math.max(minZoom, (width / prev.w) * factor));
    const newW = width / newZoom;
    const newH = height / newZoom;
    const ratio = newW / prev.w;
    const next = {
      x: svgX - (svgX - prev.x) * ratio,
      y: svgY - (svgY - prev.y) * ratio,
      w: newW, h: newH,
    };
    syncedSetVb(next);
  }, [width, height, minZoom, maxZoom, syncedSetVb]);

  // --- Animated viewbox transition ---
  const isAnimatingRef = useRef(false);

  const cancelAnimation = useCallback(() => {
    const id = animRafRef.current;
    if (id !== null) {
      cancelAnimationFrame(id);
      animRafRef.current = null;
      isAnimatingRef.current = false;
    }
  }, []);

  const animateToVb = useCallback((target: ViewBox, durationMs = 500) => {
    cancelAnimation();
    isAnimatingRef.current = true;
    const start = { ...vbRef.current };
    const t0 = performance.now();
    const step = (now: number) => {
      const elapsed = now - t0;
      const raw = Math.min(elapsed / durationMs, 1);
      // ease-in-out cubic
      const t = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      const lerp = (a: number, b: number) => a + (b - a) * t;
      const current: ViewBox = {
        x: lerp(start.x, target.x),
        y: lerp(start.y, target.y),
        w: lerp(start.w, target.w),
        h: lerp(start.h, target.h),
      };
      if (raw < 1) {
        applyVb(current);
        animRafRef.current = requestAnimationFrame(step);
      } else {
        animRafRef.current = null;
        isAnimatingRef.current = false;
        syncedSetVb(target);
      }
    };
    animRafRef.current = requestAnimationFrame(step);
  }, [applyVb, syncedSetVb, cancelAnimation]);

  // --- Wheel zoom (RAF throttled) ---
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimation();
      const pt = screenToSvg(e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? 1 + zoomStep : 1 / (1 + zoomStep);
      if (wheelRafRef.current !== null) cancelAnimationFrame(wheelRafRef.current);
      wheelRafRef.current = requestAnimationFrame(() => {
        wheelRafRef.current = null;
        zoomAt(pt.x, pt.y, factor);
      });
    },
    [screenToSvg, zoomAt, zoomStep, cancelAnimation]
  );
  useEffect(() => {
    wheelHandlerRef.current = handleWheel;
  });

  // --- Mouse pan (imperative during drag, commit on mouseUp) ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      cancelAnimation();
      didDragRef.current = false;
      setCursorGrab(true);
      const v = vbRef.current;
      panStart.current = { x: e.clientX, y: e.clientY, vbX: v.x, vbY: v.y };
    },
    [cancelAnimation]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pan = panStart.current;
    if (!pan || !containerRef.current) return;
    if (Math.abs(e.clientX - pan.x) > 3 || Math.abs(e.clientY - pan.y) > 3) {
      didDragRef.current = true;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const prev = vbRef.current;
      applyVb({
        ...prev,
        x: pan.vbX - ((clientX - pan.x) / rect.width) * prev.w,
        y: pan.vbY - ((clientY - pan.y) / rect.height) * prev.h,
      });
    });
  }, [applyVb]);

  const handleMouseUp = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setCursorGrab(false);
    panStart.current = null;
    // Commit imperative state to React
    setVb(vbRef.current);
  }, []);

  // --- Touch pan + pinch zoom (imperative during gesture, commit on touchEnd) ---
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      cancelAnimation();
      const v = vbRef.current;
      if (e.touches.length === 1) {
        const t = e.touches[0];
        didDragRef.current = false;
        panStart.current = { x: t.clientX, y: t.clientY, vbX: v.x, vbY: v.y };
        pinchStart.current = null;
      } else if (e.touches.length === 2) {
        panStart.current = null;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStart.current = { dist: Math.sqrt(dx * dx + dy * dy), vb: { ...v } };
      }
    },
    [cancelAnimation]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && panStart.current && containerRef.current) {
      const t = e.touches[0];
      const pan = panStart.current;
      if (Math.abs(t.clientX - pan.x) > 3 || Math.abs(t.clientY - pan.y) > 3) {
        didDragRef.current = true;
      }
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = t.clientX;
      const clientY = t.clientY;
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const prev = vbRef.current;
        applyVb({
          ...prev,
          x: pan.vbX - ((clientX - pan.x) / rect.width) * prev.w,
          y: pan.vbY - ((clientY - pan.y) / rect.height) * prev.h,
        });
      });
    } else if (e.touches.length === 2 && pinchStart.current && containerRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const pinch = pinchStart.current;
      const rect = containerRef.current.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      if (pinchRafRef.current !== null) cancelAnimationFrame(pinchRafRef.current);
      pinchRafRef.current = requestAnimationFrame(() => {
        pinchRafRef.current = null;
        const scale = dist / pinch.dist;
        const svgX = pinch.vb.x + ((midX - rect.left) / rect.width) * pinch.vb.w;
        const svgY = pinch.vb.y + ((midY - rect.top) / rect.height) * pinch.vb.h;
        const newZoom = Math.min(maxZoom, Math.max(minZoom, (width / pinch.vb.w) * scale));
        const newW = width / newZoom;
        const newH = height / newZoom;
        const ratio = newW / pinch.vb.w;
        applyVb({
          x: svgX - (svgX - pinch.vb.x) * ratio,
          y: svgY - (svgY - pinch.vb.y) * ratio,
          w: newW, h: newH,
        });
      });
    }
  }, [width, height, minZoom, maxZoom, applyVb]);

  const handleTouchEnd = useCallback(() => {
    panStart.current = null;
    pinchStart.current = null;
    // Commit imperative state to React
    setVb(vbRef.current);
  }, []);

  // --- Event listener setup + cleanup ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => wheelHandlerRef.current(e);
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", prevent);
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      if (wheelRafRef.current !== null) cancelAnimationFrame(wheelRafRef.current);
      if (pinchRafRef.current !== null) cancelAnimationFrame(pinchRafRef.current);
      if (animRafRef.current !== null) cancelAnimationFrame(animRafRef.current);
    };
  }, []);

  const zoomIn = useCallback(
    () => {
      const v = vbRef.current;
      zoomAt(v.x + v.w / 2, v.y + v.h / 2, 1 + zoomStep * 2);
    },
    [zoomAt, zoomStep]
  );
  const zoomOut = useCallback(
    () => {
      const v = vbRef.current;
      zoomAt(v.x + v.w / 2, v.y + v.h / 2, 1 / (1 + zoomStep * 2));
    },
    [zoomAt, zoomStep]
  );

  const resetView = useCallback(() => {
    syncedSetVb({ x: 0, y: 0, w: width, h: height });
  }, [width, height, syncedSetVb]);

  return {
    containerRef,
    svgRef,
    vb,
    setVb: syncedSetVb,
    zoom,
    cursorGrab,
    didDragRef,
    zoomIn,
    zoomOut,
    resetView,
    animateToVb,
    isAnimatingRef,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
