/**
 * Bespoke rendering for the Imperial Core "Solara Nexus" star system.
 * Renders 16 outer ward-planets in a circle with pulsing leylines
 * to a central 3-segment planet. Inserted into StarSystemView when
 * the system slug matches.
 *
 * All Imperial Core-specific logic lives here — core files only read
 * the exported SYSTEM_OVERRIDES config and delegate rendering/hit-detection.
 */
import { memo } from "react";
import type { CelestialBody } from "@/types/starsystem";
import type { StarSystemMetadata } from "@/types/starsystem";
import type { SvgViewBox } from "@/components/SvgTooltip";
import type { TooltipActions } from "@/hooks/useSvgTooltipTimer";
import type { SystemPin } from "@/types/sector";
import { SvgTooltip } from "@/components/SvgTooltip";
import { getBodyColors } from "@/lib/bodyColors";
import { bodyHitRadius } from "@/lib/sectorMapHelpers";
import { BodyInfoCard, bodyCardHeight } from "./bodies/BodyInfoCard";
import { BodyShape, bodyLabelR } from "./bodies/BodyShape";
import { ALLEGIANCES } from "@/lib/allegiances";

const CORE_SYS_MAX_R = 450;
const CORE_SYS_SCALE = 0.6;
const CORE_FOCUS_ZOOM = 1.8;

function getCoreBodyPos(orbitPos: number, orbitDist: number) {
  const rad = ((orbitPos - 90) * Math.PI) / 180;
  const r = orbitDist * CORE_SYS_MAX_R;
  return { x: Math.round(r * Math.cos(rad) * 1e6) / 1e6, y: Math.round(r * Math.sin(rad) * 1e6) / 1e6 };
}

interface ImperialCoreClusterProps {
  pin: SystemPin;
  sectorSlug: string;
  bodies: CelestialBody[];
  isActive: boolean;
  activeBodyId: string | null;
  vb: SvgViewBox | undefined;
  tooltipActions: TooltipActions;
}

// The 3 segment IDs for the central planet
const CORE_SEGMENT_IDS = ["nexus-core-upper", "nexus-core-middle", "nexus-core-lower"];
const CORE_R = 30; // radius of the central planet
const WARD_MAX_R = 119; // max orbit radius for ward planets (orbitDistance 1.0 = CORE_R + 119)

const CORE_SEGMENT_COLORS: Record<string, { color: string; secondary: string }> = {
  "nexus-core-upper":  { color: "#4ADE80", secondary: "#166534" },  // fey green
  "nexus-core-middle": { color: "#FBBF24", secondary: "#92400E" },  // golden
  "nexus-core-lower":  { color: "#A78BFA", secondary: "#4C1D95" },  // purple void
};

export const ImperialCoreCluster = memo(function ImperialCoreCluster({
  pin, sectorSlug, bodies, isActive, activeBodyId, vb, tooltipActions,
}: ImperialCoreClusterProps) {
  const coreSegments = bodies.filter((b) => CORE_SEGMENT_IDS.includes(b.id));
  const wardPlanets = bodies.filter((b) => !CORE_SEGMENT_IDS.includes(b.id));

  // Cluster center = position of the core segments (all share same orbit)
  const firstSeg = coreSegments[0];
  const clusterCenter = firstSeg
    ? getCoreBodyPos(firstSeg.orbitPosition, firstSeg.orbitDistance)
    : { x: 0, y: 0 };

  // Ward planet position: orbits around clusterCenter, distance driven by orbitDistance
  function wardPos(angleDeg: number, orbitDist: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    const dist = CORE_R + orbitDist * WARD_MAX_R;
    return {
      x: clusterCenter.x + dist * Math.cos(rad),
      y: clusterCenter.y + dist * Math.sin(rad),
    };
  }

  return (
    <>
      {/* Leylines — 3 per ward planet, grey glowing tendrils */}
      {wardPlanets.map((body) => {
        const pos = wardPos(body.orbitPosition, body.orbitDistance);
        const cx = clusterCenter.x;
        const cy = clusterCenter.y;
        const dx = pos.x - cx;
        const dy = pos.y - cy;
        // Perpendicular direction for offsetting the 3 lines
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const px = -dy / len;
        const py = dx / len;

        // 3 leylines with different curve offsets and glow intensities
        // Pseudo-random based on orbit angle
        const seed = body.orbitPosition * 137.5;
        const r1 = ((Math.sin(seed) + 1) * 0.5);
        const r2 = ((Math.sin(seed * 2.3 + 1) + 1) * 0.5);
        const r3 = ((Math.sin(seed * 3.7 + 2) + 1) * 0.5);

        const PLANET_R = 12; // ward planet body radius
        const leylines = [
          { startOffset: -PLANET_R, endOffset: -1, curve: 3 + r1 * 4, opacity: 0.3, width: 1.2, dur: 2.5 + r1 * 1.5 },
          { startOffset: 0,         endOffset: 0,  curve: -(2 + r2 * 4), opacity: 0.2, width: 1.8, dur: 2.0 + r2 * 2.0 },
          { startOffset: PLANET_R,  endOffset: 1,  curve: 2 + r3 * 5, opacity: 0.25, width: 1.0, dur: 3.0 + r3 * 1.0 },
        ];

        return (
          <g key={`ley-${body.id}`} style={{ pointerEvents: "none" }}>
            {leylines.map((ley, i) => {
              // Start fanned at ward planet edge, converge at core
              const sx = pos.x + px * ley.startOffset;
              const sy = pos.y + py * ley.startOffset;
              const ex = cx + px * ley.endOffset;
              const ey = cy + py * ley.endOffset;
              // Hourglass: side lines pinch inward first, then double-S to core
              // Inward pull for side leylines (0 for center one)
              const inward = -ley.startOffset * 0.8;
              // Midpoint pulled toward center line for tighter bundle
              const rawMidX = (sx + ex) / 2;
              const rawMidY = (sy + ey) / 2;
              const midX = rawMidX - px * ley.startOffset * 0.7;
              const midY = rawMidY - py * ley.startOffset * 0.7;
              // First half: pull inward near ward planet, then S-curve
              const c1x = sx + (midX - sx) * 0.25 + px * inward;
              const c1y = sy + (midY - sy) * 0.25 + py * inward;
              const c2x = sx + (midX - sx) * 0.7 + px * ley.curve;
              const c2y = sy + (midY - sy) * 0.7 + py * ley.curve;
              // Second half: S-curve toward core
              const c3x = midX + (ex - midX) * 0.3 - px * ley.curve * 0.7;
              const c3y = midY + (ey - midY) * 0.3 - py * ley.curve * 0.7;
              const c4x = midX + (ex - midX) * 0.75 + px * ley.curve * 0.5;
              const c4y = midY + (ey - midY) * 0.75 + py * ley.curve * 0.5;
              const d = `M ${sx} ${sy} C ${c1x} ${c1y} ${c2x} ${c2y} ${midX} ${midY} C ${c3x} ${c3y} ${c4x} ${c4y} ${ex} ${ey}`;

              return (
                <g key={i}>
                  <path d={d} fill="none"
                    stroke="rgba(200,200,220,0.8)" strokeWidth={ley.width}
                  >
                    <animate
                      attributeName="stroke-opacity"
                      values={`${ley.opacity * 0.4};${ley.opacity};${ley.opacity * 0.4}`}
                      dur={`${ley.dur}s`}
                      repeatCount="indefinite"
                    />
                  </path>
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Ward planets (normal body rendering) */}
      {wardPlanets.map((body) => {
        const pos = wardPos(body.orbitPosition, body.orbitDistance);
        const isBodyActive = isActive && activeBodyId === body.id;
        const { color: bodyColor } = getBodyColors(body);
        const labelR = bodyLabelR(body.type);

        // Push label radially outward from cluster center
        const LABEL_OFFSET = labelR + 22;
        const rad = ((body.orbitPosition - 90) * Math.PI) / 180;
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);
        const labelX = pos.x + cosR * LABEL_OFFSET;
        const labelY = pos.y + sinR * LABEL_OFFSET;
        // Anchor: if label is pushed right → "start", left → "end", straight up/down → "middle"
        const anchor = Math.abs(cosR) < 0.15 ? "middle" : cosR > 0 ? "start" : "end";
        // Vertical tweak: top labels sit above, bottom labels below, sides centered
        const dy = sinR < -0.7 ? "-0.3em" : sinR > 0.7 ? "1em" : "0.35em";

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
            <text x={labelX} y={labelY}
              textAnchor={anchor} dy={dy}
              fill={isBodyActive ? "white" : "rgba(255,255,255,0.6)"} fontSize="14"
              fontFamily="var(--font-cinzel), serif">
              {body.name}
            </text>
          </g>
        );
      })}

      {/* Central 3-segment planet */}
      <g style={{ pointerEvents: "none" }} transform={`translate(${clusterCenter.x}, ${clusterCenter.y})`}>
        {/* Local gradient defs for core segments */}
        <defs>
          {CORE_SEGMENT_IDS.map((id) => {
            const c = CORE_SEGMENT_COLORS[id];
            return (
              <radialGradient key={`core-grad-${id}`} id={`core-grad-${id}`}>
                <stop offset="0%" stopColor={c.color} stopOpacity="1" />
                <stop offset="70%" stopColor={c.secondary} stopOpacity="0.9" />
                <stop offset="100%" stopColor={c.secondary} stopOpacity="0.7" />
              </radialGradient>
            );
          })}
        </defs>

        {/* Solid background to block leylines */}
        <circle cx={0} cy={0} r={CORE_R} fill="#0a0a12" />

        {/* Outer glow */}
        <circle cx={0} cy={0} r={CORE_R + 8} fill="none"
          stroke="#F59E0B" strokeWidth={1} strokeOpacity={0.3}>
          <animate attributeName="r" values={`${CORE_R + 8};${CORE_R + 12};${CORE_R + 8}`} dur="3s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.3;0.1;0.3" dur="3s" repeatCount="indefinite" />
        </circle>

        {/* Segments: top cap, middle band, bottom cap — globe-style arced dividers */}
        {(() => {
          const R = CORE_R;
          // Divider endpoints sit on the circle at ±45° from horizontal
          const cutY = R * 0.5;
          const cutX = Math.sqrt(R * R - cutY * cutY);
          // Strong bow for globe look
          const bow = R * 0.55;

          const topQ = `Q 0 ${-cutY + bow}`;    // control point pulled toward center
          const topQRev = `Q 0 ${-cutY + bow}`;
          const botQ = `Q 0 ${cutY - bow}`;      // control point pulled toward center
          const botQRev = `Q 0 ${cutY - bow}`;

          const segmentDefs: { id: string; path: string }[] = [
            {
              // Top cap: short arc over top from left to right, then Q curve back
              id: "nexus-core-upper",
              path: `M ${-cutX} ${-cutY} A ${R} ${R} 0 0 1 ${cutX} ${-cutY} ${topQRev} ${-cutX} ${-cutY} Z`,
            },
            {
              // Middle band: Q curve top, right arc, Q curve bottom, left arc
              id: "nexus-core-middle",
              path: `M ${-cutX} ${-cutY} ${topQ} ${cutX} ${-cutY} A ${R} ${R} 0 0 1 ${cutX} ${cutY} ${botQRev} ${-cutX} ${cutY} A ${R} ${R} 0 0 1 ${-cutX} ${-cutY} Z`,
            },
            {
              // Bottom cap: Q curve from left to right, then short arc over bottom back
              id: "nexus-core-lower",
              path: `M ${-cutX} ${cutY} ${botQ} ${cutX} ${cutY} A ${R} ${R} 0 0 1 ${-cutX} ${cutY} Z`,
            },
          ];

          return segmentDefs.map(({ id, path }) => {
            const seg = coreSegments.find((b) => b.id === id);
            if (!seg) return null;
            const isSegActive = isActive && activeBodyId === id;
            const color = CORE_SEGMENT_COLORS[id]?.color ?? "#fff";
            return (
              <path
                key={id}
                d={path}
                fill={`url(#core-grad-${id})`}
                stroke={isSegActive ? "white" : "rgba(255,255,255,0.3)"}
                strokeWidth={isSegActive ? 2 : 0.5}
                style={{
                  cursor: isActive ? "pointer" : "default",
                  pointerEvents: isActive ? "all" : "none",
                  filter: isSegActive ? `drop-shadow(0 0 8px ${color})` : undefined,
                  transition: "fill-opacity 0.2s, stroke 0.2s",
                }}
                onClick={(e) => { e.stopPropagation(); tooltipActions.show(id); }}
              />
            );
          });
        })()}
      </g>

      {/* Active body tooltip — works for both ward planets and core segments */}
      {isActive && activeBodyId && (() => {
        const body = bodies.find((b) => b.id === activeBodyId);
        if (!body) return null;

        const isCoreSegment = CORE_SEGMENT_IDS.includes(body.id);
        const wardP = !isCoreSegment ? wardPos(body.orbitPosition, body.orbitDistance) : null;
        const anchorX = isCoreSegment ? clusterCenter.x : wardP!.x;
        const anchorY = isCoreSegment ? clusterCenter.y : wardP!.y;
        const { color: bodyColor } = getBodyColors(body);
        const cardW = 220;
        const cardH = bodyCardHeight(body.special_attribute, body.kankaUrl, body.allegiance);
        const clearance = isCoreSegment ? CORE_R + 16 : bodyLabelR(body.type) + 16;

        return (
          <SvgTooltip
            anchorX={anchorX} anchorY={anchorY}
            cardW={cardW} cardH={cardH}
            color={bodyColor} clearance={clearance}
            viewBox={vb!}
            parentOffsetX={pin.x} parentOffsetY={pin.y}
            scale={CORE_SYS_SCALE}
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
  );
});

// ── Exported config & hit detection ──
// Core files read these to avoid embedding Imperial Core logic.

function findNearestWardBody(
  localX: number, localY: number, bodies: StarSystemMetadata["bodies"],
): string | null {
  const coreSegBodies = bodies.filter((b) => CORE_SEGMENT_IDS.includes(b.id));
  const firstSeg = coreSegBodies[0];
  const cc = firstSeg
    ? getCoreBodyPos(firstSeg.orbitPosition, firstSeg.orbitDistance)
    : { x: 0, y: 0 };

  let nearest: string | null = null;
  let bestRatio = 1;
  for (const body of bodies) {
    if (CORE_SEGMENT_IDS.includes(body.id)) continue; // segments have their own click handlers
    const rad = ((body.orbitPosition - 90) * Math.PI) / 180;
    const dist = CORE_R + body.orbitDistance * WARD_MAX_R;
    const pos = { x: cc.x + dist * Math.cos(rad), y: cc.y + dist * Math.sin(rad) };
    const dx = localX - pos.x;
    const dy = localY - pos.y;
    const ratio = Math.sqrt(dx * dx + dy * dy) / bodyHitRadius(body.type);
    if (ratio < bestRatio) { bestRatio = ratio; nearest = body.id; }
  }
  return nearest;
}

export const SYSTEM_OVERRIDES: Record<string, {
  scale: number;
  maxR: number;
  focusZoom: number;
  findNearestBody: (localX: number, localY: number, bodies: StarSystemMetadata["bodies"]) => string | null;
}> = {
  "axiom-system": {
    scale: CORE_SYS_SCALE,
    maxR: CORE_SYS_MAX_R,
    focusZoom: CORE_FOCUS_ZOOM,
    findNearestBody: findNearestWardBody,
  },
};
