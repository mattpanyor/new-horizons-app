"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { SectorMetadata, SystemPin, MapMarker } from "@/types/sector";
import type { StarSystemMetadata } from "@/types/starsystem";
import { useSvgTooltipTimer } from "@/hooks/useSvgTooltipTimer";
import { useSvgPanZoom } from "@/hooks/useSvgPanZoom";
import { EditModeProvider, useEditMode } from "@/components/sectormap/edit/EditModeProvider";
import { EditToggle } from "@/components/sectormap/edit/EditToggle";
import { EditToolbar } from "@/components/sectormap/edit/EditToolbar";
import { SidePanel } from "@/components/sectormap/edit/SidePanel";
import { CreateEntityModal } from "@/components/sectormap/edit/CreateEntityModal";
import { SystemEditSidebar } from "@/components/sectormap/edit/SystemEditSidebar";
import { BodyEditSidebar } from "@/components/sectormap/edit/BodyEditSidebar";
import { useSystemEdit } from "@/components/sectormap/edit/useSystemEdit";
import { useDragPin } from "@/components/sectormap/edit/useDragPin";
import { useDragBody } from "@/components/sectormap/edit/useDragBody";
import type { EntityKind } from "@/components/sectormap/edit/types";
import type { Biome } from "@/lib/db/biomes";
import type { CelestialBody } from "@/types/starsystem";
import {
  FULL_W, FULL_H,
  SECTOR_TERRITORY, TERRITORY_INNER_R, TERRITORY_OUTER_R,
  MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, FOCUS_ZOOM, AUTO_SELECT_ZOOM,
  SYS_MAX_R, SYS_SCALE,
  isInSectorTerritory,
} from "@/lib/sectorMapHelpers";
import { SYSTEM_OVERRIDES } from "@/components/sectormap/ImperialCoreCluster";
import { ConnectionMarkerLayer } from "@/components/sectormap/ConnectionMarkerLayer";
import { FreeMarkerLayer } from "@/components/sectormap/FreeMarkerLayer";
import { StarSystemView } from "@/components/sectormap/StarSystemView";
import { SearchOverlay } from "@/components/sectormap/SearchOverlay";
import { usePlanningMode } from "@/hooks/usePlanningMode";
import { PlanningLayer } from "@/components/sectormap/PlanningLayer";
import { PlanningTotalBox } from "@/components/sectormap/PlanningTotalBox";
import { PlanningToggle } from "@/components/sectormap/PlanningToggle";
import { PLANNING_COLOR } from "@/lib/planningMode";
import { LayerSelector } from "@/components/sectormap/LayerSelector";
import { ConnectionLinesLayer } from "@/components/sectormap/ConnectionLinesLayer";
import { wavyCloudPath } from "@/lib/sectorMapHelpers";
import type { VortexPin, LayerSlug } from "@/types/sector";
import { MAP_LAYERS } from "@/types/sector";

const noop = () => {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const noopStr = (_: string | null) => {};

interface SectorMapProps {
  sector: SectorMetadata;
  systemsData?: Record<string, StarSystemMetadata>;
  children?: React.ReactNode;
  staticSvgLayers: React.ReactNode;
  userAccessLevel?: number;
  biomes?: Biome[];
}

function computeContentViewBox(sector: SectorMetadata): { x: number; y: number; w: number; h: number } {
  const PADDING = 30;
  const t = SECTOR_TERRITORY[sector.slug];
  if (!t) return { x: 0, y: 0, w: FULL_W, h: FULL_H };

  const { cx, cy, arcStart, arcEnd } = t;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // Collect the 4 corner points of the annular sector
  const pts = [
    { x: cx + TERRITORY_INNER_R * Math.cos(toRad(arcStart)), y: cy + TERRITORY_INNER_R * Math.sin(toRad(arcStart)) },
    { x: cx + TERRITORY_INNER_R * Math.cos(toRad(arcEnd)),   y: cy + TERRITORY_INNER_R * Math.sin(toRad(arcEnd)) },
    { x: cx + TERRITORY_OUTER_R * Math.cos(toRad(arcStart)), y: cy + TERRITORY_OUTER_R * Math.sin(toRad(arcStart)) },
    { x: cx + TERRITORY_OUTER_R * Math.cos(toRad(arcEnd)),   y: cy + TERRITORY_OUTER_R * Math.sin(toRad(arcEnd)) },
  ];

  // Also sample along the arc at key angles (every 45° within range, plus midpoint)
  // to catch the arc bulge
  const step = 45;
  for (let deg = arcStart; deg <= arcEnd; deg += step) {
    pts.push({ x: cx + TERRITORY_OUTER_R * Math.cos(toRad(deg)), y: cy + TERRITORY_OUTER_R * Math.sin(toRad(deg)) });
    pts.push({ x: cx + TERRITORY_INNER_R * Math.cos(toRad(deg)), y: cy + TERRITORY_INNER_R * Math.sin(toRad(deg)) });
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  minX -= PADDING;
  minY -= PADDING;
  maxX += PADDING;
  maxY += PADDING;

  // Maintain 3:2 aspect ratio
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const targetRatio = FULL_W / FULL_H;
  const contentRatio = contentW / contentH;

  let finalW = contentW, finalH = contentH;
  if (contentRatio > targetRatio) {
    finalH = contentW / targetRatio;
  } else {
    finalW = contentH * targetRatio;
  }

  const cxContent = (minX + maxX) / 2;
  const cyContent = (minY + maxY) / 2;

  return { x: cxContent - finalW / 2, y: cyContent - finalH / 2, w: finalW, h: finalH };
}

// Outer wrapper: mounts the EditModeProvider with the BASE sector + user access
// level. SectorMapInner reads the projected (effective) sector from the
// provider when in edit mode.
export default function SectorMap(props: SectorMapProps) {
  return (
    <EditModeProvider sector={props.sector} userAccessLevel={props.userAccessLevel ?? 0}>
      <SectorMapInner {...props} />
    </EditModeProvider>
  );
}

function SectorMapInner({ sector: propsSector, systemsData = {}, children, staticSvgLayers, biomes = [] }: SectorMapProps) {
  const edit = useEditMode();
  // While the GM has edit mode on, the canvas renders the locally-projected
  // sector (base + pending changes). View mode passes through the base prop.
  const sector = edit.mode === "sector-edit" ? edit.effectiveSector : propsSector;

  // Context menu state for right-click → create entity flow
  const [contextMenu, setContextMenu] = useState<{ screenX: number; screenY: number; svgX: number; svgY: number } | null>(null);
  const [createModal, setCreateModal] = useState<{ kind: "system" | "vortex" | "marker"; x: number; y: number } | null>(null);

  // System-edit session — opened by the "Edit System" button when zoomed in.
  // The hook owns the pending state, save flow, and selection.
  const systemEdit = useSystemEdit();
  const dragBody = useDragBody();

  // Keep useSystemEdit's captured baseSystem in sync with the freshest
  // systemsData prop. Critical after a save: router.refresh() pulls new DB
  // values, but the hook's local snapshot was frozen at enter() time, so
  // forms would otherwise revert to pre-save values when `pending` clears.
  //
  // Destructure stable primitives instead of depending on the whole
  // `systemEdit` object (which is recreated every render and would fire
  // this effect on every render).
  const { active: systemEditActive, systemSlug: systemEditSlug, baseSystem: systemEditBase, syncBase } = systemEdit;
  useEffect(() => {
    if (!systemEditActive || !systemEditSlug) return;
    const fresh = systemsData[systemEditSlug];
    if (fresh && fresh !== systemEditBase) {
      syncBase(fresh);
    }
  }, [systemsData, systemEditActive, systemEditSlug, systemEditBase, syncBase]);

  // When system-edit is active for the focused system, project pending changes
  // (system metadata, star fields, body updates/creates/deletes, plus live
  // orbit-drag preview) onto the rendered StarSystemMetadata.
  const composeEditedSystem = useCallback(
    (base: StarSystemMetadata): StarSystemMetadata => {
      if (!systemEdit.active || systemEdit.systemSlug !== base.slug) return base;
      const p = systemEdit.pending;
      const star = { ...base.star, ...p.primary, type: p.primary.fantasyLabel ?? base.star.type };
      let secondaryStar = base.secondaryStar;
      if (p.secondary === null) secondaryStar = undefined;
      else if (p.secondary !== undefined) secondaryStar = { ...(base.secondaryStar ?? { name: "", type: "", color: "" }), ...p.secondary, type: p.secondary.fantasyLabel ?? (base.secondaryStar?.type ?? "") };
      // Compose body list
      const bodies: CelestialBody[] = [];
      for (const b of base.bodies) {
        if (b.dbId !== undefined && p.bodyDeletes.has(b.dbId)) continue;
        const patch = b.dbId !== undefined ? p.bodyUpdates.get(b.dbId) ?? {} : {};
        const merged = { ...b, ...patch };
        // Apply live drag preview
        if (dragBody.drag && dragBody.drag.bodyDbId !== undefined && dragBody.drag.bodyDbId === b.dbId) {
          merged.orbitPosition = Math.round(dragBody.drag.orbitPosition);
        }
        bodies.push(merged);
      }
      for (const c of p.bodyCreates) {
        const live = (dragBody.drag && dragBody.drag.bodyTempId === c.tempId)
          ? { orbitPosition: Math.round(dragBody.drag.orbitPosition) } : {};
        bodies.push({
          id: c.id ?? "new-body",
          name: c.name ?? "New Body",
          type: c.type ?? "planet",
          orbitPosition: c.orbitPosition ?? 0,
          orbitDistance: c.orbitDistance ?? 0.5,
          biome: c.biome,
          lore: c.lore,
          labelPosition: c.labelPosition,
          special_attribute: c.special_attribute,
          allegiance: c.allegiance,
          externalUrl: c.externalUrl,
          published: c.published,
          ...live,
          // Stash tempId on the body for downstream identification (cast — not in type)
          ...({ _tempId: c.tempId } as Record<string, string>),
        });
      }
      return {
        ...base,
        name: p.system.name ?? base.name,
        externalUrl: p.system.externalUrl ?? base.externalUrl,
        published: p.system.published ?? base.published,
        centerKind: p.system.centerKind ?? base.centerKind,
        binaryAngle: p.system.binaryAngle !== undefined ? (p.system.binaryAngle ?? undefined) : base.binaryAngle,
        star,
        secondaryStar,
        bodies,
      };
    },
    [systemEdit.active, systemEdit.systemSlug, systemEdit.pending, dragBody.drag]
  );

  // Body drag commit: fires on mouseup. Updates pending state on the dragged body.
  const onBodyDragCommit = useCallback(
    (ref: { dbId?: number; tempId?: string }, orbitPosition: number) => {
      systemEdit.patchBody(ref, { orbitPosition });
    },
    [systemEdit]
  );

  // Drag state for sector-edit reposition flow. The dragged entity's
  // rendered position is overridden from `dragPin.drag` until mouseup commits.
  const dragPin = useDragPin();
  const onDragCommit = useCallback(
    (kind: EntityKind, ref: { id?: number; tempId?: string }, x: number, y: number) => {
      edit.updateField(kind, ref, { x: Math.round(x), y: Math.round(y) });
    },
    [edit]
  );
  const overridePosition = (kind: EntityKind, id: number | undefined) => {
    const d = dragPin.drag;
    if (!d) return null;
    if (d.kind !== kind) return null;
    if (id !== undefined && d.id !== id) return null;
    return { x: d.x, y: d.y };
  };

  // The viewport bounds are a function of the sector's territory geometry,
  // not the live editor positions. Memoize on the base prop so the camera
  // doesn't snap back to bounds every time `pending` updates the projected
  // sector.
  const initialViewBox = useMemo(() => computeContentViewBox(propsSector), [propsSector]);

  const {
    containerRef, svgRef, vb, zoom, cursorGrab, didDragRef,
    zoomIn, zoomOut, resetView: resetPanZoom, animateToVb, isAnimatingRef, handlers,
  } = useSvgPanZoom({ width: FULL_W, height: FULL_H, initialViewBox, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, zoomStep: ZOOM_STEP });

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
  const devCoordsRef = useRef<HTMLSpanElement>(null);
  const isDev = process.env.NODE_ENV === "development";
  const [activeLayer, setActiveLayer] = useState("None");

  // Auto-detect which layers exist in this sector's content. Compare by
  // slug value (what's stored on data) — MAP_LAYERS keys now match those
  // values 1:1, so this is straightforward.
  const sectorLayers = useMemo(() => {
    const usedSlugs = new Set<string>();
    for (const c of sector.connections ?? []) if (c.layer) usedSlugs.add(c.layer);
    for (const m of sector.markers ?? []) if (m.layer) usedSlugs.add(m.layer);
    for (const v of sector.vortexes ?? []) if (v.layer) usedSlugs.add(v.layer);
    return Object.values(MAP_LAYERS).filter((layer) => usedSlugs.has(layer.slug));
  }, [sector.connections, sector.markers, sector.vortexes]);

  // Filter layered elements — items without a layer always show, items with a layer only show when selected
  const filteredConnections = useMemo(() =>
    (sector.connections ?? []).filter(c => !c.layer || c.layer === activeLayer),
    [sector.connections, activeLayer],
  );
  const filteredMarkers = useMemo(() =>
    (sector.markers ?? []).filter(m => !m.layer || m.layer === activeLayer),
    [sector.markers, activeLayer],
  );
  const filteredVortexes = useMemo(() =>
    (sector.vortexes ?? []).filter(v => !v.layer || v.layer === activeLayer),
    [sector.vortexes, activeLayer],
  );

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

  const handleSvgMouseMove = useCallback((e: React.MouseEvent) => {
    cursorClientRef.current = { x: e.clientX, y: e.clientY };
    if (devCoordsRef.current) {
      const svg = svgRef.current;
      const ctm = svg?.getScreenCTM();
      if (svg && ctm) {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgPt = pt.matrixTransform(ctm.inverse());
        devCoordsRef.current.textContent = `(${Math.round(svgPt.x)}, ${Math.round(svgPt.y)})`;
      }
    }
  }, [svgRef]);

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
    onMouseUp: () => {
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
      animateToVb(initialViewBox, 500);
    } else {
      resetPanZoom();
    }
  }, [activeSystemSlug, hideBody, resetPanZoom, animateToVb, initialViewBox, systemUnderCursor]);

  const focusSystem = useCallback((pin: SystemPin) => {
    setActiveSystemSlug(pin.slug);
    setHoveredSlug(null);
    hideBody();
    const zoom = SYSTEM_OVERRIDES[pin.slug]?.focusZoom ?? FOCUS_ZOOM;
    const w = FULL_W / zoom;
    const h = FULL_H / zoom;
    animateToVb({ x: pin.x - w / 2, y: pin.y - h / 2, w, h }, 500);
  }, [hideBody, animateToVb]);

  const exitSystem = useCallback(() => {
    // If the GM has an unsaved system-edit session for this system, prompt
    // before navigating away (systemEdit.exit returns false on cancel).
    if (systemEdit.active && !systemEdit.exit()) return;
    setActiveSystemSlug(null);
    setHoveredSlug(systemUnderCursor());
    hideBody();
    animateToVb(initialViewBox, 500);
  }, [hideBody, animateToVb, initialViewBox, systemUnderCursor, systemEdit]);

  // In edit mode, clicking a system selects it for editing rather than zooming.
  // For vortex / marker selection, click handlers live in their layer components
  // (or — fallback — the GM uses the Connections panel to navigate refs).
  const onSystemPick = useCallback(
    (pin: SystemPin) => {
      if (edit.mode === "sector-edit") {
        const tempId = (pin as SystemPin & { tempId?: string }).tempId;
        edit.select("system", pin.id ?? null, tempId ?? null);
      } else {
        focusSystem(pin);
      }
    },
    [edit, focusSystem]
  );

  // Right-click on the SVG opens a "Create here" context menu (edit mode only).
  const onSvgContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (edit.mode !== "sector-edit") return;
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(ctm.inverse());
      setContextMenu({ screenX: e.clientX, screenY: e.clientY, svgX: svgPt.x, svgY: svgPt.y });
    },
    [edit.mode, svgRef]
  );

  // Click-to-select for vortexes / free markers in edit mode. Bound onto each
  // entity's <g> through inline onClick handlers in the JSX below.
  const onVortexPick = useCallback(
    (v: VortexPin) => {
      if (edit.mode !== "sector-edit" || v.id === undefined) return;
      edit.select("vortex", v.id);
    },
    [edit]
  );
  const onMarkerPick = useCallback(
    (m: MapMarker) => {
      if (edit.mode !== "sector-edit" || m.id === undefined) return;
      edit.select("marker", m.id);
    },
    [edit]
  );

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

  // Auto-select system when zoomed in close enough (skip during animation).
  // The state updates are deferred to the next macrotask so they don't run
  // synchronously inside the effect body — keeps a one-frame delay at most,
  // imperceptible to users panning/zooming.
  useEffect(() => {
    if (isAnimatingRef.current) return;
    const currentZoom = FULL_W / vb.w;
    let target: string | null | undefined;
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
        target = best.slug;
      }
    } else if (activeSystemSlug) {
      const activeMinZoom = SYSTEM_OVERRIDES[activeSystemSlug]?.focusZoom ?? AUTO_SELECT_ZOOM;
      if (currentZoom < activeMinZoom * 0.8) {
        target = null;
      }
    }
    if (target === undefined) return;
    const id = setTimeout(() => {
      setActiveSystemSlug(target);
      setHoveredSlug(target === null ? systemUnderCursor() : null);
      hideBody();
    }, 0);
    return () => clearTimeout(id);
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
        const maxR = SYSTEM_OVERRIDES[pin.slug]?.maxR ?? SYS_MAX_R;
        const maxOrbit = Math.max(...sys.bodies.map((b) => b.orbitDistance), 0.3) * maxR;
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
          onContextMenu={onSvgContextMenu}
        >
          {/* ── Static SVG layers (server-rendered: gradients, territories) ── */}
          {staticSvgLayers}

          {/* ── Connection line paths + labels ── */}
          <ConnectionLinesLayer
            connections={filteredConnections}
            systems={sector.systems}
            vortexes={filteredVortexes}
            markers={filteredMarkers}
            sectorColor={sector.color}
            orbitDataMap={orbitDataMap}
            isEditing={edit.mode === "sector-edit"}
            onPick={(c) => {
              const tempId = (c as { tempId?: string }).tempId;
              if (c.id !== undefined) edit.select("connection", c.id);
              else if (tempId !== undefined) edit.select("connection", null, tempId);
            }}
            selectedConnectionId={edit.selection?.kind === "connection" ? edit.selection.id : null}
            selectedConnectionTempId={edit.selection?.kind === "connection" ? edit.selection.tempId : null}
          />

          {/* ── Vortex shapes ── */}
          {filteredVortexes.map((v: VortexPin) => {
            const color = v.color ?? sector.color;
            const r = v.radius ?? 80;
            const [rw, rh] = v.ratio ?? [1, 1];
            const ry = r * (rh / Math.max(rw, rh));
            const editable = edit.mode === "sector-edit";
            const isSelected = editable && edit.selection?.kind === "vortex" && edit.selection.id === v.id;
            const override = overridePosition("vortex", v.id);
            const vx = override?.x ?? v.x;
            const vy = override?.y ?? v.y;
            return (
              <g
                key={v.slug}
                style={{ pointerEvents: editable ? "auto" : "none", cursor: editable ? "move" : "default" }}
                onClick={editable ? () => onVortexPick(v) : undefined}
                onMouseDown={editable && v.id !== undefined
                  ? (e) => dragPin.startDrag({ event: e, svg: svgRef.current, kind: "vortex", id: v.id, currentX: v.x, currentY: v.y, onCommit: onDragCommit })
                  : undefined}
              >
                <path d={wavyCloudPath(vx, vy, r, { ratio: v.ratio })}
                  fill={color} fillOpacity={isSelected ? 0.25 : 0.12}
                  stroke={color} strokeOpacity={isSelected ? 0.8 : 0.35} strokeWidth={isSelected ? 2.5 : 1.5} />
                <text x={vx} y={vy + ry + 18} textAnchor="middle"
                  fill={color} fillOpacity={0.75} fontSize="11"
                  fontFamily="var(--font-cinzel), serif">
                  {v.name}
                </text>
              </g>
            );
          })}

          {/* ── Star systems ── */}
          {sector.systems.map((pin) => {
            const baseSys = systemsData[pin.slug];
            const isActive = activeSystemSlug === pin.slug;
            const editable = edit.mode === "sector-edit";
            const override = overridePosition("system", pin.id);
            const effectivePin = override
              ? ({ ...pin, x: override.x, y: override.y } as SystemPin)
              : pin;
            // Apply system-edit pending changes to the rendered system
            const isThisEditing = systemEdit.active && systemEdit.systemSlug === pin.slug;
            const sys = baseSys && isThisEditing ? composeEditedSystem(baseSys) : baseSys;
            return (
              <g
                key={pin.slug}
                style={editable ? { cursor: "move" } : undefined}
                onMouseDown={editable && pin.id !== undefined
                  ? (e) => dragPin.startDrag({ event: e, svg: svgRef.current, kind: "system", id: pin.id, currentX: pin.x, currentY: pin.y, onCommit: onDragCommit })
                  : undefined}
              >
                <StarSystemView
                  pin={effectivePin}
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
                  onFocusSystem={planning.active ? noop : onSystemPick}
                  onHoverSystem={planning.active ? noopStr : setHoveredSlug}
                  isSystemEditing={isThisEditing}
                  onBodyPick={(ref) =>
                    systemEdit.select({ kind: "body", bodyDbId: ref.dbId, bodyTempId: ref.tempId })
                  }
                  onBodyDragStart={(e, ref) =>
                    dragBody.start({
                      event: e,
                      svg: svgRef.current,
                      bodyDbId: ref.dbId,
                      bodyTempId: ref.tempId,
                      systemCenterX: pin.x,
                      systemCenterY: pin.y,
                      onCommit: onBodyDragCommit,
                    })
                  }
                  selectedBodyDbId={
                    isThisEditing && systemEdit.selection?.kind === "body"
                      ? systemEdit.selection.bodyDbId ?? null
                      : null
                  }
                  selectedBodyTempId={
                    isThisEditing && systemEdit.selection?.kind === "body"
                      ? systemEdit.selection.bodyTempId ?? null
                      : null
                  }
                />
              </g>
            );
          })}

          {/* ── Connection markers (after star systems so tooltips render on top) ── */}
          <ConnectionMarkerLayer
            connections={filteredConnections}
            systems={sector.systems}
            vortexes={sector.vortexes ?? []}
            markers={filteredMarkers}
            sectorSlug={sector.slug}
            orbitDataMap={orbitDataMap}
            activeMarkerId={activeMarkerId}
            showMarker={showMarker}
            scheduleHideMarker={scheduleHideMarker}
            markerCardEnter={markerCardEnter}
            markerCardLeave={markerCardLeave}
            vb={vb}
            isEditing={edit.mode === "sector-edit"}
            editPick={edit.mode === "sector-edit" ? onMarkerPick : undefined}
            selectedMarkerId={edit.selection?.kind === "marker" ? edit.selection.id : null}
          />

          {/* ── Free-floating markers ── */}
          {filteredMarkers.length > 0 && (() => {
            // Override the dragged marker's position so the live drag shows
            // it under the cursor without committing yet.
            const editing = edit.mode === "sector-edit";
            const renderedMarkers = (editing && dragPin.drag?.kind === "marker")
              ? filteredMarkers.map((m) =>
                  m.id === dragPin.drag!.id ? { ...m, x: dragPin.drag!.x, y: dragPin.drag!.y } : m
                )
              : filteredMarkers;
            return (
              <FreeMarkerLayer
                markers={renderedMarkers}
                sectorSlug={sector.slug}
                activeMarkerId={activeMarkerId}
                showMarker={showMarker}
                scheduleHideMarker={scheduleHideMarker}
                markerCardEnter={markerCardEnter}
                markerCardLeave={markerCardLeave}
                vb={vb}
                isEditing={editing}
                editPick={editing ? onMarkerPick : undefined}
                editDragStart={editing ? (e, m) => {
                  if (m.id === undefined) return;
                  dragPin.startDrag({
                    event: e, svg: svgRef.current, kind: "marker", id: m.id,
                    currentX: m.x ?? 0, currentY: m.y ?? 0, onCommit: onDragCommit,
                  });
                } : undefined}
                selectedMarkerId={edit.selection?.kind === "marker" ? edit.selection.id : null}
              />
            );
          })()}

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

      {/* ── Layer selector ── (shifted down in edit mode so it doesn't overlap EditToolbar) */}
      {sectorLayers.length > 0 && (
        <div className={`absolute left-1/2 -translate-x-1/2 z-10 ${edit.mode === "sector-edit" ? "top-16" : "top-3"}`}>
          <LayerSelector layers={sectorLayers} selected={activeLayer} onChange={setActiveLayer} />
        </div>
      )}

      {/* ── Controls ── */}
      {activeSystemSlug && (
        <>
          <button
            onClick={exitSystem}
            className="absolute top-3 left-3 z-10 flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-1.5 md:py-2.5 rounded scifi-card text-xs md:text-xl text-slate-300 hover:text-white transition-colors"
            style={{ fontFamily: "var(--font-cinzel), serif" }}
          >
            <span>&#x2190;</span>
            <span>Sector</span>
          </button>
          {/* Edit System button — only for superadmins in view mode, and only
              when the focused system is editable (not Imperial Core / legacy). */}
          {edit.canEdit && edit.mode === "view"
            && propsSector.slug !== "imperial-core"
            && propsSector.slug !== "atlas-sector-legacy"
            && systemsData[activeSystemSlug] && !systemEdit.active && (
            <button
              onClick={() => systemEdit.enter(propsSector.slug, systemsData[activeSystemSlug])}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded scifi-card text-xs text-amber-200 border border-amber-500/40 hover:bg-amber-500/15 transition-colors"
              style={{ fontFamily: "var(--font-cinzel), serif" }}
            >
              Edit System
            </button>
          )}
        </>
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
        {isDev && <span ref={devCoordsRef} className="ml-2 text-amber-400/70" />}
      </div>

      {/* ── Edit-mode toggle (top-left, superadmin only) ── */}
      {!activeSystemSlug && (
        <div className="absolute top-3 left-3 z-20">
          <EditToggle />
        </div>
      )}

      {/* ── Edit-mode top-center toolbar ── */}
      {edit.mode === "sector-edit" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
          <EditToolbar />
        </div>
      )}

      {/* ── Right-rail side panel (edit mode only) ── */}
      <SidePanel />

      {/* ── Right-click context menu ── */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div
            className="fixed z-40 scifi-card rounded text-xs overflow-hidden"
            style={{
              left: contextMenu.screenX,
              top: contextMenu.screenY,
              fontFamily: "var(--font-cinzel), serif",
            }}
          >
            {(["system", "vortex", "marker"] as const).map((k) => (
              <button
                key={k}
                onClick={() => {
                  setCreateModal({ kind: k, x: contextMenu.svgX, y: contextMenu.svgY });
                  setContextMenu(null);
                }}
                className="block w-full text-left px-3 py-2 text-slate-200 hover:bg-amber-500/20 hover:text-amber-100 capitalize"
              >
                Create {k}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Create-entity modal ── */}
      {createModal && (
        <CreateEntityModal
          kind={createModal.kind}
          x={createModal.x}
          y={createModal.y}
          onClose={() => setCreateModal(null)}
        />
      )}

      {/* ── System-edit sidebars — right rail for system/center/stars, left rail for bodies ── */}
      {systemEdit.active && (
        <>
          <SystemEditSidebar api={systemEdit} />
          <BodyEditSidebar api={systemEdit} biomes={biomes} />
        </>
      )}
    </div>
  );
}
