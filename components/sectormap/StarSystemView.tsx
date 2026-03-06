/**
 * Renders a single star system: orbits, star, celestial bodies, special
 * attribute icons, and the active body info card (tooltip).
 *
 * Hover uses proximity-based detection via RAF-throttled mousemove on the
 * scaled system <g>. The tooltip state machine is owned by the parent
 * (SectorMap) via useSvgTooltipTimer and passed down as callbacks.
 */
import { useRef, useCallback, memo } from "react";
import type { SystemPin } from "@/types/sector";
import type { StarSystemMetadata } from "@/types/starsystem";
import type { SvgViewBox } from "@/components/SvgTooltip";
import type { TooltipActions } from "@/hooks/useSvgTooltipTimer";
import { SvgTooltip } from "@/components/SvgTooltip";
import { getBodyColors } from "@/lib/bodyColors";
import {
  SYS_SCALE, SYS_MAX_R,
} from "@/lib/sectorMapHelpers";
import { getBodyPos, bodyHitRadius } from "@/lib/sectorMapHelpers";
import { BodyShape, bodyLabelR } from "./bodies/BodyShape";
import { BodyInfoCard, bodyCardHeight } from "./bodies/BodyInfoCard";
import { SpecialAttributeIcon } from "@/components/specialAttributes/SpecialAttributeIcon";

interface StarSystemViewProps {
  pin: SystemPin;
  sys: StarSystemMetadata | undefined;
  sectorSlug: string;
  sectorColor: string;
  isActive: boolean;
  isDimmed: boolean;
  noActiveSystem: boolean;
  isHovered: boolean;
  orbitData: { orbitDistances: number[]; maxOrbit: number };
  vb: SvgViewBox | undefined;
  activeBodyId: string | null;
  tooltipActions: TooltipActions;
  onFocusSystem: (pin: SystemPin) => void;
  onHoverSystem: (slug: string | null) => void;
}

export const StarSystemView = memo(function StarSystemView({
  pin, sys, sectorSlug, sectorColor, isActive, isDimmed, noActiveSystem,
  isHovered, orbitData, vb, activeBodyId, tooltipActions,
  onFocusSystem, onHoverSystem,
}: StarSystemViewProps) {
  const { orbitDistances, maxOrbit } = orbitData;
  const labelY = pin.y + (maxOrbit + 30) * SYS_SCALE + 14;
  const highlighted = isHovered;

  // Per-system refs for proximity detection
  const bodyRafRef = useRef<number | null>(null);
  const lastCursorRef = useRef<{ x: number; y: number } | null>(null);

  const findNearestBody = useCallback((
    clientX: number, clientY: number,
    g: SVGGElement, bodies: StarSystemMetadata["bodies"],
  ) => {
    const svg = g.ownerSVGElement;
    if (!svg) return null;
    const ctm = g.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const localPt = pt.matrixTransform(ctm.inverse());
    let nearest: string | null = null;
    let bestRatio = 1;
    for (const body of bodies) {
      const pos = getBodyPos(body.orbitPosition, body.orbitDistance);
      const dx = localPt.x - pos.x;
      const dy = localPt.y - pos.y;
      const ratio = Math.sqrt(dx * dx + dy * dy) / bodyHitRadius(body.type);
      if (ratio < bestRatio) { bestRatio = ratio; nearest = body.id; }
    }
    return nearest;
  }, []);

  const handleBodyProximity = useCallback((e: React.MouseEvent<SVGGElement>) => {
    if (!sys || bodyRafRef.current !== null) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    lastCursorRef.current = { x: clientX, y: clientY };
    const target = e.currentTarget;
    bodyRafRef.current = requestAnimationFrame(() => {
      bodyRafRef.current = null;
      const nearest = findNearestBody(clientX, clientY, target, sys.bodies);
      if (nearest && nearest !== tooltipActions.activeIdRef.current) {
        tooltipActions.show(nearest);
      } else if (!nearest && !tooltipActions.cardHoveredRef.current) {
        tooltipActions.proximityHide();
      }
    });
  }, [sys, findNearestBody, tooltipActions]);

  const handleBodyClick = useCallback((e: React.MouseEvent<SVGGElement>) => {
    if (!sys) return;
    const nearest = findNearestBody(e.clientX, e.clientY, e.currentTarget, sys.bodies);
    if (nearest) {
      e.stopPropagation();
      tooltipActions.show(nearest);
    }
  }, [sys, findNearestBody, tooltipActions]);

  const handleMouseLeave = useCallback((e: React.MouseEvent<SVGGElement>) => {
    const g = e.currentTarget;
    const cursor = lastCursorRef.current;
    if (cursor) {
      const el = document.elementFromPoint(cursor.x, cursor.y);
      if (el && g.contains(el)) return;
    }
    tooltipActions.scheduleHide();
  }, [tooltipActions]);

  return (
    <g
      style={{
        cursor: noActiveSystem ? "pointer" : "default",
        opacity: isDimmed ? 0.2 : 1,
        transition: "opacity 0.3s",
      }}
      onClick={isActive ? (e) => e.stopPropagation() : noActiveSystem ? () => onFocusSystem(pin) : undefined}
      onMouseEnter={noActiveSystem ? () => onHoverSystem(pin.slug) : undefined}
      onMouseLeave={noActiveSystem ? () => onHoverSystem(null) : undefined}
    >
      {/* Hit area — only in overview mode */}
      {noActiveSystem && (
        <circle cx={pin.x} cy={pin.y} r={(maxOrbit + 50) * SYS_SCALE} fill="transparent" />
      )}

      {sys ? (
        <g
          transform={`translate(${pin.x}, ${pin.y}) scale(${SYS_SCALE})`}
          onMouseMove={isActive ? handleBodyProximity : undefined}
          onMouseLeave={isActive ? handleMouseLeave : undefined}
          onClick={isActive ? handleBodyClick : undefined}
        >
          {/* Interaction surface for active system */}
          {isActive && (
            <rect
              x={-SYS_MAX_R - 40} y={-SYS_MAX_R - 40}
              width={(SYS_MAX_R + 40) * 2} height={(SYS_MAX_R + 40) * 2}
              fill="transparent" pointerEvents="all"
            />
          )}

          {/* Orbit rings */}
          {orbitDistances.map((dist) => (
            <circle key={dist} cx={0} cy={0} r={dist * SYS_MAX_R}
              fill="none"
              stroke={highlighted ? "rgba(148,151,255,0.38)" : "rgba(99,102,241,0.15)"}
              strokeWidth={highlighted ? 1.5 : 1}
              strokeDasharray="6 10"
              style={{ transition: "stroke 0.25s, stroke-width 0.25s" }} />
          ))}

          {/* Star */}
          <circle cx={0} cy={0} r={80} fill={`url(#starCorona-${pin.slug})`}
            style={{ animation: "starPulse 4s ease-in-out infinite" }} />
          <circle cx={0} cy={0} r={40} fill={`url(#starGlow-${pin.slug})`} />
          {/* Hover halo ring */}
          <circle cx={0} cy={0} r={65} fill="none"
            stroke={sys.star.color} strokeWidth={12}
            strokeOpacity={highlighted ? 0.18 : 0}
            style={{ transition: "stroke-opacity 0.25s" }} />
          <circle cx={0} cy={0} r={22} fill={sys.star.color}
            style={{
              filter: highlighted
                ? `drop-shadow(0 0 22px ${sys.star.color}) drop-shadow(0 0 8px white)`
                : `drop-shadow(0 0 12px ${sys.star.color})`,
              transition: "filter 0.25s",
            }} />
          <text x={0} y={55} textAnchor="middle"
            fill={sys.star.color} fontSize="15"
            fontFamily="var(--font-cinzel), serif" fontWeight="600">
            {sys.star.name}
          </text>
          {isActive && sys.star.kankaUrl && (
            <a href={sys.star.kankaUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <text x={0} y={74} textAnchor="middle"
                fill="rgba(165,180,252,0.6)" fontSize="11"
                fontFamily="var(--font-cinzel), serif"
                style={{ cursor: "pointer" }}>
                ↗ Kanka
              </text>
            </a>
          )}

          {/* Pass 1: Body shapes + labels */}
          {sys.bodies.map((body) => {
            const pos = getBodyPos(body.orbitPosition, body.orbitDistance);
            const isBodyActive = isActive && activeBodyId === body.id;
            const { color: bodyColor } = getBodyColors(body);
            const labelR = bodyLabelR(body.type);

            return (
              <g key={body.id} style={{ cursor: isActive ? "pointer" : "default", pointerEvents: "none" }}>
                <BodyShape
                  bodyId={body.id}
                  bodyType={body.type}
                  posX={pos.x}
                  posY={pos.y}
                  pinSlug={pin.slug}
                  sectorSlug={sectorSlug}
                  bodyColor={bodyColor}
                  isBodyActive={isBodyActive}
                  isActive={isActive}
                />

                <SpecialAttributeIcon type={body.special_attribute} posX={pos.x} posY={pos.y} labelR={labelR} />

                <text x={pos.x} y={body.labelPosition === "top" ? pos.y - labelR - 6 : pos.y + labelR + 18}
                  textAnchor="middle"
                  fill={isBodyActive ? "white" : "rgba(255,255,255,0.6)"} fontSize="14"
                  fontFamily="var(--font-cinzel), serif">
                  {body.name}
                </text>
              </g>
            );
          })}

          {/* Pass 2: Active body info card */}
          {isActive && activeBodyId && (() => {
            const body = sys.bodies.find(b => b.id === activeBodyId);
            if (!body) return null;
            const pos = getBodyPos(body.orbitPosition, body.orbitDistance);
            const { color: bodyColor } = getBodyColors(body);
            const cardW = 220;
            const cardH = bodyCardHeight(body.special_attribute, body.kankaUrl);
            const bodyR = bodyLabelR(body.type);

            return (
              <SvgTooltip
                anchorX={pos.x} anchorY={pos.y}
                cardW={cardW} cardH={cardH}
                color={bodyColor} clearance={bodyR + 16}
                viewBox={vb!}
                parentOffsetX={pin.x} parentOffsetY={pin.y}
                scale={SYS_SCALE}
                onMouseEnter={tooltipActions.cardEnter}
                onMouseLeave={tooltipActions.cardLeave}
              >
                <BodyInfoCard
                  name={body.name}
                  type={body.type}
                  biome={body.biome}
                  specialAttribute={body.special_attribute}
                  kankaUrl={body.kankaUrl}
                  bodyColor={bodyColor}
                />
              </SvgTooltip>
            );
          })()}
        </g>
      ) : (
        <circle cx={pin.x} cy={pin.y} r={8}
          fill={sectorColor}
          style={{ filter: `drop-shadow(0 0 8px ${sectorColor})` }} />
      )}

      {/* System name label — hidden while system is active */}
      {!isActive && (
        <>
          <text
            x={pin.x} y={labelY} textAnchor="middle"
            fill={isHovered ? "white" : "rgba(255,255,255,0.55)"}
            fontSize={isHovered ? "12" : "11"}
            fontWeight={isHovered ? "600" : "400"}
            fontFamily="var(--font-cinzel), serif"
            style={{ pointerEvents: "none", transition: "fill 0.25s, font-size 0.25s, font-weight 0.25s" }}>
            {sys?.name ?? pin.slug}
          </text>
          {sys?.kankaUrl && (
            <a href={sys.kankaUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <text x={pin.x} y={labelY + 16} textAnchor="middle"
                fill="rgba(165,180,252,0.5)" fontSize="9"
                fontFamily="var(--font-cinzel), serif"
                style={{ cursor: "pointer" }}>
                ↗ Kanka
              </text>
            </a>
          )}
        </>
      )}
    </g>
  );
});
