// GLSL for the login / sectors background: a slowly turning planet entering
// from the lower right, a sun disc upper left, and a sparse star field.
// Everything is procedural — no texture assets, no wrap seam.
//
// Two programs, split by spatial frequency rather than by convenience:
//
//   BAKE runs six times at mount, once per cube face, and stores only smooth,
//   low-frequency fields — surface height, cloud density, a slow colour
//   variation. Nothing with a hard edge in it.
//
//   MAIN runs every frame and does everything sharp: the ridged filaments, the
//   land/water threshold, the ice line, the palette. All at screen resolution.
//
// That split is the whole design, and it is the opposite of the obvious one.
// A 1024 cube face puts only ~690k texels inside the visible slice of sphere
// against several million screen pixels, so anything baked is magnified around
// 7:1. Magnify a smooth height field and nobody can tell; magnify a
// high-contrast crest and you are looking at the texel grid. So the bake
// carries the expensive-but-soft part, and every hard edge is evaluated per
// pixel, where it costs octaves but cannot pixellate.
//
// A cubemap rather than an equirectangular map because the pole is on screen at
// this camera distance, and equirect bunches its texels there — you would see
// it smear exactly where the ice cap sits. A cube has even texel density and no
// seam in any direction.
//
// Coordinate space (MAIN): uv is (2 * frag - res) / res.y, so y runs -1 → 1 and
// x runs -aspect → aspect. Horizontal positions are multiples of the aspect
// ratio, which keeps the composition intact as the window changes shape.

// ── Composition ──────────────────────────────────────────────────────────────
// Fitted to the reference crop: three points along its limb give a circle of
// r≈3.48 centred at (1.88, -3.28). Big radius, centre far below frame — that
// combination is what reads as "close to the planet", because the visible limb
// flattens instead of curving away like a marble.
const COMPOSITION = /* glsl */ `
const float PLANET_R    = 3.45;
const float PLANET_CX_A = 0.94;
const float PLANET_CY   = -3.25;

const float SUN_CX_A    = -0.40;
const float SUN_CY      = 0.58;

// How far behind the planet's plane the sun sits. Negative backlights the
// planet: the sunward limb blazes and the terminator falls across the visible
// face. Toward 0 lights the whole face flat, more negative drags the
// terminator up into frame. At -2.6 twilight reaches the bottom-right corner.
const float SUN_DEPTH   = -2.60;

const vec3 SKY_TOP      = vec3(0.010, 0.007, 0.048);
const vec3 SKY_BOT      = vec3(0.020, 0.020, 0.098);
`;

// ── Shared surface model ─────────────────────────────────────────────────────
// Both programs need the same noise and the same flow field, or the filaments
// drawn per frame won't follow the terrain baked into the map.
const SURFACE = /* glsl */ `
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return -1.0 + 2.0 * fract((p.xxy + p.yxx) * p.zyx);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Scalar hash of a lattice cell — used to decide which cells hold a crater and
// which storm cells carry lightning, and to give each its own phase.
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

// Gradient noise on a trig-free hash — crisper per octave than value noise, and
// without its faint axis alignment.
float gnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dot(hash33(i + vec3(0.0, 0.0, 0.0)), f - vec3(0.0, 0.0, 0.0)),
                     dot(hash33(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0)), u.x),
                 mix(dot(hash33(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0)),
                     dot(hash33(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0)), u.x), u.y),
             mix(mix(dot(hash33(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0)),
                     dot(hash33(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0)), u.x),
                 mix(dot(hash33(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0)),
                     dot(hash33(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}

vec3 rotY(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

vec3 rotZ(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
}

// Latitudinal squash. Compressing y pulls features into horizontal bands, the
// way rotation does on a real atmosphere.
vec3 bandSpace(vec3 p, float k) {
  return vec3(p.x, p.y * k, p.z);
}

// Marbling, applied in unit-sphere space rather than in scaled detail space.
// That separation matters: the swirls then stay the same size on the planet
// however fine the detail gets, instead of shrinking every time detailScale
// goes up. Two rounds — a strong low-frequency one for the big folds, a weaker
// mid-frequency one to feather their edges. Deliberately isotropic; damping the
// vertical component is what was manufacturing jet-stream bands.
vec3 marbleWarp(vec3 p, float strength) {
  vec3 w1 = vec3(gnoise(p * 0.55 + vec3(11.5)),
                 gnoise(p * 0.55 + vec3(31.2)),
                 gnoise(p * 0.55 + vec3(57.8)));
  p += w1 * strength;
  vec3 w2 = vec3(gnoise(p * 1.70 + vec3(5.3)),
                 gnoise(p * 1.70 + vec3(23.1)),
                 gnoise(p * 1.70 + vec3(41.9)));
  p += w2 * strength * 0.45;
  return p;
}

// A localised cyclone: rotate the domain about an axis by an angle that decays
// with angular distance from it. Noise is statistically uniform and therefore
// cannot compose — it has no focal point and never will. Two of these, placed
// by hand, put deliberate structure into the field: a dominant swirl and a
// smaller counter-rotating one, which is most of what separates the reference
// from a texture swatch. Costs no noise samples at all.
// p is always unit here: shearSpin is a rotation and Rodrigues below preserves
// length, so both call sites in flowSpace pass a unit vector and the normalize
// was a no-op. (Inside the 1-2px antialias band the length is off by <5e-4, on
// pixels that are then blended out.)
vec3 swirl(vec3 p, vec3 axis, float strength, float falloff) {
  float d = 1.0 - dot(p, axis);
  float amt = strength * exp(-d * falloff);
  float c = cos(amt);
  float sn = sin(amt);
  return p * c + cross(axis, p) * sn + axis * dot(axis, p) * (1.0 - c);
}

vec3 shearSpin(vec3 dir, float shear) {
  return rotY(dir, sin(dir.y * 5.0) * shear);
}

// The one flow field. Everything — baked height, clouds, per-pixel ridges and
// turbulence — is evaluated in this space, so every layer folds around the same
// swirls instead of each having its own.
vec3 flowSpace(vec3 dir, float shear, float strength) {
  vec3 p = shearSpin(dir, shear);
  p = swirl(p, normalize(vec3(0.42, 0.30, 0.86)), 1.35, 2.6);
  p = swirl(p, normalize(vec3(-0.70, -0.35, 0.62)), -0.95, 3.4);
  return marbleWarp(p, strength);
}
`;

export const PLANET_VERT = /* glsl */ `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// ── Seam heal ────────────────────────────────────────────────────────────────
// Run once per surface texture at load, rendering a tileable copy of it.
//
// Stochastic tiling samples with REPEAT, so every cell contains the point where
// the image's right edge meets its left. Unless the two match, that shows as a
// straight line with a brightness step across it — and generated art never
// matches: this world's terrain measured 121 average on its left half against
// 131 on its right, which is exactly the step that was visible.
//
// The fix is the standard one. Near an edge, fade toward the same image offset
// by half a period. At u=0 the output is the source at u=0.5; at u=1 it is also
// the source at u=0.5 — the two edges become the same pixels by construction, so
// the wrap is continuous. The cost is a cross-shaped band where two unrelated
// parts of the picture are mixed, which on organic terrain reads as slight
// softness. A soft band in a random place beats a hard line in a grid.
export const PLANET_HEAL_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D u_src;
uniform float u_size;
uniform float u_band;

void main() {
  vec2 uv = gl_FragCoord.xy / u_size;
  float dx = min(uv.x, 1.0 - uv.x) / u_band;
  float dy = min(uv.y, 1.0 - uv.y) / u_band;
  float w = smoothstep(0.0, 1.0, min(min(dx, dy), 1.0));
  vec3 a = texture2D(u_src, uv).rgb;
  vec3 b = texture2D(u_src, fract(uv + 0.5)).rgb;
  gl_FragColor = vec4(mix(b, a, w), 1.0);
}
`;

// ── Bake: smooth fields only ─────────────────────────────────────────────────
export const PLANET_BAKE_FRAG = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform float u_size;
// The face's centre direction and its two in-plane axes, so the shader never
// has to know which face it is.
uniform vec3 u_faceA;
uniform vec3 u_faceB;
uniform vec3 u_faceC;

uniform float u_detailScale;
uniform float u_bandStretch;
uniform float u_flowStrength;
uniform float u_shear;
uniform float u_cloudScale;
uniform float u_cloudBand;

${SURFACE}

float fbm5(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * gnoise(p);
    p = p * 2.03 + vec3(0.31, 0.17, 0.23);
    a *= 0.5;
  }
  return s;
}

void main() {
  vec2 f = (2.0 * gl_FragCoord.xy / u_size) - 1.0;
  vec3 dir = normalize(u_faceA + u_faceB * f.x + u_faceC * f.y);
  vec3 flow = flowSpace(dir, u_shear, u_flowStrength);

  // R: surface height, and only the coarse part of it. Five octaves at 0.6 of
  // the detail scale keeps the bake under its own Nyquist limit (~326 cycles
  // per sphere radius for a 1024 face) — the intricacy of the coastline comes
  // from the per-pixel ridge mixed in later, not from here.
  vec3 q = bandSpace(flow * u_detailScale * 0.60, u_bandStretch);
  float height = fbm5(q) * 0.5 + 0.5;

  // G: cloud density, left raw so coverage can be tuned without a re-bake.
  vec3 cq = bandSpace(flow * u_cloudScale, u_cloudBand);
  float cloud = fbm5(cq) * 0.5 + 0.5;

  // B: which material the ground is made of, as a slow irregular field.
  float variety = (gnoise(dir * 1.1 + vec3(19.7)) * 0.5
                 + gnoise(dir * 2.3 + vec3(41.3)) * 0.3
                 + gnoise(dir * 4.7 + vec3(63.1)) * 0.2) + 0.5;

  // A: how busy this region is. Uniform detail everywhere is the other half of
  // why noise reads as wallpaper — real surfaces have calm stretches and
  // violent ones. This drives crest strength per region.
  float activity = gnoise(dir * 0.9 + vec3(77.3)) * 0.7 + 0.5;

  gl_FragColor = clamp(vec4(height, cloud, variety, activity), 0.0, 1.0);
}
`;

// ── Per-frame: everything with an edge in it ─────────────────────────────────
export const PLANET_MAIN_FRAG = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2  u_res;
uniform float u_time;
uniform samplerCube u_map;
uniform sampler2D u_tex;
uniform float u_hasTex;
uniform float u_texScale;
uniform float u_emissive;
uniform float u_emissiveThresh;

// Explicit-gradient sampling where the driver offers it. Without the extension
// the stochastic offsets confuse mip selection and stitch dotted lines along
// every cell join; the fallback drops to plain sampling, which is softer under
// minification but never speckles.
#ifdef TEX_GRAD
  #define TEX_SAMPLE(uv, dx, dy) texture2DGradEXT(u_tex, uv, dx, dy)
#else
  #define TEX_SAMPLE(uv, dx, dy) texture2D(u_tex, uv)
#endif

uniform vec3  u_oceanDeep;
uniform vec3  u_oceanShelf;
uniform vec3  u_landLow;
uniform vec3  u_landMid;
uniform vec3  u_landHigh;
uniform vec3  u_vein;
uniform vec3  u_ice;
uniform vec3  u_filament;
uniform vec3  u_cloudColor;
uniform vec3  u_atmo;
uniform vec3  u_atmoCool;
uniform float u_seaLevel;
uniform float u_iceExtent;
uniform float u_detailScale;
uniform float u_bandStretch;
uniform float u_flowStrength;
uniform float u_shear;
uniform float u_ridgeMix;
uniform float u_filamentGain;
uniform float u_veinGain;
uniform float u_cloudCoverage;
uniform float u_cloudOpacity;
uniform float u_cloudSoft;
uniform float u_cloudUnderlit;
uniform float u_atmoGain;
uniform float u_spinPeriod;
uniform float u_tilt;
uniform float u_cloudSpin;

// ── The star ──
// A yellow dwarf and a pulsar are the same object here with different numbers:
// disc colour, halo colour, jet strength and pulse rate. Its light also reaches
// the planet, so the tint and terminator colour travel with it — a blue-white
// star warming a terminator to orange is the kind of detail that quietly reads
// as wrong.
uniform vec3  u_starCore;
uniform vec3  u_starSpot;
uniform vec3  u_starGlow;
uniform float u_starRadius;
uniform float u_starGrain;
uniform float u_jetStrength;
uniform float u_flareStrength;
uniform float u_jetTilt;
uniform float u_pulseRate;
uniform float u_pulseDepth;
uniform float u_nebula;
uniform vec3  u_lightTint;
uniform vec3  u_terminator;

// ── Black hole ──
// When on, the star is replaced by an accretion disc around an event horizon.
// starRadius becomes the horizon radius and jetTilt the disc's lean.
uniform float u_blackHole;
uniform float u_discOuter;
uniform float u_discIncline;
uniform float u_discInner;
uniform float u_discGain;
uniform float u_ribFreq;
uniform float u_ribDepth;
uniform vec3  u_discBright;
uniform vec3  u_discDim;

// ── Magnetic sandstorms ──
uniform vec3  u_stormColor;
uniform float u_stormCoverage;
uniform float u_stormSystemScale;
uniform float u_stormScale;
uniform float u_stormShadow;
uniform float u_stormHeight;
uniform float u_stormSpin;
uniform float u_stormOpacity;
uniform vec3  u_boltColor;
uniform float u_boltRate;
uniform float u_boltChance;
uniform float u_boltDensity;

// ── Impact craters ──
uniform float u_craterDensity;
uniform float u_craterChance;

${COMPOSITION}
${SURFACE}

// Ridged multifractal: fold the noise about zero and square it, so smooth humps
// become creases. This is the sharp filament structure in the reference art —
// plain fbm cannot produce it at any octave count, because it has no crests.
//
// Gain 0.60 rather than the usual 0.50. At 0.50 each octave is half the last,
// so the sixth one — the one at pixel scale — contributes 1/32 of the signal
// and is mathematically present but invisible. That 1/f falloff is why the
// earlier versions looked airbrushed no matter how many octaves I added. The
// reference has near-equal energy at fine scales because it is an image, not a
// spectrum; 0.60 is as far toward flat as this can go before it turns to sand.
float ridged(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  float w = 1.0;
  for (int i = 0; i < 6; i++) {
    float n = 1.0 - abs(gnoise(p) * 2.0);
    n = n * n * w;
    w = clamp(n * 1.7, 0.0, 1.0);
    s += a * n;
    p = p * 2.07 + vec3(0.19, 0.41, 0.11);
    a *= 0.60;
  }
  return s;
}

// Turbulence: sum |noise| instead of noise. Folding at zero gives a curdled,
// billowy field — the spongy granular texture through the middle of the
// reference, which ridged noise cannot make and plain fbm is far too smooth
// for. Its other half is free: where the underlying noise crosses zero the sum
// dips to near nothing, so the valleys of this field are naturally thin
// branching lines. That is where the rust veins come from.
float turbulence(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    s += a * abs(gnoise(p) * 2.0);
    p = p * 2.05 + vec3(0.13, 0.29, 0.37);
    a *= 0.58;
  }
  return s;
}

// Stochastic tiling. Regular tiling of a non-seamless image forces a choice
// between two artefacts: mirrored repeat butterflies the art about every tile
// edge, and plain repeat leaves hard seam lines. Both are periodic, and the eye
// finds periodic structure immediately.
//
// So the grid gets randomised instead. Each cell samples the texture at its own
// random offset, and cells cross-fade into each other, which breaks the period
// entirely — no reflections, no repeating landmarks, and opposite sides of the
// planet draw from different parts of the image rather than duplicating.
//
// The fade weights are sharpened deliberately. A plain bilinear blend of four
// offset copies averages them everywhere and washes the contrast out; pushing
// the transition into a narrow band means most of the surface shows one sample
// at full strength, and only the joins are mixed. The texture's own edge still
// crosses each cell somewhere, but at any point three of the four samples are
// clear of it, so what survives is a faint ghost rather than a line.
//
// One catch comes with the randomisation: the offset jumps at every cell join,
// so the coordinate handed to the sampler is discontinuous there. Mip level is
// chosen from that coordinate's screen-space derivative, which at the jump is
// enormous — those pixels select the smallest mip, an average of the entire
// image, and appear as dark dots stitching along the cell boundary. Hence the
// explicit gradients below, taken from the continuous coordinate before the
// offset is added, so filtering behaves as though nothing was displaced.
vec3 stochasticSample(vec2 uv) {
#ifdef TEX_GRAD
  vec2 dx = dFdx(uv);
  vec2 dy = dFdy(uv);
#else
  vec2 dx = vec2(0.0);
  vec2 dy = vec2(0.0);
#endif
  vec2 cell = floor(uv);
  vec2 f = fract(uv);
  vec2 w = smoothstep(vec2(0.30), vec2(0.70), f);

  vec3 c = vec3(0.0);
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      float wx = (i == 0) ? (1.0 - w.x) : w.x;
      float wy = (j == 0) ? (1.0 - w.y) : w.y;
      float weight = wx * wy;
#ifdef TEX_GRAD
      // smoothstep returns *exactly* 0.0 below its lower edge, so outside the
      // 0.30-0.70 blend band one of the two weights is bit-exactly zero and that
      // corner contributes nothing. Roughly two of the four fetches are pure
      // waste, and at 8x anisotropy each is up to eight taps — this is the
      // largest single cost on the textured presets.
      //
      // Only safe under TEX_GRAD. The fallback below uses implicit derivatives,
      // and sampling those inside non-uniform control flow is undefined in
      // ES 2.0, so that path keeps fetching unconditionally.
      if (weight <= 0.0) continue;
#endif
      vec2 id = cell + vec2(float(i), float(j));
      vec2 off = vec2(hash12(id * 1.7 + 3.1), hash12(id * 2.3 + 11.9));
      c += TEX_SAMPLE(uv + off, dx, dy).rgb * weight;
    }
  }
  return c;
}

// Triplanar projection: sample down each of the three axes and blend by how
// much the surface faces that axis. On a sphere this is the whole trick — no UV
// layout to author, no pole where texels bunch and smear, and no seam anywhere,
// which is the set of problems an equirectangular map would have handed us.
// Sharpened blend weights keep the overlap zones narrow so the three samples
// don't average into mush along the diagonals.
vec3 triplanar(vec3 p, vec3 n, float scale) {
  vec3 bw = abs(n);
  bw = bw * bw;
  bw = bw * bw;
  bw /= (bw.x + bw.y + bw.z);
  vec3 c = vec3(0.0);
  if (bw.x > 0.001) c += stochasticSample(p.zy * scale) * bw.x;
  if (bw.y > 0.001) c += stochasticSample(p.xz * scale) * bw.y;
  if (bw.z > 0.001) c += stochasticSample(p.xy * scale) * bw.z;
  return c;
}

float fbm3m(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * gnoise(p);
    p = p * 2.11 + vec3(0.27, 0.13, 0.41);
    a *= 0.55;
  }
  return s;
}

float fbm4m(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * gnoise(p);
    p = p * 2.11 + vec3(0.27, 0.13, 0.41);
    a *= 0.58;
  }
  return s;
}

// Craters, scattered on a jittered lattice. Procedural rather than painted,
// because the surface texture is tiled: a crater drawn into it recurs once per
// cell and stops being rare. Here rarity is just a number.
void craters(vec3 dir, inout vec3 surface) {
  vec3 cp = dir * u_craterDensity;
  vec3 id = floor(cp);
  vec3 f = fract(cp) - 0.5;
  float h = hash13(id);
  // Both terms below are multiplied by this, and mix(x, y, 0.0) is exactly x —
  // so on the 97% of cells with no crater the three hashes, a length, a divide,
  // an exp and a pow were all computed for nothing. Cells are ~100px.
  if (h > u_craterChance) return;
  vec3 jitter = (vec3(hash13(id + 1.3), hash13(id + 3.7), hash13(id + 7.1)) - 0.5) * 0.55;
  float d = length(f - jitter) / (0.10 + 0.16 * hash13(id + 11.0));
  // Dark bowl, bright ejecta rim just outside it.
  float bowl = 1.0 - smoothstep(0.55, 1.0, d);
  // x*x, not pow(x, 2.0): the base is negative across the whole bowl, and pow
  // with a negative base is undefined in GLSL — drivers lowering it to
  // exp2(y*log2(x)) produce NaN there.
  float rimD = (d - 1.05) * 3.2;
  float rim = exp(-rimD * rimD);
  surface = mix(surface, surface * 0.52, bowl * 0.85);
  surface += vec3(0.18, 0.17, 0.16) * rim;
}

// Storm density from an already-flow-warped point. A low-frequency field decides
// where whole systems sit; a higher-frequency one gives the dust its internal
// structure. Both creep with time, so a storm evolves rather than merely
// orbiting.
//
// The thresholds below are measured, not guessed. Sampled over the sphere, the
// system field runs 0.36 to 0.68 with a mean of 0.507 and sigma near 0.05 — much
// tighter than it looks, which makes the coverage threshold extremely sensitive:
// 0.34 puts every pixel of the planet under dust, 0.55 leaves 18%, and 0.60
// leaves 3.6%. A window wider than about 0.03 is also a trap, since it can reach
// past the field's own maximum and then the mask never gets to 1 anywhere — the
// storms stop being sparse and start being incapable of full density.
//
// The body field modulates rather than multiplies. Multiplying let it punch
// holes through a system and erase it; now it varies density inside a storm
// while the system field alone decides where storms are.
float stormFromFlow(vec3 sq, float t) {
  float systems = fbm3m(sq * u_stormSystemScale + vec3(0.0, 0.0, t * 0.010)) * 0.5 + 0.5;
  // The patch mask is exactly zero below the coverage threshold and the return
  // is patch * (...), so on the ~80% of the sphere with no storm the four
  // octaves below were computed and thrown away — twice per pixel, since the
  // shadow samples this too.
  float patchEarly = smoothstep(u_stormCoverage, u_stormCoverage + 0.022, systems);
  if (patchEarly <= 0.0) return 0.0;
  float body = fbm4m(sq * u_stormScale + vec3(t * 0.030)) * 0.5 + 0.5;
  float inner = smoothstep(0.44, 0.60, body);
  return patchEarly * (0.62 + 0.38 * inner);
}

vec3 starLayer(vec2 p, float scale, float seed) {
  vec2 g = p * scale;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash12(id + seed);
  // Most cells hold no star, and the result was multiplied by that flag, so the
  // four remaining hashes, a sin, a length and a smoothstep were all being
  // computed for an exact zero. Cells are ~40px, so the branch is coherent.
  if (h < 0.930) return vec3(0.0);
  vec2 off = (vec2(hash12(id + seed + 1.7), hash12(id + seed + 5.3)) - 0.5) * 0.7;
  float core = 1.0 - smoothstep(0.0, 0.085, length(f - off));
  float twinkle = 0.65 + 0.35 * sin(u_time * 0.7 + h * 63.0);
  float b = core * twinkle * (0.35 + 0.65 * hash12(id + seed + 9.1));
  vec3 tint = mix(vec3(0.75, 0.83, 1.0), vec3(1.0, 0.87, 0.72), hash12(id + seed + 3.3));
  return tint * b;
}

void main() {
  vec2 uv = (2.0 * gl_FragCoord.xy - u_res) / u_res.y;
  float aspect = u_res.x / u_res.y;
  float px = 2.0 / u_res.y;

  vec2 sunP    = vec2(SUN_CX_A * aspect, SUN_CY);
  vec2 planetP = vec2(PLANET_CX_A * aspect, PLANET_CY);

  vec2  pd   = uv - planetP;
  float pr   = length(pd) / PLANET_R;
  float edge = px / PLANET_R;

  // Sky, stars, nebula and the star itself are skipped wherever the planet
  // covers them completely. The composite below is mix(col, lit, mask), and
  // mask is *exactly* 1.0 for pr <= 1 - edge, so everything computed here would
  // be multiplied by zero — about a third of the frame, and eleven of the
  // roughly forty-four noise evaluations a planet pixel costs. One contiguous
  // screen region, so the branch is fully coherent.
  bool skyVisible = pr > 1.0 - edge;

  vec3 col = vec3(0.0);
  if (skyVisible) {
  col = mix(SKY_BOT, SKY_TOP, clamp(0.5 + 0.5 * uv.y, 0.0, 1.0));

  col += starLayer(uv, 26.0, 0.0);
  col += starLayer(uv * 1.9 + vec2(u_time * 0.0035, 0.0), 41.0, 7.3) * 0.55;

  // ── Star ──
  float sd = length(uv - sunP);

  // Pulse: a slow smooth swell, deliberately not the sharp repeated flash a
  // real pulsar would give. At a couple of beats a second that lands in the
  // range that provokes photosensitive reactions, and it sits behind a login
  // form nobody chose to stare at. A long cosine breath reads as a living star
  // without ever strobing. Applied to disc, halo and jets together so the whole
  // object swells as one.
  float breath = 0.5 - 0.5 * cos(6.28318530718 * u_time * u_pulseRate);
  float pulse = 1.0 + u_pulseDepth * breath * step(0.0001, u_pulseRate);

  float R = u_starRadius;
  // Two radii, and they are not interchangeable. rn is the true distance in
  // star radii and keeps growing across the sky; rr is clamped so the
  // hemisphere reconstruction below never takes the square root of a negative.
  // Anything that has to fall off with distance must use rn — a clamped radius
  // reads 1.0 everywhere outside the disc, so a shell peaking near 1.0 lights
  // up the entire frame.
  float rn = sd / max(R, 1e-5);
  float rr = min(rn, 1.0);

  // Faint nebulosity, lit by the star and thinning with distance from it.
  if (u_nebula > 0.0) {
    // Two multiplied fields at different scales, the finer one giving the wisps
    // their edges. A single low-frequency field just reads as a vignette.
    float neb = fbm3m(vec3(uv * 2.6, 17.3)) * 0.5 + 0.5;
    neb *= fbm4m(vec3(uv * 6.5, 41.9)) * 0.5 + 0.5;
    neb = pow(neb, 1.6) * 2.0;
    col += u_starGlow * neb * exp(-sd * 0.55) * u_nebula;
  }

// Compiled only for presets that actually have a black hole.
//
// The march below is a 190-iteration loop, and the driver translates it whether
// or not the preset ever enters the branch: u_blackHole is a uniform, so the
// compiler cannot fold the branch away. ANGLE hands it to D3D's compiler, which
// unrolls constant-bounded loops — so this one block is believed to dominate
// the cold-compile time of a ~49KB shader, and three worlds out of four were
// paying it without ever running a step of the loop.
//
// That compile is what froze the browser on first load: it happens in the GPU
// process, which every tab shares. See PlanetBackground for the other half of
// the fix, which stops it blocking at all.
//
// BLACK_HOLE is defined in PlanetBackground from the preset's blackHole field.
//
// With the define absent this collapses to a bare block around the star path,
// which is why the else is split across the #endif below rather than the whole
// if/else being duplicated.
#ifdef BLACK_HOLE
  if (u_blackHole > 0.5) {
    // ── Event horizon and accretion disc, by actually bending the light ──
    //
    // Six rounds of layering ellipses got the disc, the thickness and the
    // beaming roughly right and never produced the one feature that identifies
    // the reference: the thin bright line that traces the top of the horizon
    // and hooks down and inward at the side. That hook is the disc's second
    // image, light that has gone most of the way round the photon sphere before
    // reaching us. No arrangement of stacked ellipses contains it, because it
    // is not a shape — it is what happens when the path curves.
    //
    // So this integrates the trajectory instead. Each ray is marched under the
    // Schwarzschild deflection term and tested against the disc plane on every
    // step, accumulating whatever it crosses. Everything that was being drawn by
    // hand then falls out on its own: the far side lifted over the top, the near
    // side laid in front, the second image and its hook, the photon ring, the
    // Einstein-ring pinch at the sides, and correct occlusion by the horizon.
    //
    // Units are Schwarzschild radii: the horizon sits at r = 1, and the capture
    // impact parameter is 3*sqrt(3)/2 = 2.598, which is what the shadow's
    // apparent radius corresponds to. starRadius sets that apparent radius on
    // screen, and the scale below is derived from it.
    float bc = cos(u_jetTilt);
    float bs = sin(u_jetTilt);
    vec2 d0 = uv - sunP;
    vec2 pp = vec2(d0.x * bc + d0.y * bs, -d0.x * bs + d0.y * bc);

    // Only pixels near the hole pay for the march.
    if (length(pp) < R * 8.0) {
      // Camera distance, in Schwarzschild radii. It must sit well clear of the
      // disc's outer edge. At 16 against an outer radius of 15 the near rim of
      // the disc was 2.4 units from the camera and projected across half the
      // screen as an enormous lens — while also crossing in front of the
      // horizon and cutting the silhouette into a wedge. Keep this at least
      // three times discOuter.
      const float DIST = 48.0;
      const float B_CRIT = 2.598;   // capture impact parameter
      float scale = B_CRIT / (DIST * R);

      // Camera basis, inclined a few degrees off the disc plane so we look at it
      // almost but not quite edge-on — that small angle is what opens the near
      // side into a visible band instead of a line.
      float ci = cos(u_discIncline);
      float si = sin(u_discIncline);
      vec3 ro = vec3(0.0, DIST * si, -DIST * ci);
      vec3 fwd = normalize(-ro);
      vec3 rgt = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
      vec3 upv = cross(fwd, rgt);

      // The march is restricted to rays that can actually reach the disc, which
      // is a much smaller region than the guard above. The rim mask is exactly
      // zero for rd >= discOuter, and at a plane crossing rd equals the radius,
      // never below perihelion — so the largest impact parameter that can reach
      // the disc is discOuter / sqrt(1 - 1/discOuter). Since b = |pp| * B_CRIT/R
      // exactly, that converts straight to a screen radius. The outer guard has
      // to stay wide for the shadow and the bloom, which are still clearly
      // visible out there; this one just avoids marching where nothing is hit.
      float bMax = u_discOuter / sqrt(max(1.0 - 1.0 / u_discOuter, 0.1));
      float marchR = R * 1.05 * bMax / B_CRIT;

      vec3 pos = ro;
      vec3 vel = normalize(fwd + rgt * (pp.x * scale) + upv * (pp.y * scale));

      // Dither the starting point along the ray. Neighbouring pixels otherwise
      // march in lockstep, so wherever a crossing lands near a step boundary a
      // whole run of pixels gains or loses it together — which is the dashed
      // ring around the silhouette. Offsetting each ray by a fixed hashed
      // fraction decorrelates them and turns that into fine static grain.
      // Deliberately not animated: a time-varying offset would shimmer.
      pos += vel * hash12(gl_FragCoord.xy) * 2.5;

      // Angular momentum is conserved along the path, so the deflection term
      // only needs computing once.
      vec3 hv = cross(pos, vel);
      float h2 = dot(hv, hv);

      vec3 acc0 = vec3(0.0);

      // Whether a ray falls in depends only on its impact parameter, and that is
      // known before marching: b = |r x v| for a unit v, captured below
      // 3*sqrt(3)/2. Deciding it here rather than by testing r < 1 on every step
      // gives an exactly round, properly anti-aliased silhouette — a per-step
      // test quantises the edge to the stride and leaves it visibly stepped.
      float b = sqrt(h2);
      float bPix = DIST * scale * px * 1.5;   // ~1.5 pixels of edge softening
      float shadow = 1.0 - smoothstep(B_CRIT - bPix, B_CRIT + bPix, b);

      bool marching = length(pp) < marchR;
      for (int i = 0; i < 190; i++) {
        if (!marching) break;
        float r2 = dot(pos, pos);
        float r = sqrt(r2);
        if (r < 1.02) break;   // stop marching; the silhouette is analytic
        if (r > DIST * 2.2) break;
        // Past perihelion r rises monotonically, and every later plane crossing
        // is outside the disc, so rim is zero from here on. Nothing after the
        // loop reads pos or vel. A wide ray ran ~36 steps to reach the escape
        // test above; this ends it at ~12.
        if (r > u_discOuter + 1.0 && dot(pos, vel) > 0.0) break;

        // Longer strides far away, short ones near the hole where the path
        // actually curves.
        // Finer than feels necessary. Coarse strides near the hole both miss
        // the tight windings that make the photon ring and leave the horizon's
        // edge visibly stepped, since capture is tested once per step.
        float dt = min(r * 0.085, 4.0);   // lower bound unreachable past the r < 1.02 break
        vec3 grav = -1.5 * h2 * pos / (r2 * r2 * r);
        vec3 nvel = vel + grav * dt;
        vec3 npos = pos + nvel * dt;

        // Disc plane crossing.
        if (pos.y * npos.y < 0.0) {
          float t = pos.y / (pos.y - npos.y);
          vec3 hit = mix(pos, npos, t);
          float rd = length(hit.xz);
          // Soft rims. A hard inner/outer radius test leaves both edges
          // of the disc unaliased, and with one ray per pixel that shows as a
          // staircase everywhere the disc ends — including where the bright arc
          // meets the silhouette. The horizon's own edge is analytic and smooth,
          // which is why the stepping survived being fixed there.
          float rim = smoothstep(u_discInner, u_discInner * 1.18, rd)
                    * (1.0 - smoothstep(u_discOuter * 0.72, u_discOuter, rd));
          if (rim > 0.002) {
            float rho = rd;
            // (hit.x, hit.z)/rho is already the unit vector atan+cos+sin would
            // reconstruct, so this is a plain 2D rotation of it — one
            // transcendental pair instead of an atan2 and a pair. And
            // rho*sqrt(rho) rather than pow(rho, 1.5).
            float ang = u_time * 1.7 / (rho * sqrt(rho));
            vec2 base = vec2(hit.x, hit.z) / rho;
            float ca = cos(ang);
            float sa = sin(ang);
            vec2 dir2 = vec2(base.x * ca - base.y * sa, base.x * sa + base.y * ca);

            // Concentric ribs at constant orbital radius, plus turbulence.
            float ribs = 1.0 - u_ribDepth * (0.5 + 0.5 * sin(rho * u_ribFreq
                          + gnoise(vec3(dir2 * 1.6, rho * 0.4)) * 1.8));
            float t1 = gnoise(vec3(dir2 * 2.1, rho * 0.9)) * 0.5 + 0.5;
            float t2 = gnoise(vec3(dir2 * 5.2, rho * 2.4 + 7.7)) * 0.5 + 0.5;
            float grain = (0.48 + 0.38 * t1 + 0.24 * t2) * ribs;

            // Emission falls off outward; inner orbits are far brighter.
            // Shallower than inverse-square so the outer disc still registers;
            // at 2.1 everything past a few radii fell to nothing.
            float emis = pow(u_discInner / rho, 1.55);

            // Relativistic beaming, from the orbital velocity at the hit point
            // against the ray. This is what makes one side blaze and the other
            // sink, without it being painted in.
            // cross((0,1,0), hit) is (hit.z, 0, -hit.x), whose length is rho.
            vec3 tang = vec3(hit.z, 0.0, -hit.x) / rho;
            float vmag = sqrt(0.5 / rho);
            float beta = dot(tang * vmag, normalize(nvel));
            float boost = pow(clamp(1.0 + beta, 0.05, 2.2), 3.2);

            // Gravitational redshift: light climbing out of the well loses energy.
            float redshift = sqrt(max(1.0 - 1.0 / rho, 0.02));

            // The colours are hues to be driven hard, not final pixel values.
            // Sampling the reference gave rgb(102,119,150) for the bright side —
            // but that is a tonemapped average, and using it as emission is why
            // an earlier pass came out flat grey. The white-hot core is a
            // saturated blue pushed past 1.0 and rolled off by the exposure
            // curve, exactly as the pulsar's shell was.
            vec3 tint = mix(u_discDim, u_discBright, clamp(1.35 - rho * 0.10, 0.0, 1.0));
            // Fade contributions as the step budget runs out.
            //
            // A ray grazing the photon sphere spends about twenty steps getting
            // in, then winds at roughly a quarter of a unit per step — so it
            // reaches the loop limit mid-orbit. Whether its last crossing falls
            // inside the budget or just past it is decided by where its dithered
            // steps happen to land, and that is a whole crossing of light
            // differing between neighbouring pixels: the dotted hairline.
            //
            // Cutting the ray off at a hard step count makes that difference
            // binary. Ramping the last quarter of the budget down to zero makes
            // it continuous, so a crossing at step 150 and one at step 190
            // contribute nearly the same tiny amount and neither creates an
            // edge. Unlike damping by crossing index, this leaves the early
            // crossings — and therefore the ring's brightness — untouched.
            float budget = 1.0 - smoothstep(0.72, 1.0, float(i) / 190.0);
            acc0 += min(tint * emis * grain * boost * redshift * u_discGain, vec3(7.0)) * rim * budget;
          }
        }

        pos = npos;
        vel = nvel;
      }

      // The horizon is not drawn — it is simply where no light comes from. It
      // is applied before the accumulated emission so that material the ray
      // crossed in FRONT of the hole still draws over it.
      col = mix(col, vec3(0.0), shadow);
      // A ceiling on the whole ray, not just per crossing: without it a single
      // ray that threads the photon sphere just right still spikes.
      col += min(acc0, vec3(9.0)) * pulse;

      // Bloom. Light this bright scatters in any real optic, and without it the
      // disc reads as a flat decal however hot the core is. Weighted toward the
      // beamed side so the glow is lopsided the way the disc itself is.
      // Masked by the silhouette. Unmasked, halo evaluates to 1 inside the
      // horizon and washes the whole shadow with a gradient — a real optic would
      // spill a little there, but the hole has to read as absolute black.
      float side = 0.45 + 0.75 * smoothstep(-1.0, 1.0, pp.x / max(length(pp), 1e-5));
      float halo = exp(-max(length(pp) - R, 0.0) / (R * 2.0)) * (1.0 - shadow);
      col += u_discBright * halo * side * 0.22 * pulse;
    }
  } else
#endif
  {
    // Body. Treated as a sphere rather than a flat circle: spots are sampled on
    // the hemisphere standing over the disc, so they crowd toward the edge the
    // way markings on a real surface do instead of staying evenly sized to the rim.
    // bodyMask below is exactly zero beyond rn = 1.06, and the disc is 0.45% of
    // the frame — so the two noise calls here were running on essentially every
    // screen pixel only to be multiplied away.
    vec3 bodyCol = vec3(0.0);
    if (rn < 1.06) {
      float zz = sqrt(max(0.0, 1.0 - rr * rr));
      vec3 sn = vec3((uv - sunP) / max(R, 1e-5), zz);
      float s1 = gnoise(sn * 15.0 + vec3(0.0, 0.0, u_time * 0.04)) * 0.5 + 0.5;
      float s2 = gnoise(sn * 33.0 + vec3(u_time * 0.09)) * 0.5 + 0.5;
      // Pushed hard through a contrast curve. Plain noise averages to a smooth
      // grey and the speckle disappears at any distance; this keeps it reading
      // as discrete cells.
      float spots = clamp((s1 * 0.55 + s2 * 0.45 - 0.36) * 3.4, 0.0, 1.0);
      bodyCol = mix(u_starSpot, u_starCore, mix(1.0, spots, u_starGrain));
    }

    // No hard rim. The body fades out well before its nominal radius and a
    // white-hot shell takes over across the edge, so the disc dissolves into its
    // own glow. A crisp circle is the single thing that made it read as a flat
    // cut-out rather than a star.
    // The body has to reach almost to the rim. Fading it out early leaves the
    // white shell covering most of the object, and the speckle — the whole point
    // of the surface — ends up a small patch in the middle of a glare.
    float bodyMask = 1.0 - smoothstep(0.80, 1.06, rn);
    // Narrow, and centred outside the body rather than over it. At sigma 0.34 it
    // spanned half a radius to one and a third and swallowed the core.
    float shellD = (rn - 1.02) / 0.20;
  float shell = exp(-shellD * shellD);

    // The halo terms clamp their exponent at the rim, so both sit at full
    // strength across the whole disc — flooding the body with flat light and
    // lifting the speckle's darks until the texture disappears. Fading them in
    // from inside the body keeps the glow outside where it belongs and lets the
    // core stay dark enough to read.
    float haloIn = smoothstep(0.30, 0.95, rn);
    float corona = exp(-max(sd - R, 0.0) / (0.055 * pulse)) * haloIn;
    // Tighter than it was: a wide bloom turns the whole quarter of the sky into a
    // grey wash and takes the blue out of everything.
    float bloom  = exp(-max(sd - R, 0.0) / (0.26 * pulse)) * haloIn;

    // Polar jets. Narrow beams on one axis, flaring into a funnel where they
    // leave the star and reaching most of the way across the frame. The sign of
    // the tilt decides which way the top of the axis leans — negative leans right.
    float jets = 0.0;
    float flare = 0.0;
    if (u_jetStrength > 0.0) {
      float jc = cos(u_jetTilt);
      float js = sin(u_jetTilt);
      vec2 d = uv - sunP;
      vec2 j = vec2(d.x * jc + d.y * js, -d.x * js + d.y * jc);
      float along = abs(j.y);
      float across = abs(j.x);
      float w = 0.017 + 0.065 * exp(-along * 8.0) + 0.014 * exp(-along * 1.2);
      float ragged = 1.0 + 0.30 * gnoise(vec3(j * 22.0, u_time * 0.5));
      jets = exp(-(across * across) / (w * w * ragged)) * exp(-along * 0.62);
      jets *= u_jetStrength * pulse;

      // Equatorial plumes: feathery fog combed straight out from the star, at
      // right angles to the jets. Material thrown off the equator rather than the
      // poles, and the thing that gives the object a waist.
      float rad = length(j);
      float t = max(rad - R * 0.85, 0.0);
      float band = exp(-pow(along / (0.030 + 0.42 * t), 2.0));
      float comb = 0.30 + 0.70 * (gnoise(vec3(atan(j.y, j.x) * 8.0, t * 9.0, u_time * 0.05)) * 0.5 + 0.5);
      flare = band * comb * exp(-t / 0.22) * u_flareStrength * pulse;
    }

    col = mix(col, bodyCol * pulse, bodyMask);
    // White at the shell, the star's own colour further out: the reference runs
    // white-hot at the edge and only turns blue in the outer bloom.
    col += vec3(1.0) * shell * 0.80 * pulse;
    col += u_starGlow * (corona * 0.45 + bloom * 0.20) * pulse;
    col += mix(u_starGlow, vec3(1.0), 0.45) * (jets + flare);
  }
  }

  vec3  Ldir = normalize(vec3(sunP - planetP, SUN_DEPTH));

  if (pr < 1.0 + edge * 2.0) {
    float rr = min(pr, 1.0);
    vec3 n = vec3(pd / PLANET_R, sqrt(max(0.0, 1.0 - rr * rr)));

    float spin = u_time * (6.28318530718 / u_spinPeriod);
    vec3 tilted = rotZ(n, -u_tilt);
    vec3 sDir = rotY(tilted, -spin);
    vec3 cDir = rotY(tilted, -spin * u_cloudSpin);

    vec4 baked = textureCube(u_map, sDir);
    float height = baked.r;
    float variety = baked.b;
    float activity = baked.a;

    float limbFade = smoothstep(0.0, 0.30, n.z);
    vec3 surface;
    vec3 emissive = vec3(0.0);
    // The cloud edge is broken up by whichever surface field is in play; the
    // texture path has no turbulence field, so it keeps the neutral value.
    float turbN = 0.5;

    if (u_hasTex > 0.5) {
      // A gentle low-frequency displacement before sampling. Enough to stop the
      // tile period from reading as a grid, small enough that it doesn't smear
      // the artwork — the texture's own marbling is the thing worth looking at,
      // so this stays a nudge rather than the warp the procedural path needs.
      vec3 tp = sDir + 0.06 * vec3(gnoise(sDir * 1.3 + vec3(3.1)),
                                   gnoise(sDir * 1.3 + vec3(9.7)),
                                   gnoise(sDir * 1.3 + vec3(17.3)));
      surface = triplanar(tp, sDir, u_texScale);
      // Regional brightness drift, so two visits to the same tile don't look
      // like the same place.
      surface *= 0.82 + 0.36 * activity;

      // Self-luminous material. Some worlds are not rock catching a star's
      // light — the bright parts of the map are bright because they are
      // emitting, and multiplying those by a diffuse term turns a glowing
      // plasma into a lit rock no matter how good the art is.
      //
      // Which parts count is decided by brightness weighted by saturation, so a
      // blazing cyan channel qualifies and a pale wash does not. The result is
      // added after the lighting rather than before it, so it survives the
      // terminator and carries round onto the night side, while the dark veins
      // between still shade normally.
      if (u_emissive > 0.0) {
        float lum = dot(surface, vec3(0.299, 0.587, 0.114));
        float hi = max(surface.r, max(surface.g, surface.b));
        float lo = min(surface.r, min(surface.g, surface.b));
        float sat = hi - lo;
        float glow = smoothstep(u_emissiveThresh, u_emissiveThresh + 0.28, lum * (0.55 + 0.85 * sat));
        emissive = surface * glow * u_emissive;
      }
    } else {
      vec3 q = bandSpace(flowSpace(sDir, u_shear, u_flowStrength) * u_detailScale, u_bandStretch);

      // Both fractals get mapped onto a known 0–1 range before anything is done
      // with them. Skipping this is what silently switched off the veins and the
      // foam: raising a field that averages 0.17 to the ninth power gives about
      // a millionth, so the layer existed and drew nothing. Exponents are only
      // meaningful against a normalised input.
      float ridN = smoothstep(0.05, 0.35, ridged(q));
      turbN = smoothstep(0.25, 1.05, turbulence(q * 1.35));

      float surfH = mix(height, height * 0.55 + ridN * 0.60, u_ridgeMix * limbFade);
      float land = smoothstep(u_seaLevel - 0.020, u_seaLevel + 0.020, surfH);

      vec3 water = mix(u_oceanDeep, u_oceanShelf, smoothstep(u_seaLevel - 0.16, u_seaLevel, surfH));
      vec3 ground = mix(u_landLow, u_landMid, smoothstep(0.45, 0.58, turbN));
      float veg = smoothstep(0.50, 0.60, variety) * smoothstep(0.42, 0.55, turbN);
      ground = mix(ground, u_landHigh, veg);

      surface = mix(water, ground, land);
      surface += u_filament * pow(ridN, 2.2) * (0.35 + 1.30 * activity) * u_filamentGain * limbFade;
      surface = mix(surface, u_vein, pow(1.0 - turbN, 4.0) * u_veinGain * land * limbFade);
    }

    // Storms are resolved before the surface is lit, because the shadow has to
    // darken the ground underneath them — which means knowing the density first.
    float storm = 0.0;
    float stormBody = 0.0;
    vec3 stormDir = rotY(tilted, -spin * u_stormSpin);
    if (u_stormOpacity > 0.0) {
      vec3 sq = flowSpace(stormDir, u_shear, u_flowStrength);
      storm = stormFromFlow(sq, u_time);
      // Only feeds dustLit, which is mixed at the storm mask — zero without one.
      if (storm > 0.0) stormBody = fbm3m(sq * u_stormScale * 1.7 + vec3(u_time * 0.04)) * 0.5 + 0.5;

      // The shadow is the same dust sampled sunward — but the step has to be
      // taken *along the surface*, not straight toward the sun.
      //
      // The previous version added the light vector to the sample point in
      // three dimensions. Where the sun is low that happens to run along the
      // ground and works; where it is more overhead the same step is mostly
      // radial, pushing the sample off the sphere entirely and landing on an
      // uncorrelated part of the noise. That produced exactly the two symptoms
      // reported: storms casting nothing, and shadows with no storm above them.
      //
      // So: project the light into the tangent plane, and shift by height ×
      // tan(angle from vertical) the way a real shadow lengthens as the sun
      // drops. Overhead sun gives no shift and the shadow sits directly beneath.
      vec3 Lflow = rotY(rotZ(Ldir, -u_tilt), -spin * u_stormSpin);
      float lnd = dot(Lflow, stormDir);
      vec3 ltan = Lflow - stormDir * lnd;
      // |L - n(L.n)| == sqrt(1 - (L.n)^2) for unit L and n.
      float ltl = sqrt(max(1.0 - lnd * lnd, 0.0));
      float shift = min(u_stormHeight * ltl / max(lnd, 0.30), 0.45);
      vec3 shadowDir = normalize(stormDir + (ltan / max(ltl, 1e-5)) * shift);
      // Re-running the flow for the displaced point costs a marbling pass, but
      // approximating it inside the warped domain is what broke this before.
      float shade = stormFromFlow(flowSpace(shadowDir, u_shear, u_flowStrength), u_time);
      // No sun below the horizon means no shadow to cast.
      shade *= smoothstep(0.0, 0.18, lnd);
      surface *= 1.0 - shade * u_stormShadow;
    }

    if (u_craterChance > 0.0) craters(sDir, surface);

    float ice = smoothstep(u_iceExtent, u_iceExtent + 0.13, abs(sDir.y));
    surface = mix(surface, u_ice, ice * 0.90);

    // Only the coverage fetch is skipped when the deck is invisible. The shadow
    // fetch below is NOT skippable: it darkens the ground whatever the opacity,
    // so removing it would change how Kantar looks.
    float cd = u_cloudOpacity > 0.0 ? textureCube(u_map, cDir).g : 0.0;
    // Break the cloud edge on the same field, so the deck carries structure at
    // the frequency of the ground beneath it.
    cd += (turbN - 0.5) * 0.16 * limbFade;
    // Edge softness is per-world: banded weather wants a crisp boundary, a
    // high pink haze wants to dissolve into the air around it.
    float cover = smoothstep(u_cloudCoverage, u_cloudCoverage + u_cloudSoft, cd);
    // The shadow is the cloud field sampled a little sunward — and the offset
    // has to be taken in the space the field lives in, so the light direction
    // gets rotated into texture space rather than added to it raw.
    vec3 Ltex = rotY(rotZ(Ldir, -u_tilt), -spin * u_cloudSpin);
    float shadow = smoothstep(u_cloudCoverage, u_cloudCoverage + u_cloudSoft,
                              textureCube(u_map, cDir + Ltex * 0.035).g);   // cube lookup is scale-invariant
    surface *= 1.0 - shadow * 0.30;

    // Wrapped diffuse, so the terminator has width. A hard cosine cut-off is
    // the single biggest tell that a sphere was drawn rather than lit.
    float ndl = dot(n, Ldir);
    float lam = clamp((ndl + 0.24) / 1.24, 0.0, 1.0);
    lam = lam * lam * (3.0 - 2.0 * lam);

    float graze = exp(-abs(ndl) * 5.5);
    vec3 lit = surface * lam * u_lightTint;
    lit = mix(lit, lit * u_terminator * 1.35, graze * 0.55);
    lit += surface * 0.030 * (1.0 - lam);
    // Unlit, and deliberately so — this is the light the ground makes itself.
    lit += emissive;

    vec3 cloudLit = u_cloudColor * (lam * 0.95 + 0.06);
    cloudLit = mix(cloudLit, cloudLit * u_terminator * 1.25, graze * 0.45);
    // Underlit by the ground. On a world that makes its own light the cloud
    // deck is lit from below as well as from the star, so a bank drifting over
    // a blazing channel catches its colour — and stays visible on the night
    // side, where a purely star-lit cloud would vanish and leave the glow
    // beneath it strangely bare.
    cloudLit += emissive * u_cloudUnderlit;
    lit = mix(lit, cloudLit, cover * u_cloudOpacity);

    // ── Magnetic sandstorms ──
    // Their own rotation, faster than the ground, so they visibly drift across
    // it — that parallax between two layers is most of what stops a planet
    // reading as printed.
    if (u_stormOpacity > 0.0 && storm > 0.0) {
      float cover = storm * u_stormOpacity * limbFade;
      // Structure inside the dust, so a system reads as banked cloud rather than
      // a flat wash laid over the ground.
      vec3 dustLit = u_stormColor * (0.70 + 0.55 * stormBody) * (lam * 0.90 + 0.10);
      dustLit = mix(dustLit, dustLit * u_terminator * 1.25, graze * 0.45);
      lit = mix(lit, dustLit, cover);

      // Lightning inside the storms, on a jittered lattice.
      //
      // The falloff has to reach zero strictly inside its own cell. Flash
      // amplitude is constant per cell, so if the glow is still non-zero at a
      // cell face, a firing cell meets a dark one along a flat plane — and that
      // plane clipped by the sphere draws a hard-edged polygon. The earlier
      // exponential decayed to about a tenth at the face, which is exactly why
      // a lit triangle appeared. Radius and jitter are chosen so the two sum to
      // less than half a cell and the glow always lands inside.
      vec3 bp = stormDir * u_boltDensity;
      vec3 bid = floor(bp);
      vec3 bf = fract(bp) - 0.5;
      float bh = hash13(bid);
      float fires = step(bh, u_boltChance);

      vec3 jit = (vec3(hash13(bid + 2.1), hash13(bid + 5.3), hash13(bid + 9.7)) - 0.5) * 0.24;
      float r = length(bf - jit) / 0.33;
      // Ragged edge, so a flash reads as light through cloud rather than a ball.
      r *= 1.0 + 0.22 * gnoise(stormDir * 26.0);
      float falloff = max(0.0, 1.0 - r);

      // Short and punchy: a hard spike that decays in a fraction of a second,
      // rather than a slow pulse that reads as a glowing patch.
      float phase = fract(u_time * u_boltRate + bh * 7.13);
      float flash = exp(-phase * 16.0) * fires;

      // Two lobes — a small bright core inside a wider, dimmer bloom. A single
      // lobe bright enough to notice washes to white through the tonemap and
      // loses the colour entirely.
      float core = pow(falloff, 6.0);
      float bloom = falloff * falloff;
      lit += u_boltColor * flash * cover * (core * 2.6 + bloom * 0.9);
    }

    // Fresnel rim: the atmosphere seen edge-on, strongest where backlit, with a
    // cool trace carrying round onto the night side.
    float fres = pow(1.0 - n.z, 4.0);
    float rimLit = smoothstep(-0.45, 0.65, ndl);
    lit += u_atmo * fres * (0.30 + 1.45 * rimLit) * u_atmoGain;
    lit += u_atmoCool * fres * 0.12;
    lit += u_atmo * 0.055 * lam * (0.35 + 0.65 * pow(rr, 2.5));

    float mask = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, pr);
    col = mix(col, lit, mask);
  }

  // Gated by step(1.0, pr) below, so it is exactly zero inside the planet.
  if (pr > 1.0) {
  float outside = max((pr - 1.0) * PLANET_R, 0.0);
  float halo = exp(-outside / 0.055) * 0.55 + exp(-outside / 0.190) * 0.16;
  float haloLit = 0.5 + 0.5 * dot(normalize(pd + 1e-5), normalize(sunP - planetP));
  col += u_atmo * halo * (0.18 + 0.82 * haloLit) * u_atmoGain;
  }

  col = 1.0 - exp(-col * 1.15);

  vec2 vig = uv * vec2(0.55, 0.85);
  col *= 1.0 - 0.28 * pow(dot(vig, vig), 1.1);   // avoids a sqrt per pixel
  col += (hash12(gl_FragCoord.xy + fract(u_time) * 431.7) - 0.5) * 0.0055;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

type Vec3 = [number, number, number];

// Cube face basis vectors, from the GL cubemap face table. dir = A + B·s + C·t
// with s,t in [-1,1]. Getting these wrong doesn't error — it mismatches detail
// across face boundaries, which shows up as seams on the sphere.
export const CUBE_FACE_BASIS: ReadonlyArray<{ a: Vec3; b: Vec3; c: Vec3 }> = [
  { a: [1, 0, 0], b: [0, 0, -1], c: [0, -1, 0] },  // +X
  { a: [-1, 0, 0], b: [0, 0, 1], c: [0, -1, 0] },  // -X
  { a: [0, 1, 0], b: [1, 0, 0], c: [0, 0, 1] },    // +Y
  { a: [0, -1, 0], b: [1, 0, 0], c: [0, 0, -1] },  // -Y
  { a: [0, 0, 1], b: [1, 0, 0], c: [0, -1, 0] },   // +Z
  { a: [0, 0, -1], b: [-1, 0, 0], c: [0, -1, 0] }, // -Z
];
