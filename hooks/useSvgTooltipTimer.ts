import { useState, useCallback, useRef, useEffect, useMemo } from "react";

/** Stable object bundling callbacks + refs — safe for React.memo */
export interface TooltipActions {
  readonly show: (id: string) => void;
  readonly scheduleHide: () => void;
  readonly proximityHide: () => void;
  readonly hideNow: () => void;
  readonly cardEnter: () => void;
  readonly cardLeave: () => void;
  readonly activeIdRef: React.RefObject<string | null>;
  readonly cardHoveredRef: React.RefObject<boolean>;
}

interface UseSvgTooltipTimerOptions {
  /** Delay before hiding after cursor leaves (ms). Default: 450 */
  hideDelay?: number;
  /** Threshold for instant hide on fly-by (ms). Default: 200 */
  flyByThreshold?: number;
}

export function useSvgTooltipTimer(options?: UseSvgTooltipTimerOptions) {
  const hideDelay = options?.hideDelay ?? 450;
  const flyByThreshold = options?.flyByThreshold ?? 200;

  const [activeId, setActiveId] = useState<string | null>(null);

  // Refs synced immediately (not via useEffect) to avoid stale values in RAF callbacks
  const activeIdRef = useRef<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAtRef = useRef<number>(0);
  const cardHoveredRef = useRef(false);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const show = useCallback((id: string) => {
    cancelHide();
    if (activeIdRef.current === id) return;
    activeIdRef.current = id;
    cardHoveredRef.current = false;
    shownAtRef.current = Date.now();
    setActiveId(id);
  }, [cancelHide]);

  const scheduleHide = useCallback(() => {
    // Always clear previous timer first — prevents orphan timers (bug #6)
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      activeIdRef.current = null;
      setActiveId(null);
    }, hideDelay);
  }, [hideDelay]);

  const proximityHide = useCallback(() => {
    const elapsed = Date.now() - shownAtRef.current;
    if (elapsed < flyByThreshold) {
      // Fly-by: hide instantly
      cancelHide();
      activeIdRef.current = null;
      setActiveId(null);
    } else {
      scheduleHide();
    }
  }, [flyByThreshold, cancelHide, scheduleHide]);

  /** Immediately hide — used when context changes (system switch, view reset) */
  const hideNow = useCallback(() => {
    cancelHide();
    activeIdRef.current = null;
    setActiveId(null);
  }, [cancelHide]);

  const cardEnter = useCallback(() => {
    cardHoveredRef.current = true;
    cancelHide();
  }, [cancelHide]);

  const cardLeave = useCallback(() => {
    cardHoveredRef.current = false;
    // Grace period: ignore rapid leave within 150ms of show (DOM re-render noise, bug #7)
    if (Date.now() - shownAtRef.current < 150) return;
    scheduleHide();
  }, [scheduleHide]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
  }, []);

  // Refs that delegate to the latest callback — structurally stable
  const showRef = useRef(show);
  const scheduleHideRef = useRef(scheduleHide);
  const proximityHideRef = useRef(proximityHide);
  const hideNowRef = useRef(hideNow);
  const cardEnterRef = useRef(cardEnter);
  const cardLeaveRef = useRef(cardLeave);
  useEffect(() => {
    showRef.current = show;
    scheduleHideRef.current = scheduleHide;
    proximityHideRef.current = proximityHide;
    hideNowRef.current = hideNow;
    cardEnterRef.current = cardEnter;
    cardLeaveRef.current = cardLeave;
  });

  // Stable actions object — identity never changes, safe for React.memo children
  const actions: TooltipActions = useMemo(() => ({
    show: (id: string) => showRef.current(id),
    scheduleHide: () => scheduleHideRef.current(),
    proximityHide: () => proximityHideRef.current(),
    hideNow: () => hideNowRef.current(),
    cardEnter: () => cardEnterRef.current(),
    cardLeave: () => cardLeaveRef.current(),
    activeIdRef, cardHoveredRef,
  }), []);

  return {
    activeId,
    actions,
    // Keep flat exports for backward compat (marker tooltip in SectorMap)
    activeIdRef,
    cardHoveredRef,
    show,
    hideNow,
    scheduleHide,
    proximityHide,
    cancelHide,
    cardEnter,
    cardLeave,
  };
}
