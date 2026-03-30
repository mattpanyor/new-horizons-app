import type { SystemPin, VortexPin, MapMarker } from "@/types/sector";

// ── Sector Map constants & pure geometry helpers ──

export const FULL_W = 1200;
export const FULL_H = 800;

export const SECTOR_TERRITORY: Record<string, { cx: number; cy: number; arcStart: number; arcEnd: number }> = {
  "atlas-sector":   { cx: 80,   cy: 720, arcStart: 270, arcEnd: 360 },
  "denerum-sector": { cx: 80,   cy: 80,  arcStart: 0,   arcEnd: 90  },
  "castell-sector": { cx: 1120, cy: 80,  arcStart: 90,  arcEnd: 180 },
  "vintar-sector":  { cx: 1120, cy: 720, arcStart: 180, arcEnd: 270 },
};

export const TERRITORY_INNER_R = 260;
export const TERRITORY_OUTER_R = 920;
export const LABEL_PAD = 30;
export const LABEL_PAD_REVERSED = 62; // larger offset for inner-curve text baseline

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 10;
export const ZOOM_STEP = 0.15;
export const FOCUS_ZOOM = 5.8;
export const AUTO_SELECT_ZOOM = 3.2;

export const SYS_SCALE = 0.25;
export const SYS_MAX_R = 250;

export const BG_STARS = [
  { x: 80, y: 60 }, { x: 200, y: 35 }, { x: 380, y: 20 }, { x: 550, y: 55 },
  { x: 720, y: 30 }, { x: 900, y: 50 }, { x: 1050, y: 25 }, { x: 1150, y: 80 },
  { x: 30, y: 180 }, { x: 140, y: 250 }, { x: 310, y: 200 }, { x: 460, y: 170 },
  { x: 640, y: 210 }, { x: 820, y: 180 }, { x: 980, y: 220 }, { x: 1120, y: 190 },
  { x: 50, y: 380 }, { x: 230, y: 420 }, { x: 430, y: 390 }, { x: 600, y: 440 },
  { x: 780, y: 400 }, { x: 960, y: 430 }, { x: 1100, y: 370 }, { x: 70, y: 570 },
  { x: 270, y: 610 }, { x: 480, y: 580 }, { x: 700, y: 620 }, { x: 880, y: 590 },
  { x: 1050, y: 640 }, { x: 1170, y: 560 }, { x: 160, y: 740 }, { x: 380, y: 760 },
  { x: 600, y: 775 }, { x: 820, y: 750 }, { x: 1000, y: 770 },
];

// Fleet formation: lead at front-left, two escorts trailing right
export const FLEET_SHIPS = [
  { dx: 0, dy: 0, r: 14 },
  { dx: 20, dy: -9, r: 10 },
  { dx: 20, dy: 9, r: 7 },
];

// ── Geometry helpers ──

/** Triangle pointing upward, centered at (cx, cy) with half-height r */
export const tri = (cx: number, cy: number, r: number) =>
  `${cx},${cy - r} ${cx - r * 0.7},${cy + r * 0.6} ${cx + r * 0.7},${cy + r * 0.6}`;

/** Triangle pointing left, centered at (cx, cy) with half-width r */
export const triLeft = (cx: number, cy: number, r: number) =>
  `${cx - r},${cy} ${cx + r * 0.6},${cy - r * 0.7} ${cx + r * 0.6},${cy + r * 0.7}`;

/** Radius of faction territory blobs around each system, in canvas units */
export const TERRITORY_RADIUS = 120;

/** Deterministic PRNG: djb2 hash → LCG, yields 0–1 floats */
export function rng(seed: string) {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 33) ^ seed.charCodeAt(i)) | 0;
  return () => { h = (Math.imul(h, 1664525) + 1013904223) | 0; return ((h >>> 8) & 0xffff) / 0xffff; };
}

const TAU = Math.PI * 2;
const f = (n: number) => n.toFixed(2);

/** Smooth wavy blob — 3-harmonic sine perturbation + quadratic Bézier midpoint closure.
 *  `seed` makes the shape deterministic; `ratio` stretches it elliptically. */
export function wavyCloudPath(cx: number, cy: number, r: number, { seed, ratio }: { seed?: string; ratio?: [number, number] } = {}): string {
  const next = seed ? rng(seed) : null;
  const p1 = next ? next() * TAU : 0, p2 = next ? next() * TAU : 1.1, p3 = next ? next() * TAU : 2.3;
  const sx = ratio ? ratio[0] / Math.max(...ratio) : 1;
  const sy = ratio ? ratio[1] / Math.max(...ratio) : 1;
  const N = 24;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const d = r + Math.sin(3 * a + p1) * r * 0.14 + Math.sin(5 * a + p2) * r * 0.08 + Math.sin(7 * a + p3) * r * 0.04;
    pts.push([cx + d * sx * Math.cos(a), cy + d * sy * Math.sin(a)]);
  }
  const mid = (i: number): [number, number] => [(pts[i][0] + pts[(i + 1) % N][0]) / 2, (pts[i][1] + pts[(i + 1) % N][1]) / 2];
  const [mx, my] = mid(N - 1);
  const parts = [`M ${f(mx)} ${f(my)}`];
  for (let i = 0; i < N; i++) { const [px, py] = pts[i], [nx, ny] = mid(i); parts.push(`Q ${f(px)} ${f(py)} ${f(nx)} ${f(ny)}`); }
  return parts.join(" ") + " Z";
}

/** Deterministic dot cluster for asteroid fields — seed from body id */
export function asteroidDots(seed: string): { x: number; y: number; r: number }[] {
  const next = rng(seed);
  const COUNT = 8;
  return Array.from({ length: COUNT }, (_, i) => {
    const angle = i * 2.399963;
    const radius = Math.sqrt((i + 0.5) / COUNT) * 14;
    const jx = next() * 6 - 3;
    const jy = next() * 6 - 3;
    const r = Math.round((1.5 + next() * 2) * 1e2) / 1e2;
    return {
      x: Math.round((radius * Math.cos(angle) + jx) * 1e4) / 1e4,
      y: Math.round((radius * Math.sin(angle) + jy) * 1e4) / 1e4,
      r,
    };
  });
}

/** Convert orbit position (degrees) + distance (0-1) to local (x,y) in system space */
export function getBodyPos(orbitPos: number, orbitDist: number) {
  const rad = ((orbitPos - 90) * Math.PI) / 180;
  const r = orbitDist * SYS_MAX_R;
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return { x: round(r * Math.cos(rad)), y: round(r * Math.sin(rad)) };
}

/** Hit radius per body type for proximity-based hover detection */
export function bodyHitRadius(bodyType: string): number {
  switch (bodyType) {
    case "fleet": return 40;
    case "asteroid-field": return 50;
    case "station": return 30;
    default: return 30;
  }
}

/** Perpendicular normal from a direction vector */
export function perpNorm(dx: number, dy: number) {
  const len = Math.sqrt(dx * dx + dy * dy);
  return len > 0 ? { x: -dy / len, y: dx / len } : { x: 0, y: -1 };
}

/** Compute bezier curve geometry for a connection line */
export function computeConnectionCurve(
  fromObj: { x: number; y: number },
  toObj: { x: number; y: number },
  curvature: number,
  fromRadius: number,
  toRadius: number,
) {
  const p0 = { x: fromObj.x, y: fromObj.y };
  const p2 = { x: toObj.x, y: toObj.y };

  const mx = (p0.x + p2.x) / 2;
  const my = (p0.y + p2.y) / 2;
  const segDx = p2.x - p0.x, segDy = p2.y - p0.y;
  const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
  const perpX = segLen > 0 ? (-segDy / segLen) * curvature : 0;
  const perpY = segLen > 0 ? (segDx / segLen) * curvature : 0;
  const p1 = { x: mx + perpX, y: my + perpY };

  // Trim start along tangent at t=0
  const tan0x = p1.x - p0.x, tan0y = p1.y - p0.y;
  const tan0len = Math.sqrt(tan0x * tan0x + tan0y * tan0y);
  const p0t = tan0len > 0
    ? { x: p0.x + (tan0x / tan0len) * fromRadius, y: p0.y + (tan0y / tan0len) * fromRadius }
    : p0;

  // Trim end along -tangent at t=1
  const tan1x = p1.x - p2.x, tan1y = p1.y - p2.y;
  const tan1len = Math.sqrt(tan1x * tan1x + tan1y * tan1y);
  const p2t = tan1len > 0
    ? { x: p2.x + (tan1x / tan1len) * toRadius, y: p2.y + (tan1y / tan1len) * toRadius }
    : p2;

  return { p0, p1, p2, p0t, p2t };
}

/** Evaluate quadratic bezier at parameter t */
export function bezierAt(p0t: { x: number; y: number }, p1: { x: number; y: number }, p2t: { x: number; y: number }, t: number) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0t.x + 2 * mt * t * p1.x + t * t * p2t.x,
    y: mt * mt * p0t.y + 2 * mt * t * p1.y + t * t * p2t.y,
  };
}

/** Tangent vector of quadratic bezier at parameter t */
export function bezierTangent(p0t: { x: number; y: number }, p1: { x: number; y: number }, p2t: { x: number; y: number }, t: number) {
  const mt = 1 - t;
  return {
    x: 2 * mt * (p1.x - p0t.x) + 2 * t * (p2t.x - p1.x),
    y: 2 * mt * (p1.y - p0t.y) + 2 * t * (p2t.y - p1.y),
  };
}

/**
 * Test whether canvas point (px, py) lies within the annular sector territory for the given
 * sector slug. The boundary is a quarter-disc ring: inner radius TERRITORY_INNER_R, outer radius
 * TERRITORY_OUTER_R, swept from arcStart to arcEnd degrees (standard math angles, x-right y-down).
 * Returns true for unknown slugs so the hook is permissive on unregistered sectors.
 */
export function isInSectorTerritory(px: number, py: number, slug: string): boolean {
  const territory = SECTOR_TERRITORY[slug];
  if (!territory) return true; // unknown sector — allow everywhere
  const { cx, cy, arcStart, arcEnd } = territory;
  const dx = px - cx;
  const dy = py - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < TERRITORY_INNER_R || dist > TERRITORY_OUTER_R) return false;
  const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
  const arcSpan = arcEnd - arcStart;
  const swept = (angle - arcStart + 360) % 360;
  return swept <= arcSpan;
}

/** Default trim radius for free-floating markers used as connection endpoints */
export const MARKER_ENDPOINT_RADIUS = 15;

/** Compute the trim radius for a connection endpoint (system orbit edge, vortex edge, or marker) */
export function endpointRadius(
  slug: string,
  systems: SystemPin[],
  vortexes: VortexPin[],
  orbitDataMap: Map<string, { maxOrbit: number }>,
  markers?: MapMarker[],
): number {
  const sys = systems.find(s => s.slug === slug);
  if (sys) return (orbitDataMap.get(sys.slug)?.maxOrbit ?? 40) * SYS_SCALE + 8;
  const vortex = vortexes.find(v => v.slug === slug);
  if (vortex) return vortex.radius ?? 80;
  if (markers) {
    const marker = markers.find(m => m.slug === slug);
    if (marker) return MARKER_ENDPOINT_RADIUS;
  }
  return 80;
}
