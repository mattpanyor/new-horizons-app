"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { SectorMetadata, VortexPin, SystemPin } from "@/types/sector";
import type { StarSystemMetadata } from "@/types/starsystem";
import { getBodyColors, FLEET_GRAD_TIP, FLEET_GRAD_BASE } from "@/lib/bodyColors";

import { useSvgTooltipTimer } from "@/hooks/useSvgTooltipTimer";
import { useSvgPanZoom } from "@/hooks/useSvgPanZoom";
import {
  FULL_W, FULL_H,
  MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, FOCUS_ZOOM, AUTO_SELECT_ZOOM,
  SYS_MAX_R, SYS_SCALE, wavyCloudPath,
} from "@/lib/sectorMapHelpers";
import { SectorArcLayer } from "@/components/sectormap/SectorArcLayer";
import { ConnectionLayer } from "@/components/sectormap/ConnectionLayer";
import { TerritoryLayer } from "@/components/sectormap/TerritoryLayer";
import { StarSystemView } from "@/components/sectormap/StarSystemView";
import { SearchOverlay } from "@/components/sectormap/SearchOverlay";

interface SectorMapProps {
  sector: SectorMetadata;
  systemsData?: Record<string, StarSystemMetadata>;
  onSystemChange?: (slug: string | null) => void;
  children?: React.ReactNode;
}

export default function SectorMap({ sector, systemsData = {}, onSystemChange, children }: SectorMapProps) {
  const {
    containerRef, svgRef, vb, zoom, cursorGrab, didDragRef,
    zoomIn, zoomOut, resetView: resetPanZoom, animateToVb, isAnimatingRef, handlers,
  } = useSvgPanZoom({ width: FULL_W, height: FULL_H, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, zoomStep: ZOOM_STEP });

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

  // Escape key exits system zoom
  useEffect(() => {
    if (!activeSystemSlug) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") exitSystem(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSystemSlug, exitSystem]);

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
    if (didDragRef.current) return;
    if (activeBodyIdRef.current) hideBody();
    if (activeMarkerIdRef.current) hideMarker();
  }, [didDragRef, activeBodyIdRef, hideBody, activeMarkerIdRef, hideMarker]);

  // ── Memoized data ──

  const gradientDefs = useMemo(() => (
    <defs>
      <linearGradient id={`fleetGrad-${sector.slug}`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor={FLEET_GRAD_TIP} />
        <stop offset="100%" stopColor={FLEET_GRAD_BASE} />
      </linearGradient>
      {sector.systems.flatMap((pin) => {
        const sys = systemsData[pin.slug];
        if (!sys) return [];
        return [
          <radialGradient key={`starGlow-${pin.slug}`} id={`starGlow-${pin.slug}`}>
            <stop offset="0%" stopColor={sys.star.color} stopOpacity="1" />
            <stop offset="30%" stopColor={sys.star.color} stopOpacity="0.8" />
            <stop offset="60%" stopColor={sys.star.secondaryColor ?? sys.star.color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={sys.star.secondaryColor ?? sys.star.color} stopOpacity="0" />
          </radialGradient>,
          <radialGradient key={`starCorona-${pin.slug}`} id={`starCorona-${pin.slug}`}>
            <stop offset="0%" stopColor={sys.star.color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={sys.star.color} stopOpacity="0" />
          </radialGradient>,
          ...sys.bodies.map((b) => {
            const { color, secondaryColor } = getBodyColors(b);
            return (
              <radialGradient key={`body-${pin.slug}-${b.id}`} id={`body-${pin.slug}-${b.id}`}>
                <stop offset="0%" stopColor={color} stopOpacity="1" />
                <stop offset="70%" stopColor={secondaryColor} stopOpacity="0.9" />
                <stop offset="100%" stopColor={secondaryColor} stopOpacity="0.7" />
              </radialGradient>
            );
          }),
        ];
      })}
    </defs>
  ), [sector.slug, sector.systems, systemsData]);

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

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden rounded-lg border border-indigo-500/20"
        style={{ cursor: cursorGrab ? "grabbing" : "grab", touchAction: "none" }}
        {...handlers}
        onMouseLeave={handlers.onMouseUp}
        onDoubleClick={() => { if (!didDragRef.current) resetView(); }}
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
          {gradientDefs}

          {/* ── Sector territory ── */}
          <SectorArcLayer sectorSlug={sector.slug} sectorName={sector.name} sectorColor={sector.color} />

          {/* ── System allegiance territories ── */}
          <TerritoryLayer systems={sector.systems} sectorSlug={sector.slug} />

          {/* ── Connection lines ── */}
          <ConnectionLayer
            connections={sector.connections ?? []}
            systems={sector.systems}
            vortexes={sector.vortexes ?? []}
            sectorSlug={sector.slug}
            sectorColor={sector.color}
            orbitDataMap={orbitDataMap}
            activeMarkerId={activeMarkerId}
            showMarker={showMarker}
            scheduleHideMarker={scheduleHideMarker}
            markerCardEnter={markerCardEnter}
            markerCardLeave={markerCardLeave}
            vb={vb}
          />

          {/* ── Vortexes ── */}
          {(sector.vortexes ?? []).map((v: VortexPin) => {
            const color = v.color ?? sector.color;
            const r = v.radius ?? 80;
            const [rw, rh] = v.ratio ?? [1, 1];
            const ry = r * (rh / Math.max(rw, rh));
            return (
              <g key={v.slug} style={{ pointerEvents: "none" }}>
                <path d={wavyCloudPath(v.x, v.y, r, { ratio: v.ratio })}
                  fill={color} fillOpacity={0.12}
                  stroke={color} strokeOpacity={0.35} strokeWidth={1.5} />
                <text x={v.x} y={v.y + ry + 18} textAnchor="middle"
                  fill={color} fillOpacity={0.75} fontSize="11"
                  fontFamily="var(--font-cinzel), serif">
                  {v.name}
                </text>
              </g>
            );
          })}

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
                isHovered={hoveredSlug === pin.slug}
                orbitData={orbitDataMap.get(pin.slug) ?? { orbitDistances: [], maxOrbit: 40 }}
                vb={isActive ? vb : undefined}
                activeBodyId={activeBodySystemSlug === pin.slug ? activeBodyId : null}
                tooltipActions={bodyTooltipActions}
                onFocusSystem={focusSystem}
                onHoverSystem={setHoveredSlug}
              />
            );
          })}

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
      </div>

      <div className="absolute bottom-3 left-3 text-[10px] text-slate-500 select-none pointer-events-none">
        {zoom.toFixed(1)}x
      </div>
    </div>
  );
}
