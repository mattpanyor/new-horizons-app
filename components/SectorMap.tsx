"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { SectorMetadata, SystemPin } from "@/types/sector";
import type { StarSystemMetadata } from "@/types/starsystem";
import { useSvgTooltipTimer } from "@/hooks/useSvgTooltipTimer";
import { useSvgPanZoom } from "@/hooks/useSvgPanZoom";
import {
  FULL_W, FULL_H,
  MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, FOCUS_ZOOM, AUTO_SELECT_ZOOM,
  SYS_MAX_R, SYS_SCALE,
  isInSectorTerritory,
} from "@/lib/sectorMapHelpers";
import { ConnectionMarkerLayer } from "@/components/sectormap/ConnectionMarkerLayer";
import { StarSystemView } from "@/components/sectormap/StarSystemView";
import { SearchOverlay } from "@/components/sectormap/SearchOverlay";
import { usePlanningMode } from "@/hooks/usePlanningMode";
import { PlanningLayer } from "@/components/sectormap/PlanningLayer";
import { PlanningTotalBox } from "@/components/sectormap/PlanningTotalBox";
import { PlanningToggle } from "@/components/sectormap/PlanningToggle";
import { PLANNING_COLOR } from "@/lib/planningMode";

const noop = () => {};
const noopStr = (_s: string | null) => {};

interface SectorMapProps {
  sector: SectorMetadata;
  systemsData?: Record<string, StarSystemMetadata>;
  onSystemChange?: (slug: string | null) => void;
  children?: React.ReactNode;
  staticSvgLayers: React.ReactNode;
}

export default function SectorMap({ sector, systemsData = {}, onSystemChange, children, staticSvgLayers }: SectorMapProps) {
  const {
    containerRef, svgRef, vb, zoom, cursorGrab, didDragRef,
    zoomIn, zoomOut, resetView: resetPanZoom, animateToVb, isAnimatingRef, handlers,
  } = useSvgPanZoom({ width: FULL_W, height: FULL_H, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, zoomStep: ZOOM_STEP });

  const isValidPlanningPoint = useCallback(
    (x: number, y: number) => isInSectorTerritory(x, y, sector.slug),
    [sector.slug],
  );

  const planning = usePlanningMode({ svgRef, zoom, isValidPoint: isValidPlanningPoint });
  // Destructure stable primitives for use in effects (satisfies react-hooks/exhaustive-deps).
  // planning.toggle is stable (useCallback []), planning.active is a primitive boolean.
  const { active: planningActive, toggle: planningToggle } = planning;

  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [activeSystemSlug, setActiveSystemSlug] = useState<string | null>(null);
  const cursorClientRef = useRef<{ x: number; y: number } | null>(null);

  // Body tooltip (in-system celestial bodies)
  const {
    activeId: activeBodyId, actions: bodyTooltipActions,
    activeIdRef: activeBodyIdRef,
    hideNow: hideBody,
  } = useSvgTooltipTimer();

  // Marker tooltip (inter-system ships/fleets on connection lines)
  const {
    activeId: activeMarkerId,
    show: showMarker, scheduleHide: scheduleHideMarker,
    cardEnter: markerCardEnter, cardLeave: markerCardLeave,
    activeIdRef: activeMarkerIdRef, hideNow: hideMarker,
  } = useSvgTooltipTimer();

  useEffect(() => {
    onSystemChange?.(activeSystemSlug);
  }, [activeSystemSlug, onSystemChange]);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent) => {
    cursorClientRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  // ── Planning mode event wrappers ──
  // Planning mode intercepts events first; if consumed, skip pan/zoom & normal interactions.
  const wrappedHandlers = useMemo(() => ({
    onMouseDown: (e: React.MouseEvent) => {
      if (planning.handlers.onMouseDown(e)) return;
      handlers.onMouseDown(e);
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (planning.handlers.onMouseMove(e)) return;
      handlers.onMouseMove(e);
    },
    onMouseUp: (e: React.MouseEvent) => {
      if (planning.handlers.onMouseUp()) return;
      handlers.onMouseUp();
    },
    onTouchStart: (e: React.TouchEvent) => {
      if (planning.handlers.onTouchStart(e)) return;
      handlers.onTouchStart(e);
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (planning.handlers.onTouchMove(e)) return;
      handlers.onTouchMove(e);
    },
    onTouchEnd: () => {
      planning.handlers.onTouchEnd();
      handlers.onTouchEnd(); // always run — viewbox commit is a no-op if no pan occurred
    },
  }), [planning.handlers, handlers]);

  /** Find which system pin the cursor is over (in SVG space), or null. */
  const systemUnderCursor = useCallback(() => {
    const svg = svgRef.current;
    const cursor = cursorClientRef.current;
    if (!svg || !cursor) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = cursor.x;
    pt.y = cursor.y;
    const svgPt = pt.matrixTransform(ctm.inverse());
    for (const pin of sector.systems) {
      const sys = systemsData[pin.slug];
      const maxOrbit = sys
        ? Math.max(...sys.bodies.map(b => b.orbitDistance), 0.3) * SYS_MAX_R
        : 40;
      const hitR = (maxOrbit + 50) * SYS_SCALE;
      const dx = svgPt.x - pin.x;
      const dy = svgPt.y - pin.y;
      if (dx * dx + dy * dy <= hitR * hitR) return pin.slug;
    }
    return null;
  }, [svgRef, sector.systems, systemsData]);

  const resetView = useCallback(() => {
    const wasActive = activeSystemSlug !== null;
    setActiveSystemSlug(null);
    setHoveredSlug(wasActive ? null : systemUnderCursor());
    hideBody();
    if (wasActive) {
      animateToVb({ x: 0, y: 0, w: FULL_W, h: FULL_H }, 500);
    } else {
      resetPanZoom();
    }
  }, [activeSystemSlug, hideBody, resetPanZoom, animateToVb, systemUnderCursor]);

  const focusSystem = useCallback((pin: SystemPin) => {
    setActiveSystemSlug(pin.slug);
    setHoveredSlug(null);
    hideBody();
    const w = FULL_W / FOCUS_ZOOM;
    const h = FULL_H / FOCUS_ZOOM;
    animateToVb({ x: pin.x - w / 2, y: pin.y - h / 2, w, h }, 500);
  }, [hideBody, animateToVb]);

  const exitSystem = useCallback(() => {
    setActiveSystemSlug(null);
    setHoveredSlug(systemUnderCursor());
    hideBody();
    animateToVb({ x: 0, y: 0, w: FULL_W, h: FULL_H }, 500);
  }, [hideBody, animateToVb, systemUnderCursor]);

  const focusBodyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const focusBody = useCallback((pin: SystemPin, bodyId: string) => {
    if (focusBodyTimerRef.current) clearTimeout(focusBodyTimerRef.current);
    focusSystem(pin);
    focusBodyTimerRef.current = setTimeout(() => {
      focusBodyTimerRef.current = null;
      bodyTooltipActions.show(bodyId);
    }, 550);
  }, [focusSystem, bodyTooltipActions]);

  useEffect(() => {
    return () => { if (focusBodyTimerRef.current) clearTimeout(focusBodyTimerRef.current); };
  }, []);

  // Escape key — single handler with priority: planning mode first, then system zoom.
  // Consolidated to prevent both actions firing when both states are active simultaneously
  // (user can activate planning mode while already zoomed into a system).
  useEffect(() => {
    if (!planningActive && !activeSystemSlug) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (planningActive) {
        planningToggle();
      } else if (activeSystemSlug) {
        exitSystem();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [planningActive, planningToggle, activeSystemSlug, exitSystem]);

  // Auto-select system when zoomed in close enough (skip during animation)
  useEffect(() => {
    if (isAnimatingRef.current) return;
    const currentZoom = FULL_W / vb.w;
    if (currentZoom >= AUTO_SELECT_ZOOM && !activeSystemSlug) {
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      let best: SystemPin | null = null;
      let bestDist = Infinity;
      for (const pin of sector.systems) {
        const dx = pin.x - cx;
        const dy = pin.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) { bestDist = dist; best = pin; }
      }
      if (best && bestDist < Math.min(vb.w, vb.h) * 0.6) {
        setActiveSystemSlug(best.slug);
        setHoveredSlug(null);
        hideBody();
      }
    } else if (currentZoom < AUTO_SELECT_ZOOM && activeSystemSlug) {
      setActiveSystemSlug(null);
      setHoveredSlug(systemUnderCursor());
      hideBody();
    }
  }, [vb, activeSystemSlug, sector.systems, hideBody, systemUnderCursor, isAnimatingRef]);

  const handleSvgClick = useCallback(() => {
    if (planning.active) return; // planning mode handles its own clicks
    if (didDragRef.current) return;
    if (activeBodyIdRef.current) hideBody();
    if (activeMarkerIdRef.current) hideMarker();
  }, [planning.active, didDragRef, activeBodyIdRef, hideBody, activeMarkerIdRef, hideMarker]);

  // ── Memoized data ──

  // Precompute which system owns the active body tooltip — O(N*M) once instead of per-system
  const activeBodySystemSlug = useMemo(() => {
    if (!activeBodyId) return null;
    for (const pin of sector.systems) {
      const sys = systemsData[pin.slug];
      if (sys?.bodies.some(b => b.id === activeBodyId)) return pin.slug;
    }
    return null;
  }, [activeBodyId, sector.systems, systemsData]);

  const orbitDataMap = useMemo(() => {
    const map = new Map<string, { orbitDistances: number[]; maxOrbit: number }>();
    for (const pin of sector.systems) {
      const sys = systemsData[pin.slug];
      if (sys) {
        const orbitDistances = [...new Set(sys.bodies.map((b) => b.orbitDistance))].sort();
        const maxOrbit = Math.max(...sys.bodies.map((b) => b.orbitDistance), 0.3) * SYS_MAX_R;
        map.set(pin.slug, { orbitDistances, maxOrbit });
      } else {
        map.set(pin.slug, { orbitDistances: [], maxOrbit: 40 });
      }
    }
    return map;
  }, [sector.systems, systemsData]);

  // Viewport-clamped position for the OOB tooltip.
  // Always-present container (visibility toggled) is required for reliable screen reader
  // announcements — conditionally mounting role="alert" with content already set is not
  // reliably announced on all browser/SR combinations (especially Safari + VoiceOver).
  const oobTooltipPos = planning.outOfBoundsPos ? {
    left: Math.min(planning.outOfBoundsPos.x + 14, window.innerWidth - 204),
    top: Math.min(planning.outOfBoundsPos.y + 14, window.innerHeight - 40),
  } : null;

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden rounded-lg border transition-all duration-300"
        style={{
          cursor: planning.active ? "crosshair" : cursorGrab ? "grabbing" : "grab",
          touchAction: "none",
          borderColor: planning.active ? PLANNING_COLOR : "rgba(99,102,241,0.2)",
          boxShadow: planning.active ? `0 0 12px ${PLANNING_COLOR}40, inset 0 0 12px ${PLANNING_COLOR}10` : "none",
        }}
        {...wrappedHandlers}
        onMouseLeave={handlers.onMouseUp}
        onDoubleClick={() => { if (!didDragRef.current && !planning.active) resetView(); }}
      >
        {/* ── Layers 1-2: Static nebula + grid (server-rendered children) ── */}
        {children}

        {/* ── Layer 3: Zooming SVG ── */}
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="absolute inset-0 w-full h-full"
          style={{ userSelect: "none" }}
          onClick={handleSvgClick}
          onMouseMove={handleSvgMouseMove}
        >
          {/* ── Static SVG layers (server-rendered: gradients, territories, vortexes) ── */}
          {staticSvgLayers}

          {/* ── Connection lines ── */}
          <ConnectionMarkerLayer
            connections={sector.connections ?? []}
            systems={sector.systems}
            vortexes={sector.vortexes ?? []}
            sectorSlug={sector.slug}
            orbitDataMap={orbitDataMap}
            activeMarkerId={activeMarkerId}
            showMarker={showMarker}
            scheduleHideMarker={scheduleHideMarker}
            markerCardEnter={markerCardEnter}
            markerCardLeave={markerCardLeave}
            vb={vb}
          />

          {/* ── Star systems ── */}
          {sector.systems.map((pin) => {
            const sys = systemsData[pin.slug];
            const isActive = activeSystemSlug === pin.slug;
            return (
              <StarSystemView
                key={pin.slug}
                pin={pin}
                sys={sys}
                sectorSlug={sector.slug}
                sectorColor={sector.color}
                isActive={isActive}
                isDimmed={activeSystemSlug !== null && !isActive}
                noActiveSystem={activeSystemSlug === null}
                isHovered={!planning.active && hoveredSlug === pin.slug}
                orbitData={orbitDataMap.get(pin.slug) ?? { orbitDistances: [], maxOrbit: 40 }}
                vb={isActive ? vb : undefined}
                activeBodyId={!planning.active && activeBodySystemSlug === pin.slug ? activeBodyId : null}
                tooltipActions={bodyTooltipActions}
                onFocusSystem={planning.active ? noop : focusSystem}
                onHoverSystem={planning.active ? noopStr : setHoveredSlug}
              />
            );
          })}

          {/* ── Planning mode overlay ── */}
          {planning.active && (
            <PlanningLayer waypoints={planning.waypoints} vb={vb} />
          )}

          {/* Empty state */}
          {sector.systems.length === 0 && (
            <g style={{ pointerEvents: "none" }}>
              <text x={FULL_W / 2} y={FULL_H / 2 - 10}
                textAnchor="middle" dominantBaseline="middle"
                fill="rgba(255,255,255,0.18)" fontSize="18"
                fontFamily="var(--font-cinzel), serif">
                No charted systems in this sector
              </text>
              <text x={FULL_W / 2} y={FULL_H / 2 + 18}
                textAnchor="middle"
                fill="rgba(255,255,255,0.1)" fontSize="12"
                fontFamily="var(--font-cinzel), serif">
                This region awaits exploration
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* ── Planning total box ── */}
      {planning.active && (
        <PlanningTotalBox waypoints={planning.waypoints} onExit={planning.toggle} />
      )}

      {/* ── Out-of-bounds warning tooltip ── */}
      {/* Always present in the DOM so role="alert" is a registered live region before content
          is injected — conditionally mounting causes silent failures on Safari + VoiceOver. */}
      <div
        role="alert"
        aria-atomic="true"
        className="pointer-events-none select-none"
        style={{
          position: "fixed",
          left: oobTooltipPos?.left ?? -9999,
          top: oobTooltipPos?.top ?? -9999,
          visibility: oobTooltipPos ? "visible" : "hidden",
          background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(8px)",
          border: "1px solid #fbbf2460",
          color: "#fbbf24",
          fontSize: 11,
          fontFamily: "var(--font-cinzel), serif",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          padding: "6px 14px",
          borderRadius: 6,
          boxShadow: "0 0 12px #fbbf2420",
          zIndex: 50,
        }}
      >
        {oobTooltipPos ? "Outside sector bounds" : ""}
      </div>

      {/* ── Controls ── */}
      {activeSystemSlug && (
        <button
          onClick={exitSystem}
          className="absolute top-3 left-3 z-10 flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-1.5 md:py-2.5 rounded scifi-card text-xs md:text-xl text-slate-300 hover:text-white transition-colors"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          <span>&#x2190;</span>
          <span>Sector</span>
        </button>
      )}

      <div className="absolute top-3 right-3 z-20">
        <SearchOverlay
          sector={sector}
          systemsData={systemsData}
          onSelectSystem={focusSystem}
          onSelectBody={focusBody}
        />
      </div>

      <div className="absolute top-14 right-3 flex flex-col gap-1.5 z-10">
        <button onClick={zoomIn} aria-label="Zoom in"
          className="w-8 h-8 rounded scifi-card flex items-center justify-center text-white/70 hover:text-white text-lg leading-none transition-colors">
          +
        </button>
        <button onClick={zoomOut} aria-label="Zoom out"
          className="w-8 h-8 rounded scifi-card flex items-center justify-center text-white/70 hover:text-white text-lg leading-none transition-colors">
          &#x2212;
        </button>
        <button onClick={resetView} aria-label="Reset view"
          className="w-8 h-8 rounded scifi-card flex items-center justify-center text-white/70 hover:text-white text-xs leading-none transition-colors">
          &#x21BB;
        </button>
        <PlanningToggle active={planning.active} onToggle={planning.toggle} />
      </div>

      <div className="absolute bottom-3 left-3 text-[10px] text-slate-500 select-none pointer-events-none">
        {zoom.toFixed(1)}x
      </div>
    </div>
  );
}
