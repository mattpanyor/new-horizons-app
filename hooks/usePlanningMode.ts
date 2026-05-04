import { useState, useRef, useCallback, useMemo, useEffect, type RefObject } from "react";
import { MAX_WAYPOINTS, WAYPOINT_HIT_R, type Waypoint } from "@/lib/planningMode";

interface UsePlanningModeOptions {
  /** Ref to the SVG element — used for accurate coordinate conversion via getScreenCTM */
  svgRef: RefObject<SVGSVGElement | null>;
  /** Current zoom level — scales hit radius so tapping feels consistent */
  zoom: number;
  /**
   * Returns true when (x, y) is a valid placement point within the sector territory.
   * Used to reject out-of-bounds clicks/taps with a tooltip warning.
   * Should be stable (useCallback) — it is a dep of the mouse/touch handlers.
   */
  isValidPoint: (x: number, y: number) => boolean;
}

/** Time window (ms) after a touch event during which synthetic mouse events are ignored */
const TOUCH_MOUSE_GUARD = 500;

/** How long the out-of-bounds warning tooltip stays visible (ms) */
const OOB_WARN_MS = 1500;

export function usePlanningMode({ svgRef, zoom, isValidPoint }: UsePlanningModeOptions) {
  const isOutOfBounds = useCallback((x: number, y: number) =>
    !isValidPoint(x, y),
  [isValidPoint]);
  const [active, setActive] = useState(false);
  const activeRef = useRef(false); // mirrors active for synchronous reads inside toggle()
  // Update after render (not during render) to satisfy the react-hooks/refs lint rule.
  // Safe for toggle(): user events always run after effects have flushed.
  useEffect(() => { activeRef.current = active; });

  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const waypointsRef = useRef<Waypoint[]>(waypoints);
  // Update after render (not during render) — handlers run on user events, which
  // always fire after effects have flushed, so the synchronous reads are safe.
  useEffect(() => { waypointsRef.current = waypoints; });

  /** Client-space position of the last rejected OOB click/tap, or null when no warning is showing */
  const [outOfBoundsPos, setOutOfBoundsPos] = useState<{ x: number; y: number } | null>(null);
  const oobTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the OOB timer on unmount to avoid setState on an unmounted component
  useEffect(() => {
    return () => { if (oobTimerRef.current) clearTimeout(oobTimerRef.current); };
  }, []);

  const showOobWarning = useCallback((clientX: number, clientY: number) => {
    if (oobTimerRef.current) clearTimeout(oobTimerRef.current);
    setOutOfBoundsPos({ x: clientX, y: clientY });
    oobTimerRef.current = setTimeout(() => setOutOfBoundsPos(null), OOB_WARN_MS);
  }, []);

  /** Convert client (screen) coordinates to SVG coordinates using the browser's CTM */
  const clientToSvg = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, [svgRef]);

  // Drag state (not in React state to avoid re-renders during RAF)
  const draggingRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  // Touch state — pending placement deferred to touchEnd, and guard against synthetic mouse events
  const pendingPlaceRef = useRef<{ x: number; y: number } | null>(null);
  /** Client-space anchor for a deferred OOB tap — set in touchStart, fired in touchEnd */
  const pendingOobClientRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchTimeRef = useRef(0);

  const toggle = useCallback(() => {
    if (activeRef.current) {
      // Deactivating — clear all interaction state synchronously before the render.
      // Do NOT mutate refs inside a setState updater: React Strict Mode double-invokes updaters.
      setWaypoints([]);
      draggingRef.current = null;
      dragStartRef.current = null;
      didDragRef.current = false;
      pendingPlaceRef.current = null;
      pendingOobClientRef.current = null;
      if (oobTimerRef.current) clearTimeout(oobTimerRef.current);
      setOutOfBoundsPos(null);
    }
    setActive(prev => !prev);
  }, []); // intentionally stable (empty deps) — reads activeRef.current at call time

  /** Find which waypoint index is at the given SVG coords, or -1 */
  const hitTest = useCallback(
    (svgX: number, svgY: number, wps: Waypoint[]): number => {
      const hitR = WAYPOINT_HIT_R / zoom; // scale hit radius by zoom
      for (let i = 0; i < wps.length; i++) {
        const dx = svgX - wps[i].x;
        const dy = svgY - wps[i].y;
        if (dx * dx + dy * dy <= hitR * hitR) return i;
      }
      return -1;
    },
    [zoom]
  );

  // ── Mouse handlers (blocked after recent touch to prevent synthetic events) ──

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!active || e.button !== 0) return false;
      if (Date.now() - lastTouchTimeRef.current < TOUCH_MOUSE_GUARD) return true; // block synthetic
      const svg = clientToSvg(e.clientX, e.clientY);
      if (!svg) return false;

      const wps = waypointsRef.current;
      const idx = hitTest(svg.x, svg.y, wps);
      if (idx >= 0) {
        // Dragging an existing waypoint — always allowed (waypoint is already in bounds)
        draggingRef.current = idx;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        didDragRef.current = false;
        return true;
      }
      // New placement — reject with warning if outside the sector canvas
      if (isOutOfBounds(svg.x, svg.y)) {
        showOobWarning(e.clientX, e.clientY);
        return true; // consume the event so pan-zoom doesn't also fire
      }
      if (wps.length < MAX_WAYPOINTS) {
        setWaypoints(prev => [...prev, { x: svg.x, y: svg.y }]);
        return true;
      }
      return false;
    },
    [active, clientToSvg, hitTest, showOobWarning, isOutOfBounds]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggingRef.current === null) return false;
      const dx = e.clientX - (dragStartRef.current?.x ?? 0);
      const dy = e.clientY - (dragStartRef.current?.y ?? 0);
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;

      const svg = clientToSvg(e.clientX, e.clientY);
      if (!svg) return false;
      const idx = draggingRef.current;
      setWaypoints(prev => {
        const next = [...prev];
        if (next[idx]) next[idx] = { x: svg.x, y: svg.y };
        return next;
      });
      return true;
    },
    [clientToSvg]
  );

  const handleMouseUp = useCallback(() => {
    if (Date.now() - lastTouchTimeRef.current < TOUCH_MOUSE_GUARD) return true; // block synthetic
    const idx = draggingRef.current;
    if (idx === null) return false;

    if (!didDragRef.current) {
      setWaypoints(prev => prev.filter((_, i) => i !== idx));
    }

    draggingRef.current = null;
    dragStartRef.current = null;
    didDragRef.current = false;
    return true;
  }, []);

  // ── Touch handlers — placement deferred to touchEnd for proper tap detection ──

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!active) return false;
      lastTouchTimeRef.current = Date.now();

      // Second finger arrived → cancel any pending placement/OOB (it's a pinch)
      if (e.touches.length > 1) {
        pendingPlaceRef.current = null;
        pendingOobClientRef.current = null;
        return false; // let pan/zoom handle the pinch
      }

      const t = e.touches[0];
      const svg = clientToSvg(t.clientX, t.clientY);
      if (!svg) return false;

      const wps = waypointsRef.current;
      const idx = hitTest(svg.x, svg.y, wps);
      if (idx >= 0) {
        // Start dragging existing waypoint
        draggingRef.current = idx;
        dragStartRef.current = { x: t.clientX, y: t.clientY };
        didDragRef.current = false;
        pendingPlaceRef.current = null;
        pendingOobClientRef.current = null;
        return true;
      }

      // OOB check deferred to touchEnd — we cannot know intent at touchStart (may be a pan/pinch).
      // IMPORTANT: return false here so pan/zoom's handleTouchStart also runs and sets panStart.
      // Returning true would block pan/zoom, making the map unresponsive to panning from OOB areas.
      if (isOutOfBounds(svg.x, svg.y)) {
        pendingOobClientRef.current = { x: t.clientX, y: t.clientY };
        dragStartRef.current = { x: t.clientX, y: t.clientY };
        didDragRef.current = false;
        return false; // let pan/zoom also track — OOB warning fires at touchEnd if still a clean tap
      }

      if (wps.length < MAX_WAYPOINTS) {
        // Defer placement — store raw coords so placement is confirmed at touchEnd.
        pendingPlaceRef.current = { x: svg.x, y: svg.y };
        dragStartRef.current = { x: t.clientX, y: t.clientY };
        didDragRef.current = false;
        return false; // let pan/zoom also track — we decide on touchEnd
      }
      return false;
    },
    [active, clientToSvg, hitTest, isOutOfBounds]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      lastTouchTimeRef.current = Date.now();

      // If multiple fingers or moved far → cancel pending placement
      if (e.touches.length !== 1) {
        pendingPlaceRef.current = null;
        return false;
      }

      const t = e.touches[0];
      const dx = t.clientX - (dragStartRef.current?.x ?? 0);
      const dy = t.clientY - (dragStartRef.current?.y ?? 0);
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        didDragRef.current = true;
        pendingPlaceRef.current = null;    // moved too far — it's a pan, not a tap
        pendingOobClientRef.current = null; // likewise cancel any pending OOB warning
      }

      // Dragging an existing waypoint — clamp silently to boundary
      if (draggingRef.current !== null) {
        const svg = clientToSvg(t.clientX, t.clientY);
        if (!svg) return false;
        const idx = draggingRef.current;
        setWaypoints(prev => {
          const next = [...prev];
          if (next[idx]) next[idx] = { x: svg.x, y: svg.y };
          return next;
        });
        return true;
      }

      // Pending place — don't consume, pan/zoom handles movement
      return false;
    },
    [clientToSvg]
  );

  const handleTouchEnd = useCallback(() => {
    lastTouchTimeRef.current = Date.now();

    // Finish dragging an existing waypoint
    const idx = draggingRef.current;
    if (idx !== null) {
      if (!didDragRef.current) {
        // Tap on existing waypoint without drag → remove it
        setWaypoints(prev => prev.filter((_, i) => i !== idx));
      }
      draggingRef.current = null;
      dragStartRef.current = null;
      didDragRef.current = false;
      return true;
    }

    // OOB tap — was a clean single-finger tap in out-of-bounds territory
    // pendingOobClientRef is set by handleTouchStart when isOutOfBounds was true,
    // and cleared by handleTouchMove if the gesture became a pan.
    const oobAnchor = pendingOobClientRef.current;
    if (oobAnchor && !didDragRef.current) {
      showOobWarning(oobAnchor.x, oobAnchor.y);
      pendingOobClientRef.current = null;
      dragStartRef.current = null;
      didDragRef.current = false;
      return true;
    }

    // Place deferred waypoint (was a clean tap, no pinch/pan)
    // pendingPlaceRef only holds in-bounds coords — OOB positions go through pendingOobClientRef.
    const pending = pendingPlaceRef.current;
    if (pending && !didDragRef.current) {
      setWaypoints(prev =>
        prev.length < MAX_WAYPOINTS ? [...prev, pending] : prev
      );
      pendingPlaceRef.current = null;
      dragStartRef.current = null;
      didDragRef.current = false;
      return true;
    }

    dragStartRef.current = null;
    didDragRef.current = false;
    return false;
  }, [showOobWarning]);

  const handlers = useMemo(() => ({
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  }), [handleMouseDown, handleMouseMove, handleMouseUp, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    active,
    toggle,
    waypoints,
    handlers,
    /** Client-space position of the last rejected out-of-bounds tap, shown for OOB_WARN_MS then cleared */
    outOfBoundsPos,
  };
}
