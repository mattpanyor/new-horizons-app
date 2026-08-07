---
name: planet-theme
description: Add or tune a planet background theme (a preset in PLANET_PRESETS) for the login and sectors background — surface, star, weather, and the shader traps that cost real time
---

# Planet Themes

A theme is one entry in `lib/planetPresets.ts`. Everything else — the shader, the
loader, the fallbacks — already exists and does not need touching to add a world.

```
lib/planetPresets.ts          the themes; this is usually the only file you edit
lib/planetBackgroundShader.ts the GLSL, in three programs (heal, bake, main)
components/PlanetBackground.tsx  WebGL setup, texture loading, fallbacks
public/planets/<key>.jpg      surface art, filename must match the preset key
```

Use it: `<PlanetBackground preset="kantar" />`. Omit the prop for `DEFAULT_PRESET`.

## Adding a world

1. Copy an existing entry in `PLANET_PRESETS` and rename the key. Lowercase — it
   becomes a filename.
2. Generate surface art with the **planet-texture-prompt** skill and save it to
   `public/planets/<key>.jpg`.
3. Adjust palette, weather and star. Optional fields default to drawing nothing,
   so a minimal world is just the required ones.
4. A world with no art file falls back to the procedural surface automatically.
   Nothing breaks while only some worlds are painted.

## How the rendering is split

Understand this before changing the shader, because it is the opposite of the
obvious arrangement and everything else follows from it.

**By spatial frequency, not by convenience.**

- **Bake** (six cube faces, once at mount) holds only *smooth* fields: surface
  height, cloud density, slow colour variation. Nothing with an edge.
- **Main** (every frame) does everything *sharp*: ridged filaments, land/water
  thresholds, the ice line, the whole palette.

Why: a 1024 cube face puts only ~690k texels inside the visible slice of sphere
against several million screen pixels, so anything baked is magnified around 7:1.
Magnify a smooth height field and nobody can tell. Magnify a high-contrast crest
and you are looking at the texel grid. Putting the filaments in the bake — the
intuitive choice, since they are expensive — is what made an early version look
pixellated no matter how much resolution was thrown at it.

Corollary: **you cannot fix softness by adding octaves to the bake.** A 1024 face
spans 90°, capping it near 326 cycles per sphere radius, about six or seven
octaves. Past that it aliases into itself. Detail finer than that must be
evaluated per pixel.

## Traps

Each of these cost a debugging round. They are not obvious from reading the code.

**Feature density is not what it looks like.** The camera is close: the visible
slice is about 0.6 of a sphere radius tall. At `detailScale: 2.6` barely one and
a half cycles of the base frequency land on screen and the whole view is two or
three blobs. Around 7–9 puts roughly a dozen major features in frame. Compute it
rather than eyeballing: `cycles_on_screen = detailScale × screen_height / (R_uv ×
screen_height / 2)`.

**Normalise a field before applying an exponent.** `pow(1.0 - turb, 9.0)` on a
field averaging 0.17 gives about a millionth — the layer exists and draws
nothing. Map fields through `smoothstep` to a known 0–1 range first. Two separate
features were silently switched off this way.

**Measure a field's distribution before setting a threshold on it.** The storm
system field runs 0.36 to 0.68 with sigma near 0.05 — far tighter than it looks,
so coverage thresholds are extremely sensitive: 0.34 covers the entire planet,
0.55 leaves 18%, 0.60 leaves 3.6%. Worse, a smoothstep *window* wider than the
distance from the threshold to the field's maximum means the mask never reaches
1 anywhere. Sample the field in a scratch script and print percentiles.

**fbm has 1/f falloff, so fine octaves are invisible.** At gain 0.5 the sixth
octave contributes 1/32 and is mathematically present but not visible — the
surface looks airbrushed however many octaves you add. Gain around 0.6 is as flat
as it goes before it turns to sand. Reference *images* have near-equal energy at
fine scales because they are images, not spectra.

**Wide smoothsteps cannot make edges.** A 0.40-wide window across a field
spanning 0.8 is a gradient by construction. Material boundaries want windows
around 0.02–0.13.

**Bright colours must be authored away from white.** The exposure curve
`1 - exp(-c × 1.15)` pulls channels toward 1.0 as brightness rises, so they
converge and saturation drains. `[0.88, 0.98, 1.0]` tonemaps to
`[0.76, 0.79, 0.80]` — grey. Hold the low channel down: `[0.45, 0.80, 1.0]` stays
blue at the same apparent brightness. Get the white-hot look from a shell around
the object, not from the object.

**A clamped radius reads 1.0 across the whole sky.** `rr = clamp(sd/R, 0, 1)` is
clamped so the hemisphere `sqrt(1 - rr²)` stays valid. Anything that falls off
with distance must use the *unclamped* radius, or it evaluates at full strength
everywhere. A shell peaking near 1.0 turned the entire background white.

**Per-cell amplitude must fall to zero inside its own cell.** Lattice effects
(lightning, craters) take amplitude from `hash(cellId)`, constant per cell. If
the falloff is still non-zero at a cell face, a firing cell meets a dark one
along a flat plane, and that plane clipped by the sphere draws a hard-edged
polygon. Keep radius plus jitter under half a cell.

**Shadow offsets must be tangential.** Displacing a sample point straight toward
the light in 3D works where the sun is low and fails where it is overhead — the
step goes radial, leaves the sphere, and lands on uncorrelated noise. Project the
light into the tangent plane and shift by `height × tan(angle from vertical)`.
The failure looks like storms with no shadow and shadows with no storm.

**Stochastic tiling needs explicit gradients.** Random per-cell offsets make the
sample coordinate discontinuous at joins; mip selection reads that as an enormous
derivative and picks the smallest mip, stitching dotted dark lines along every
boundary. Sample with `texture2DGradEXT` using derivatives of the *un-offset*
coordinate. Guarded behind `TEX_GRAD`, with a plain-sampling fallback.

**Surface art must be healed before it tiles.** Generated images are never
seamless; with `REPEAT` the wrap shows as straight lines with a brightness step.
The heal pass renders a tileable copy at load. Do not switch to `MIRRORED_REPEAT`
to avoid it — that trades a seam problem for symmetry axes at every tile edge,
which the eye catches faster.

## Accessibility and cost

- **No fast flashing.** The star's pulse is a slow cosine swell at ~0.125 Hz.
  A couple of flashes a second is a photosensitivity risk and this sits behind a
  login form nobody chose to look at. `pulseDepth` makes it dramatic without
  making it fast.
- The whole canvas is **desktop-only** (`min-width: 1024px`) and disabled under
  `prefers-reduced-motion`; both fall back to the star field. WebGL failure and
  context loss fall back the same way.
- Perf levers, in order: `MAX_PIXELS` (frame ceiling), `BAKE_SIZE`, `texScale`,
  then octave counts. The frame is dominated by per-pixel noise, so octaves cost
  more than texture fetches.

## Working method

**Look at the result.** Most of the wrong turns in this system came from tuning
against reasoning instead of a render. Screenshot the page, compare against the
reference, and prefer a measurement to an impression — quadrant brightness for
a lighting gradient, mirror difference for symmetry, percentiles for a threshold.

When a look is wrong, decide whether it is a *parameter* problem or a *model*
problem. Noise produces texture; it does not produce composition or intent. If a
reference has a deliberate focal point and semantic structure, no amount of
tuning gets there — that is what the surface art is for.
