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
import { ALLEGIANCES } from "@/lib/allegiances";
import { SpecialAttributeIcon } from "@/components/specialAttributes/SpecialAttributeIcon";
import { ImperialCoreCluster, SYSTEM_OVERRIDES } from "./ImperialCoreCluster";

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
  const override = SYSTEM_OVERRIDES[pin.slug];

  const { orbitDistances, maxOrbit } = orbitData;
  const sysScale = override?.scale ?? SYS_SCALE;
  const sysMaxR = override?.maxR ?? SYS_MAX_R;
  const labelY = pin.y + (maxOrbit + 30) * sysScale + 14;

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

    // Delegate to custom hit detection if this system has an override
    if (override?.findNearestBody) {
      return override.findNearestBody(localPt.x, localPt.y, bodies);
    }

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
  }, [override]);

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
        <circle cx={pin.x} cy={pin.y} r={(maxOrbit + 50) * sysScale} fill="transparent" />
      )}

      {sys ? (
        <g
          transform={`translate(${pin.x}, ${pin.y}) scale(${sysScale})`}
          onMouseMove={isActive ? handleBodyProximity : undefined}
          onMouseLeave={isActive ? handleMouseLeave : undefined}
          onClick={isActive ? handleBodyClick : undefined}
        >
          {/* Interaction surface for active system */}
          {isActive && (
            <rect
              x={-sysMaxR - 40} y={-sysMaxR - 40}
              width={(sysMaxR + 40) * 2} height={(sysMaxR + 40) * 2}
              fill="transparent" pointerEvents="all"
            />
          )}

          {/* Orbit rings */}
          {orbitDistances.map((dist) => (
            <circle key={dist} cx={0} cy={0} r={dist * sysMaxR}
              fill="none"
              stroke={isHovered ? "rgba(148,151,255,0.38)" : "rgba(99,102,241,0.15)"}
              strokeWidth={isHovered ? 1.5 : 1}
              strokeDasharray="6 10"
              style={{ transition: "stroke 0.25s, stroke-width 0.25s" }} />
          ))}

          {/* Star(s) */}
          {sys.secondaryStar ? (
            <>
              {/* Binary star system — positioned on a shared invisible orbit circle */}
              {(() => {
                const ORBIT_R = 30;
                const angle = sys.binaryAngle ?? 0;
                const rad = ((angle - 90) * Math.PI) / 180;
                const px = ORBIT_R * Math.cos(rad);
                const py = ORBIT_R * Math.sin(rad);
                const stars = [
                  { star: sys.star, suffix: pin.slug, sx: px, sy: py, r: 22, coronaR: 80, glowR: 40 },
                  { star: sys.secondaryStar!, suffix: `${pin.slug}-secondary`, sx: -px, sy: -py, r: 16, coronaR: 60, glowR: 30 },
                ];
                return stars.map(({ star, suffix, sx, sy, r, coronaR, glowR }) => (
                  <g key={suffix}>
                    <circle cx={sx} cy={sy} r={coronaR} fill={`url(#starCorona-${suffix})`}
                      style={{ animation: "starPulse 4s ease-in-out infinite" }} />
                    <circle cx={sx} cy={sy} r={glowR} fill={`url(#starGlow-${suffix})`} />
                    <circle cx={sx} cy={sy} r={r} fill={star.color}
                      style={{
                        filter: isHovered
                          ? `drop-shadow(0 0 22px ${star.color}) drop-shadow(0 0 8px white)`
                          : `drop-shadow(0 0 12px ${star.color})`,
                        transition: "filter 0.25s",
                      }} />
                  </g>
                ));
              })()}
              {/* Shared hover halo */}
              <circle cx={0} cy={0} r={65} fill="none"
                stroke={sys.star.color} strokeWidth={12}
                strokeOpacity={isHovered ? 0.18 : 0}
                style={{ transition: "stroke-opacity 0.25s" }} />
              {/* Combined label */}
              <text x={0} y={55} textAnchor="middle"
                fill={sys.star.color} fontSize="15"
                fontFamily="var(--font-cinzel), serif" fontWeight="600">
                {sys.star.name} &amp; {sys.secondaryStar.name}
              </text>
            </>
          ) : sys.star.type.toLowerCase().includes("neutron") ? (
            <>
              {/* Neutron Star — tiny, intense, sharp-edged with expanding heat ripples */}
              <defs>
                <radialGradient id={`neutron-glow-${pin.slug}`}>
                  <stop offset="0%" stopColor="white" stopOpacity="0.9" />
                  <stop offset="25%" stopColor="#B0C4FF" stopOpacity="0.5" />
                  <stop offset="50%" stopColor={sys.star.color} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={sys.star.color} stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Heat ripples — expanding concentric rings */}
              {[0, 1, 2].map((i) => (
                <circle key={`ripple-${i}`} cx={0} cy={0} r={20}
                  fill="none" stroke={sys.star.color} strokeWidth={0.8}>
                  <animate attributeName="r" values="12;50;80" dur="3s" begin={`${i * 1}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0.15;0" dur="3s" begin={`${i * 1}s`} repeatCount="indefinite" />
                </circle>
              ))}

              {/* Ambient glow — tight, intense */}
              <circle cx={0} cy={0} r={25} fill={`url(#neutron-glow-${pin.slug})`}>
                <animate attributeName="opacity" values="0.7;1;0.7" dur="1.5s" repeatCount="indefinite" />
              </circle>

              {/* Hard surface edge */}
              <circle cx={0} cy={0} r={10} fill="none"
                stroke="#B0C4FF" strokeWidth={1} opacity="0.4" />

              {/* Core — tiny, white-blue, sharp */}
              <circle cx={0} cy={0} r={10}
                fill="white"
                style={{ filter: `drop-shadow(0 0 10px #B0C4FF) drop-shadow(0 0 5px white)` }}>
                <animate attributeName="r" values="9;11;9" dur="1.5s" repeatCount="indefinite" />
              </circle>
              <circle cx={0} cy={0} r={6} fill="#E8EEFF" />
              <circle cx={0} cy={0} r={3} fill="white" />

              {/* Hover halo */}
              <circle cx={0} cy={0} r={45} fill="none"
                stroke={sys.star.color} strokeWidth={8}
                strokeOpacity={isHovered ? 0.18 : 0}
                style={{ transition: "stroke-opacity 0.25s" }} />

              <text x={0} y={55} textAnchor="middle"
                fill={sys.star.color} fontSize="15"
                fontFamily="var(--font-cinzel), serif" fontWeight="600">
                {sys.star.name}
              </text>
            </>
          ) : sys.star.type.toLowerCase().includes("pulsar") ? (
            <>
              {/* Pulsar — compact neutron star with soft beam cones at fixed angle */}
              <defs>
                {/* Beam gradient: bright near core, fades to nothing */}
                <radialGradient id={`pulsar-beam-${pin.slug}`} cx="50%" cy="0%" rx="50%" ry="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.6" />
                  <stop offset="15%" stopColor={sys.star.color} stopOpacity="0.4" />
                  <stop offset="60%" stopColor={sys.star.color} stopOpacity="0.08" />
                  <stop offset="100%" stopColor={sys.star.color} stopOpacity="0" />
                </radialGradient>
                {/* Core ambient glow */}
                <radialGradient id={`pulsar-glow-${pin.slug}`}>
                  <stop offset="0%" stopColor="white" stopOpacity="0.8" />
                  <stop offset="30%" stopColor={sys.star.color} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={sys.star.color} stopOpacity="0" />
                </radialGradient>
                {/* Disk gradient */}
                <radialGradient id={`pulsar-disk-${pin.slug}`}>
                  <stop offset="0%" stopColor={sys.star.color} stopOpacity="0.3" />
                  <stop offset="60%" stopColor={sys.star.color} stopOpacity="0.12" />
                  <stop offset="100%" stopColor={sys.star.color} stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Beam assembly at -30° */}
              <g transform="rotate(-30)">
                {/* Outer soft beams — wide, dim */}
                <ellipse cx={0} cy={-40} rx={14} ry={35} fill={`url(#pulsar-beam-${pin.slug})`}>
                  <animate attributeName="opacity" values="0.5;0.8;0.5" dur="2s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx={0} cy={40} rx={14} ry={35} fill={`url(#pulsar-beam-${pin.slug})`}>
                  <animate attributeName="opacity" values="0.5;0.8;0.5" dur="2s" repeatCount="indefinite" />
                </ellipse>
                {/* Inner bright beams — narrow, bright */}
                <ellipse cx={0} cy={-35} rx={4} ry={30} fill="white" opacity="0.12">
                  <animate attributeName="opacity" values="0.08;0.18;0.08" dur="2s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx={0} cy={35} rx={4} ry={30} fill="white" opacity="0.12">
                  <animate attributeName="opacity" values="0.08;0.18;0.08" dur="2s" repeatCount="indefinite" />
                </ellipse>
              </g>

              {/* Magnetic field lines — arcing pole to pole */}
              <g transform="rotate(-30)" style={{ pointerEvents: "none" }}>
                {[
                  { bulge: 25, w: 1.0, o: 0.35, dur: 2.8 },
                  { bulge: 38, w: 1.2, o: 0.45, dur: 2.4 },
                  { bulge: 52, w: 0.9, o: 0.30, dur: 3.2 },
                  { bulge: 66, w: 0.7, o: 0.22, dur: 3.0 },
                  { bulge: 80, w: 0.5, o: 0.15, dur: 2.6 },
                ].map(({ bulge, w, o, dur }, i) => (
                  <g key={`field-${i}`}>
                    {/* Right arc */}
                    <path
                      d={`M 0,-20 C ${bulge},-14 ${bulge},14 0,20`}
                      fill="none" stroke={sys.star.color} strokeWidth={w}
                    >
                      <animate attributeName="opacity" values={`${o * 0.6};${o};${o * 0.6}`} dur={`${dur}s`} repeatCount="indefinite" />
                    </path>
                    {/* Left arc (mirrored) */}
                    <path
                      d={`M 0,-20 C ${-bulge},-14 ${-bulge},14 0,20`}
                      fill="none" stroke={sys.star.color} strokeWidth={w}
                    >
                      <animate attributeName="opacity" values={`${o * 0.6};${o};${o * 0.6}`} dur={`${dur}s`} repeatCount="indefinite" />
                    </path>
                  </g>
                ))}
              </g>

              {/* Accretion disk — perpendicular to beams (rotated 60°) */}
              <g transform="rotate(60)">
                <ellipse cx={0} cy={0} rx={38} ry={5} fill={`url(#pulsar-disk-${pin.slug})`} />
                <ellipse cx={0} cy={0} rx={38} ry={5}
                  fill="none" stroke={sys.star.color} strokeWidth={0.8} opacity="0.25">
                  <animate attributeName="opacity" values="0.15;0.35;0.15" dur="2s" repeatCount="indefinite" />
                </ellipse>
              </g>

              {/* Ambient glow */}
              <circle cx={0} cy={0} r={22} fill={`url(#pulsar-glow-${pin.slug})`}>
                <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
              </circle>

              {/* Core — tiny, white-hot */}
              <circle cx={0} cy={0} r={6} fill="white"
                style={{ filter: `drop-shadow(0 0 8px ${sys.star.color}) drop-shadow(0 0 4px white)` }}>
                <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx={0} cy={0} r={3} fill="white" />

              {/* Hover halo */}
              <circle cx={0} cy={0} r={45} fill="none"
                stroke={sys.star.color} strokeWidth={8}
                strokeOpacity={isHovered ? 0.18 : 0}
                style={{ transition: "stroke-opacity 0.25s" }} />

              <text x={0} y={55} textAnchor="middle"
                fill={sys.star.color} fontSize="15"
                fontFamily="var(--font-cinzel), serif" fontWeight="600">
                {sys.star.name}
              </text>
            </>
          ) : (
            <>
              {/* Single star */}
              <circle cx={0} cy={0} r={80} fill={`url(#starCorona-${pin.slug})`}
                style={{ animation: "starPulse 4s ease-in-out infinite" }} />
              <circle cx={0} cy={0} r={40} fill={`url(#starGlow-${pin.slug})`} />
              <circle cx={0} cy={0} r={65} fill="none"
                stroke={sys.star.color} strokeWidth={12}
                strokeOpacity={isHovered ? 0.18 : 0}
                style={{ transition: "stroke-opacity 0.25s" }} />
              <circle cx={0} cy={0} r={22} fill={sys.star.color}
                style={{
                  filter: isHovered
                    ? `drop-shadow(0 0 22px ${sys.star.color}) drop-shadow(0 0 8px white)`
                    : `drop-shadow(0 0 12px ${sys.star.color})`,
                  transition: "filter 0.25s",
                }} />
              <text x={0} y={55} textAnchor="middle"
                fill={sys.star.color} fontSize="15"
                fontFamily="var(--font-cinzel), serif" fontWeight="600">
                {sys.star.name}
              </text>
            </>
          )}
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

          {/* Body rendering — custom systems use their own renderer, others use standard layout */}
          {override ? (
            <ImperialCoreCluster
              pin={pin}
              sectorSlug={sectorSlug}
              bodies={sys.bodies}
              isActive={isActive}
              activeBodyId={activeBodyId}
              vb={vb}
              tooltipActions={tooltipActions}
            />
          ) : (
            <>
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
                const cardH = bodyCardHeight(body.special_attribute, body.kankaUrl, body.allegiance);
                const bodyR = bodyLabelR(body.type);

                return (
                  <SvgTooltip
                    anchorX={pos.x} anchorY={pos.y}
                    cardW={cardW} cardH={cardH}
                    color={bodyColor} clearance={bodyR + 16}
                    viewBox={vb!}
                    parentOffsetX={pin.x} parentOffsetY={pin.y}
                    scale={sysScale}
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
                      allegiance={body.allegiance ? ALLEGIANCES[body.allegiance] : undefined}
                    />
                  </SvgTooltip>
                );
              })()}
            </>
          )}
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
