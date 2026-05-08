import * as THREE from "three";

// Tiny seedable PRNG (mulberry32). Replaces Math.random for the starfield
// painter so every client given the same seed paints the same sky.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Procedurally paint a high-resolution starfield + nebula canvas. Returns a
// CanvasTexture suitable for use as the visible skybox AND as the scene's
// environment map (mapping is set to EquirectangularReflectionMapping so a
// PMREM generator can pick it up for IBL).
//
// `seed` makes the output deterministic: pass the combat session id and every
// player in that session sees the same sky (and reloads keep it stable).
//
// Painting layers (in order):
//  1. Deep-space gradient (slight horizon brightening)
//  2. Stamped nebula cores (varied palettes, seeded random positions)
//     a) Background diffuse layer
//     b) Cloud detail via many overlapping radial gradients
//     c) Dark patches (multiply blend) for shadowy depth
//     d) Bright inner highlights (screen blend)
//  3. Star halos for the brightest stars
//  4. Tiny pinpoint stars across whole canvas (varied colors)
//  5. Dense star clusters near nebula cores (sky looks lived-in)
export function buildStarfield(seed: number = 1): THREE.Texture | null {
  if (typeof document === "undefined") return null;

  const random = mulberry32(seed || 1);

  const W = 4096;
  const H = 2048;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // ── Layer 1: deep-space base gradient ────────────────────────────────
  const baseGrad = ctx.createLinearGradient(0, 0, 0, H);
  baseGrad.addColorStop(0, "#02030a");
  baseGrad.addColorStop(0.45, "#080a1a");
  baseGrad.addColorStop(0.55, "#08091a");
  baseGrad.addColorStop(1, "#02030a");
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, W, H);

  // ── Layer 2: nebulae ─────────────────────────────────────────────────
  // Each palette is [diffuse, mid, hot core] — used in different blend modes.
  type Palette = { diffuse: string; mid: string; hot: string; dust: string };
  const PALETTES: Palette[] = [
    { diffuse: "rgba(96, 32, 128, 0.40)",  mid: "rgba(204, 64, 192, 0.55)",  hot: "rgba(255, 196, 240, 0.85)", dust: "rgba(15, 5, 35, 0.55)" },  // magenta
    { diffuse: "rgba(20, 60, 120, 0.45)",  mid: "rgba(80, 160, 220, 0.55)",  hot: "rgba(220, 240, 255, 0.85)", dust: "rgba(0, 8, 20, 0.55)" },   // electric blue
    { diffuse: "rgba(180, 80, 30, 0.35)",  mid: "rgba(240, 160, 80, 0.50)",  hot: "rgba(255, 230, 180, 0.80)", dust: "rgba(20, 8, 0, 0.55)" },   // amber/dusty orange
    { diffuse: "rgba(80, 60, 130, 0.40)",  mid: "rgba(140, 110, 220, 0.55)", hot: "rgba(220, 210, 255, 0.85)", dust: "rgba(8, 6, 30, 0.55)" },   // indigo / classic purple
    { diffuse: "rgba(100, 30, 80, 0.40)",  mid: "rgba(220, 60, 120, 0.50)",  hot: "rgba(255, 220, 230, 0.85)", dust: "rgba(18, 4, 12, 0.55)" },  // rose/red
    { diffuse: "rgba(50, 70, 30, 0.30)",   mid: "rgba(140, 200, 80, 0.42)",  hot: "rgba(220, 255, 200, 0.70)", dust: "rgba(8, 16, 4, 0.55)" },   // greenish (rare)
  ];

  const NEBULA_COUNT = 5;
  const nebulaCenters: { cx: number; cy: number; r: number; pal: Palette }[] = [];
  for (let i = 0; i < NEBULA_COUNT; i++) {
    const cx = 200 + random() * (W - 400);
    const cy = H * 0.25 + random() * H * 0.5;
    const r = 280 + random() * 320;
    const pal = PALETTES[Math.floor(random() * PALETTES.length)];
    nebulaCenters.push({ cx, cy, r, pal });
  }

  // Helper to paint one nebula's layered cloud.
  const paintNebula = (cx: number, cy: number, r: number, pal: Palette) => {
    // (a) Diffuse base — single huge soft gradient.
    ctx.globalCompositeOperation = "screen";
    const diff = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.2);
    diff.addColorStop(0, pal.diffuse);
    diff.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = diff;
    ctx.fillRect(cx - r * 1.5, cy - r * 1.5, r * 3, r * 3);

    // (b) Cloud detail — 35-50 small overlapping radial blobs of varied size
    //     and slight position offsets. Stamping like this gives organic shape.
    const blobCount = 35 + Math.floor(random() * 16);
    for (let b = 0; b < blobCount; b++) {
      const ang = random() * Math.PI * 2;
      const dist = random() * r;
      const bx = cx + Math.cos(ang) * dist;
      const by = cy + Math.sin(ang) * dist * 0.85; // slight vertical squash
      const br = 30 + random() * 90;
      const blob = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      blob.addColorStop(0, pal.mid);
      blob.addColorStop(0.6, pal.diffuse);
      blob.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = blob;
      ctx.fillRect(bx - br, by - br, br * 2, br * 2);
    }

    // (c) Hot inner core — a few brighter highlights (screen blend).
    const coreCount = 4 + Math.floor(random() * 4);
    for (let h = 0; h < coreCount; h++) {
      const ang = random() * Math.PI * 2;
      const dist = random() * r * 0.4;
      const hx = cx + Math.cos(ang) * dist;
      const hy = cy + Math.sin(ang) * dist;
      const hr = 18 + random() * 36;
      const hot = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
      hot.addColorStop(0, pal.hot);
      hot.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = hot;
      ctx.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
    }

    // (d) Dark patches — irregular shadowy regions (multiply blend) that
    //     give the nebula visible depth without looking like drawn strokes.
    //     Each patch is a small radial gradient at a random offset; many
    //     overlapping patches read as cloudy darkness rather than brush
    //     marks.
    ctx.globalCompositeOperation = "multiply";
    const patchCount = 12 + Math.floor(random() * 10);
    for (let p = 0; p < patchCount; p++) {
      const ang = random() * Math.PI * 2;
      const dist = random() * r * 0.85;
      const px = cx + Math.cos(ang) * dist;
      const py = cy + Math.sin(ang) * dist;
      const pr = 30 + random() * 80;
      const patch = ctx.createRadialGradient(px, py, 0, px, py, pr);
      patch.addColorStop(0, pal.dust);
      patch.addColorStop(1, "rgba(255,255,255,0)"); // transparent white = neutral for multiply
      ctx.fillStyle = patch;
      ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    }

    // Reset blend.
    ctx.globalCompositeOperation = "source-over";
  };

  for (const n of nebulaCenters) {
    paintNebula(n.cx, n.cy, n.r, n.pal);
  }

  // ── Layer 3: bright-tier star halos ──────────────────────────────────
  ctx.globalCompositeOperation = "screen";
  const HALO_COUNT = 60;
  for (let i = 0; i < HALO_COUNT; i++) {
    const x = random() * W;
    const y = random() * H;
    const r = 4 + random() * 6;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tint = i % 4 === 0 ? "rgba(220, 200, 255, 0.55)" :
                 i % 4 === 1 ? "rgba(255, 230, 200, 0.55)" :
                 i % 4 === 2 ? "rgba(200, 230, 255, 0.55)" :
                               "rgba(255, 255, 255, 0.55)";
    halo.addColorStop(0, tint);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = "source-over";

  // ── Layer 4: pinpoint stars across the whole canvas ──────────────────
  // Wider color palette than before — blue-white giants, orange dwarfs, etc.
  const STAR_COLORS = [
    "rgba(255,255,255,X)",  // base white
    "rgba(220,235,255,X)",  // blue-white
    "rgba(255,235,210,X)",  // sun-like
    "rgba(255,210,160,X)",  // orange dwarf
    "rgba(255,180,140,X)",  // red giant
    "rgba(200,220,255,X)",  // blue
    "rgba(240,240,220,X)",  // pale yellow
    "rgba(255,230,255,X)",  // pinkish
  ];
  const PINPOINT_COUNT = 4500;
  for (let i = 0; i < PINPOINT_COUNT; i++) {
    const x = random() * W;
    const y = random() * H;
    const sizeR = random();
    const size = sizeR < 0.7 ? 0.6 :
                 sizeR < 0.92 ? 1.0 :
                 sizeR < 0.99 ? 1.6 : 2.4;
    const alpha = 0.35 + random() * 0.55;
    const colorIdx = random() < 0.55 ? 0 : Math.floor(random() * STAR_COLORS.length);
    ctx.fillStyle = STAR_COLORS[colorIdx].replace("X", alpha.toFixed(2));
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Layer 5: extra-dense star clusters near nebulae ──────────────────
  for (const n of nebulaCenters) {
    const clusterStars = 200 + Math.floor(random() * 200);
    for (let i = 0; i < clusterStars; i++) {
      // Bias star placement toward the nebula center using sqrt distribution.
      const ang = random() * Math.PI * 2;
      const dist = Math.sqrt(random()) * n.r * 1.1;
      const x = n.cx + Math.cos(ang) * dist;
      const y = n.cy + Math.sin(ang) * dist;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const sizeR = random();
      const size = sizeR < 0.85 ? 0.6 : sizeR < 0.97 ? 1.2 : 1.8;
      const alpha = 0.45 + random() * 0.5;
      const colorIdx = random() < 0.5 ? 0 : Math.floor(random() * STAR_COLORS.length);
      ctx.fillStyle = STAR_COLORS[colorIdx].replace("X", alpha.toFixed(2));
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Equirectangular mapping is a no-op for a sphere mesh with explicit UVs,
  // but it lets PMREMGenerator treat this as an equirectangular env map.
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}
