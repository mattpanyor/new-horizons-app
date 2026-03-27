import { PLANNING_COLOR, WAYPOINT_DRAW_R, formatTravelTime, type Waypoint } from "@/lib/planningMode";
import { rng } from "@/lib/sectorMapHelpers";

const TAU = Math.PI * 2;

interface PlanningLayerProps {
  waypoints: Waypoint[];
  /** Current viewBox for scaling labels to stay readable */
  vb: { x: number; y: number; w: number; h: number };
}

export function PlanningLayer({ waypoints, vb }: PlanningLayerProps) {
  if (waypoints.length === 0) return null;

  // Scale factor so text/circles stay a consistent screen size regardless of zoom
  const scale = vb.w / 1200;
  const r = WAYPOINT_DRAW_R * scale;
  const segFontSize = 11 * scale;
  const outerR = r * 2.2;          // constant across all waypoints
  const arcR = outerR + 3 * scale; // constant across all waypoints
  const arcSpan = 0.5;             // constant across all waypoints

  return (
    <g style={{ pointerEvents: "none" }}>
      {/* Segment lines + labels — single pass, dx/dy/len computed once per segment */}
      {waypoints.map((wp, i) => {
        if (i === 0) return null;
        const prev = waypoints[i - 1];
        const dx = wp.x - prev.x;
        const dy = wp.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const mx = (prev.x + wp.x) / 2;
        const my = (prev.y + wp.y) / 2;
        const nx = len > 0 ? -dy / len : 0;
        const ny = len > 0 ? dx / len : -1;
        const off = 18 * scale;
        let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angleDeg > 90) angleDeg -= 180;
        else if (angleDeg < -90) angleDeg += 180;
        // Reuse len to avoid a second sqrt — segmentDistance rounds the same value
        const dist = Math.round(len);
        const lx = mx + nx * off;
        const ly = my + ny * off;
        return (
          <g key={`seg-${i}`}>
            {/* Soft glow line behind */}
            <line
              x1={prev.x} y1={prev.y}
              x2={wp.x} y2={wp.y}
              stroke={PLANNING_COLOR}
              strokeWidth={5 * scale}
              opacity={0.08}
              strokeLinecap="round"
            />
            {/* Main dashed line */}
            <line
              x1={prev.x} y1={prev.y}
              x2={wp.x} y2={wp.y}
              stroke={PLANNING_COLOR}
              strokeWidth={1.2 * scale}
              strokeDasharray={`${6 * scale} ${4 * scale}`}
              opacity={0.6}
              strokeLinecap="round"
            />
            {/* Segment travel-time label */}
            <text
              x={lx} y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              fill={PLANNING_COLOR}
              fontSize={segFontSize}
              fontFamily="var(--font-geist-sans), sans-serif"
              fontWeight={600}
              opacity={0.85}
              transform={`rotate(${angleDeg} ${lx} ${ly})`}
            >
              {formatTravelTime(dist)}
            </text>
          </g>
        );
      })}

      {/* Waypoint markers */}
      {waypoints.map((wp, i) => {
        const next = rng(String(i)); // deterministic per waypoint index

        return (
          <g key={`wp-${i}`}>
            {/* Thin outer border circle */}
            <circle
              cx={wp.x} cy={wp.y} r={outerR}
              fill="none"
              stroke={PLANNING_COLOR}
              strokeWidth={0.5 * scale}
              strokeOpacity={0.5}
            />

            {/* Decorative curves — four arcs spaced around the border */}
            {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a, j) => {
              const x1 = wp.x + arcR * Math.cos(a - arcSpan);
              const y1 = wp.y + arcR * Math.sin(a - arcSpan);
              const x2 = wp.x + arcR * Math.cos(a + arcSpan);
              const y2 = wp.y + arcR * Math.sin(a + arcSpan);
              const cpR = arcR + 4 * scale;
              const cpx = wp.x + cpR * Math.cos(a);
              const cpy = wp.y + cpR * Math.sin(a);
              return (
                <path
                  key={j}
                  d={`M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`}
                  fill="none"
                  stroke={PLANNING_COLOR}
                  strokeWidth={0.6 * scale}
                  strokeOpacity={0.35}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Long random curves connecting core to outer ring */}
            {Array.from({ length: 16 }, (_, j) => {
              const a1 = next() * TAU;
              const a2 = next() * TAU;
              const cpA = next() * TAU;
              const cpR = 0.2 + next() * 0.6;
              const op = 0.15 + next() * 0.25;
              const x1 = wp.x + r * Math.cos(a1);
              const y1 = wp.y + r * Math.sin(a1);
              const x2 = wp.x + outerR * Math.cos(a2);
              const y2 = wp.y + outerR * Math.sin(a2);
              const cpx = wp.x + (r + (outerR - r) * cpR) * Math.cos(cpA);
              const cpy = wp.y + (r + (outerR - r) * cpR) * Math.sin(cpA);
              return (
                <path
                  key={j}
                  d={`M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`}
                  fill="none"
                  stroke={PLANNING_COLOR}
                  strokeWidth={0.5 * scale}
                  strokeOpacity={op}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Radial gradient for soft-edged core */}
            <defs>
              <radialGradient id={`wp-glow-${i}`}>
                <stop offset="0%" stopColor={PLANNING_COLOR} stopOpacity={0.95} />
                <stop offset="55%" stopColor={PLANNING_COLOR} stopOpacity={0.85} />
                <stop offset="100%" stopColor={PLANNING_COLOR} stopOpacity={0} />
              </radialGradient>
            </defs>
            {/* Soft-edged glowing core */}
            <circle
              cx={wp.x} cy={wp.y} r={r * 1.3}
              fill={`url(#wp-glow-${i})`}
              stroke="none"
            />

            {/* Number label — black for contrast on bright core */}
            <text
              x={wp.x}
              y={wp.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#0c0c14"
              fontSize={r * 1.3}
              fontFamily="var(--font-cinzel), serif"
              fontWeight={700}
            >
              {i + 1}
            </text>
          </g>
        );
      })}

      {/* Total box is rendered as HTML overlay in PlanningTotalBox */}
    </g>
  );
}

// PlanningTotalBox has been moved to components/sectormap/PlanningTotalBox.tsx
