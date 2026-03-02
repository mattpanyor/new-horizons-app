import { useState, useRef, useCallback, useEffect } from "react";

interface ViewBox { x: number; y: number; w: number; h: number }

interface UseSvgPanZoomOptions {
  width: number;
  height: number;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
}

export function useSvgPanZoom({
  width,
  height,
  minZoom = 0.4,
  maxZoom = 10,
  zoomStep = 0.15,
}: UseSvgPanZoomOptions) {
  const defaultVb: ViewBox = { x: 0, y: 0, w: width, h: height };

  const containerRef = useRef<HTMLDivElement>(null);
  const [vb, setVb] = useState<ViewBox>(defaultVb);
  const [cursorGrab, setCursorGrab] = useState(false);

  const panStart = useRef<{ x: number; y: number; vbX: number; vbY: number } | null>(null);
  const pinchStart = useRef<{ dist: number; vb: ViewBox } | null>(null);
  const didDragRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const wheelRafRef = useRef<number | null>(null);
  const pinchRafRef = useRef<number | null>(null);
  const wheelHandlerRef = useRef<(e: WheelEvent) => void>(() => {});

  const zoom = width / vb.w;

  const screenToSvg = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return { x: width / 2, y: height / 2 };
      const rect = el.getBoundingClientRect();
      return {
        x: vb.x + ((clientX - rect.left) / rect.width) * vb.w,
        y: vb.y + ((clientY - rect.top) / rect.height) * vb.h,
      };
    },
    [vb, width, height]
  );

  const zoomAt = useCallback((svgX: number, svgY: number, factor: number) => {
    setVb((prev) => {
      const newZoom = Math.min(maxZoom, Math.max(minZoom, (width / prev.w) * factor));
      const newW = width / newZoom;
      const newH = height / newZoom;
      const ratio = newW / prev.w;
      return {
        x: svgX - (svgX - prev.x) * ratio,
        y: svgY - (svgY - prev.y) * ratio,
        w: newW, h: newH,
      };
    });
  }, [width, height, minZoom, maxZoom]);

  // --- Wheel zoom (RAF throttled) ---
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const pt = screenToSvg(e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? 1 + zoomStep : 1 / (1 + zoomStep);
      if (wheelRafRef.current !== null) cancelAnimationFrame(wheelRafRef.current);
      wheelRafRef.current = requestAnimationFrame(() => {
        wheelRafRef.current = null;
        zoomAt(pt.x, pt.y, factor);
      });
    },
    [screenToSvg, zoomAt, zoomStep]
  );
  wheelHandlerRef.current = handleWheel;

  // --- Mouse pan ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      didDragRef.current = false;
      setCursorGrab(true);
      panStart.current = { x: e.clientX, y: e.clientY, vbX: vb.x, vbY: vb.y };
    },
    [vb.x, vb.y]
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
      setVb((prev) => ({
        ...prev,
        x: pan.vbX - ((clientX - pan.x) / rect.width) * prev.w,
        y: pan.vbY - ((clientY - pan.y) / rect.height) * prev.h,
      }));
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setCursorGrab(false);
    panStart.current = null;
  }, []);

  // --- Touch pan + pinch zoom ---
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        didDragRef.current = false;
        panStart.current = { x: t.clientX, y: t.clientY, vbX: vb.x, vbY: vb.y };
        pinchStart.current = null;
      } else if (e.touches.length === 2) {
        panStart.current = null;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStart.current = { dist: Math.sqrt(dx * dx + dy * dy), vb: { ...vb } };
      }
    },
    [vb]
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
        setVb((prev) => ({
          ...prev,
          x: pan.vbX - ((clientX - pan.x) / rect.width) * prev.w,
          y: pan.vbY - ((clientY - pan.y) / rect.height) * prev.h,
        }));
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
        setVb({
          x: svgX - (svgX - pinch.vb.x) * ratio,
          y: svgY - (svgY - pinch.vb.y) * ratio,
          w: newW, h: newH,
        });
      });
    }
  }, [width, height, minZoom, maxZoom]);

  const handleTouchEnd = useCallback(() => {
    panStart.current = null;
    pinchStart.current = null;
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
    };
  }, []);

  const zoomIn = useCallback(
    () => zoomAt(vb.x + vb.w / 2, vb.y + vb.h / 2, 1 + zoomStep * 2),
    [vb, zoomAt, zoomStep]
  );
  const zoomOut = useCallback(
    () => zoomAt(vb.x + vb.w / 2, vb.y + vb.h / 2, 1 / (1 + zoomStep * 2)),
    [vb, zoomAt, zoomStep]
  );

  const resetView = useCallback(() => {
    setVb({ x: 0, y: 0, w: width, h: height });
  }, [width, height]);

  return {
    containerRef,
    vb,
    setVb,
    zoom,
    cursorGrab,
    didDragRef,
    zoomIn,
    zoomOut,
    resetView,
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
