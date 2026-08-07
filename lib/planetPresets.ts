// Planet looks, one per world worth showing. The three here are read off the
// reference art: the same generator throughout, differing only in palette,
// detail density and how hard the flow field smears that detail into currents.
//
// Adding a world is adding an entry. Nothing else needs to change — the shader
// takes every one of these as a uniform, so a picker can switch worlds at
// runtime and the only cost is a re-bake (a few frames).

export type RGB = [number, number, number];

export interface PlanetPreset {
  /** Shown in a picker, once there is one. */
  label: string;

  // ── Surface ──
  /** Deep water. */
  oceanDeep: RGB;
  /** Shallows, at the waterline. */
  oceanShelf: RGB;
  /** Bare ground where turbulence is low — the smooth dark masses. */
  landLow: RGB;
  /** Ground where turbulence is high — the curdled middle material. */
  landMid: RGB;
  /** The living layer, placed by the variety field. */
  landHigh: RGB;
  ice: RGB;
  /** Thin lines threaded along the valleys of the turbulence field. */
  vein: RGB;
  veinGain: number;
  /** Where the land/water split falls in the height field, 0–1. */
  seaLevel: number;
  /** Latitude (as |y| on the unit sphere) where ice starts. 1 = none. */
  iceExtent: number;
  /** Base noise frequency, in cycles per sphere radius. The camera is close
   *  enough that the visible slice is only ~0.6 of a radius tall, so this needs
   *  to be far higher than it looks: at 2.6 barely one and a half cycles land on
   *  screen and the whole view is two or three blobs. Around 9 puts roughly a
   *  dozen major features in frame, which is what the reference has. */
  detailScale: number;
  /** Latitudinal squash. >1 pulls detail into horizontal bands. */
  bandStretch: number;
  /** How far the marbling displaces the domain, in sphere radii — the warp runs
   *  in unit-sphere space, so this is independent of detailScale and the swirls
   *  keep their size as detail gets finer. Past ~0.8 it reads as paint. */
  flowStrength: number;
  /** Longitudinal twist per unit latitude — jet streams. */
  shear: number;
  /** 0 = soft fbm continents, 1 = all ridged filament. */
  ridgeMix: number;
  /** Colour of the bright ridge crests riding on top of the surface. */
  filament: RGB;
  filamentGain: number;

  // ── Clouds ──
  cloudColor: RGB;
  cloudScale: number;
  cloudBand: number;
  /** Density threshold: lower = more sky covered. */
  cloudCoverage: number;
  cloudOpacity: number;

  // ── Atmosphere ──
  atmo: RGB;
  atmoCool: RGB;
  atmoGain: number;

  // ── Surface art ──
  /** Cells of `public/planets/<preset>.jpg` per sphere radius, via triplanar
   *  projection with stochastic tiling. Higher packs more texels behind each
   *  screen pixel — worth it on a retina panel — at the cost of more cell joins,
   *  where contrast softens slightly. Ignored when there's no file for the
   *  preset, which falls back to the procedural surface. */
  texScale: number;

  // ── Weather (optional; omit and none of it draws) ──
  /** Drifting dust systems on their own rotation. 0 disables the whole layer. */
  stormOpacity?: number;
  stormColor?: RGB;
  /** Density threshold for where storm systems exist. Lower = more of the
   *  surface is under storm. */
  stormCoverage?: number;
  /** Frequency of the field deciding where whole storm systems sit. Low values
   *  mean few, planet-scale systems; high values scatter many small ones. */
  stormSystemScale?: number;
  /** Frequency of the structure inside a storm. */
  stormScale?: number;
  /** How far the dust darkens the ground beneath it, 0–1. */
  stormShadow?: number;
  /** How high the dust rides above the surface, in sphere radii. Sets how far
   *  the shadow is displaced from the storm as the sun drops toward the
   *  horizon; 0 puts the shadow directly underneath everywhere. */
  stormHeight?: number;
  /** Storm rotation as a multiple of the surface's. Must differ from 1 or the
   *  storms sit still relative to the ground and the parallax is lost. */
  stormSpin?: number;
  /** Lightning inside the storms. Self-emissive, so it shows on the night side. */
  boltColor?: RGB;
  /** Flashes per second per cell. */
  boltRate?: number;
  /** Fraction of cells that ever fire, 0–1. */
  boltChance?: number;
  /** Storm cells per sphere radius — how large a flash's glow is. */
  boltDensity?: number;

  // ── Impact craters (optional) ──
  /** Lattice cells per sphere radius. */
  craterDensity?: number;
  /** Fraction of cells holding a crater, 0–1. Rarity lives here, which is the
   *  reason craters aren't painted into the tiled texture. */
  craterChance?: number;

  // ── The star ──
  /** Disc colour, at the bright end of the speckle. */
  starCore?: RGB;
  /** The dark end of the speckle. The gap between this and starCore is how
   *  visible the spots are. */
  starSpot?: RGB;
  /** Halo, bloom and jet colour. */
  starGlow?: RGB;
  /** Disc radius in half-screen-heights. */
  starRadius?: number;
  /** Mottling on the disc, 0–1. */
  starGrain?: number;
  /** Polar jets. 0 for an ordinary star. */
  jetStrength?: number;
  /** Equatorial plumes, at right angles to the jets. */
  flareStrength?: number;
  /** Jet axis lean from vertical, radians. */
  jetTilt?: number;
  /** Cycles per second of the star's swell — deliberately slow. Keep it well
   *  under 1: anything approaching a few flashes a second is a photosensitivity
   *  risk, and this sits behind a login form. 0 for a steady star. */
  pulseRate?: number;
  /** How much brighter the peak of the swell is, as a fraction. */
  pulseDepth?: number;
  /** Faint nebulosity around the star, lit by it. 0 for clear space. */
  nebula?: number;
  /** Tint the star's light lays over the planet. */
  lightTint?: RGB;
  /** Colour where the light grazes the surface. Warm for a yellow star, cold
   *  for a blue one — a blue-white star with an orange terminator reads wrong
   *  even when nobody can say why. */
  terminator?: RGB;

  // ── Motion ──
  /** Seconds per revolution. */
  spinPeriod: number;
  /** Axis lean in radians. The sign decides whether the surface sweeps
   *  right-and-down across the visible face or right-and-up. */
  tilt: number;
  /** Cloud rotation as a multiple of the surface's. */
  cloudSpin: number;
}

const PRESETS = {
  // The violet world from the arrangement reference: banded, luminous, magenta
  // cloud tops over deep blue water.
  amethyst: {
    label: "Amethyst",
    oceanDeep: [0.012, 0.030, 0.150],
    oceanShelf: [0.070, 0.190, 0.470],
    landLow: [0.180, 0.080, 0.300],
    landMid: [0.320, 0.150, 0.420],
    landHigh: [0.520, 0.240, 0.560],
    ice: [0.820, 0.800, 0.930],
    vein: [0.700, 0.330, 0.480],
    veinGain: 0.30,
    seaLevel: 0.52,
    iceExtent: 0.80,
    detailScale: 7.0,
    bandStretch: 2.4,
    flowStrength: 0.45,
    shear: 0.42,
    ridgeMix: 0.55,
    filament: [0.620, 0.300, 0.880],
    filamentGain: 0.70,
    cloudColor: [0.940, 0.700, 0.990],
    cloudScale: 3.6,
    cloudBand: 3.0,
    cloudCoverage: 0.52,
    cloudOpacity: 0.88,
    atmo: [0.640, 0.330, 0.950],
    atmoCool: [0.280, 0.520, 0.980],
    atmoGain: 1.0,
    texScale: 1.6,
    spinPeriod: 300,
    tilt: -0.34,
    cloudSpin: 1.3,
  },

  // The blue one — the most detailed of the three. Deep ocean, fine white
  // cloud filaments, almost no banding and only a trace of ridge.
  azure: {
    label: "Azure",
    oceanDeep: [0.008, 0.045, 0.170],
    oceanShelf: [0.060, 0.260, 0.540],
    landLow: [0.090, 0.180, 0.300],
    landMid: [0.170, 0.280, 0.390],
    landHigh: [0.280, 0.400, 0.520],
    ice: [0.900, 0.940, 1.000],
    vein: [0.480, 0.420, 0.360],
    veinGain: 0.22,
    seaLevel: 0.56,
    iceExtent: 0.74,
    detailScale: 8.0,
    bandStretch: 1.5,
    flowStrength: 0.32,
    shear: 0.22,
    ridgeMix: 0.40,
    filament: [0.500, 0.720, 0.950],
    filamentGain: 0.45,
    cloudColor: [0.960, 0.980, 1.000],
    cloudScale: 5.2,
    cloudBand: 2.0,
    cloudCoverage: 0.48,
    cloudOpacity: 0.95,
    atmo: [0.300, 0.560, 1.000],
    atmoCool: [0.220, 0.460, 0.950],
    atmoGain: 1.1,
    texScale: 1.6,
    spinPeriod: 300,
    tilt: -0.34,
    cloudSpin: 1.25,
  },

  // Read off the green reference at 6x, then corrected against a screenshot of
  // the render. Its character is marbling, not banding — ink in water, no jet
  // streams — hence bandStretch and shear sitting at their no-op values. Five
  // materials share the surface: dark slate masses, a curdled mid-stone, moss
  // green, deep teal water, near-white foam along the crests, with rust
  // hairlines threading the turbulence valleys.
  verdant: {
    label: "Verdant",
    oceanDeep: [0.020, 0.150, 0.170],
    oceanShelf: [0.090, 0.480, 0.470],
    landLow: [0.130, 0.140, 0.135],
    landMid: [0.330, 0.310, 0.260],
    landHigh: [0.480, 0.700, 0.300],
    ice: [0.870, 0.960, 0.930],
    vein: [0.700, 0.360, 0.200],
    veinGain: 0.70,
    seaLevel: 0.48,
    iceExtent: 0.88,
    detailScale: 9.0,
    bandStretch: 1.05,
    flowStrength: 0.55,
    shear: 0.08,
    ridgeMix: 0.60,
    filament: [0.850, 1.000, 0.960],
    filamentGain: 0.90,
    cloudColor: [0.820, 0.970, 0.930],
    cloudScale: 3.4,
    cloudBand: 1.1,
    cloudCoverage: 0.58,
    cloudOpacity: 0.50,
    atmo: [0.220, 0.850, 0.700],
    atmoCool: [0.180, 0.520, 0.720],
    atmoGain: 1.05,
    texScale: 1.6,
    spinPeriod: 300,
    tilt: -0.34,
    cloudSpin: 1.35,
  },
  // A dead grey rock: stone and dust, sharp ranges, the ruins of a
  // pyramid-building civilisation, and magnetic sandstorms dragging lightning
  // across it. The terrain is art; storms, lightning and craters are generated,
  // because all three need to be either moving or rare — neither of which a
  // tiled texture can be.
  kantar: {
    label: "Kantar",
    oceanDeep: [0.090, 0.095, 0.100],
    oceanShelf: [0.180, 0.180, 0.185],
    landLow: [0.240, 0.240, 0.245],
    landMid: [0.400, 0.395, 0.385],
    landHigh: [0.560, 0.550, 0.530],
    ice: [0.820, 0.830, 0.850],
    vein: [0.420, 0.330, 0.260],
    veinGain: 0.30,
    seaLevel: 0.50,
    iceExtent: 0.90,
    detailScale: 7.0,
    bandStretch: 1.05,
    flowStrength: 0.40,
    shear: 0.10,
    ridgeMix: 0.65,
    filament: [0.700, 0.690, 0.660],
    filamentGain: 0.35,
    cloudColor: [0.760, 0.750, 0.730],
    cloudScale: 3.2,
    cloudBand: 1.2,
    cloudCoverage: 0.70,
    // No water cycle, so no cloud deck — the sandstorms are the whole weather.
    cloudOpacity: 0.0,
    texScale: 1.6,

    stormOpacity: 0.96,
    stormColor: [0.780, 0.720, 0.630],
    // Measured against the field's real distribution (see stormFromFlow): 0.53
    // puts about a fifth of the planet under dense dust in a handful of
    // continent-sized systems, with clear ground between them. Sensitive — 0.50
    // is half the planet, 0.58 is almost nothing.
    stormCoverage: 0.53,
    stormSystemScale: 1.45,
    stormScale: 3.2,
    stormShadow: 0.72,
    stormHeight: 0.10,
    stormSpin: 1.9,
    boltColor: [0.430, 0.180, 1.000],
    boltRate: 0.34,
    boltChance: 0.30,
    boltDensity: 16.0,

    craterDensity: 9.0,
    craterChance: 0.030,


    // A pulsar rather than a dwarf: small, fierce, blue-white, throwing polar
    // jets, and beating a little under twice a second.
    // Authored well away from white. The exposure curve (1 - exp(-c)) pulls
    // every channel toward 1.0 as brightness rises, so channels converge and
    // colour drains out of anything bright. [0.88, 0.98, 1.0] tonemaps to
    // [0.76, 0.79, 0.80] — grey. Holding red down near 0.45 keeps a visibly
    // blue core at the same apparent brightness; the white-hot look comes from
    // the shell around it, which is where the reference puts it too.
    starCore: [0.450, 0.800, 1.000],
    // Deep blue against those peaks: the gap between the two is what makes the
    // speckle visible at all.
    starSpot: [0.040, 0.185, 0.470],
    starGlow: [0.560, 0.760, 1.000],
    starRadius: 0.095,
    starGrain: 0.90,
    jetStrength: 1.00,
    flareStrength: 0.70,
    // Negative leans the top of the axis right, matching the reference's ~18°.
    jetTilt: -0.31,
    // One slow breath every eight seconds.
    pulseRate: 0.125,
    pulseDepth: 0.40,
    nebula: 0.16,
    lightTint: [0.860, 0.920, 1.000],
    terminator: [0.480, 0.560, 1.000],

    atmo: [0.430, 0.480, 0.780],
    atmoCool: [0.360, 0.420, 0.740],
    atmoGain: 0.80,
    spinPeriod: 300,
    tilt: -0.34,
    cloudSpin: 1.3,
  },
} satisfies Record<string, PlanetPreset>;

export type PlanetPresetName = keyof typeof PRESETS;

// Re-exported with each value widened to PlanetPreset. Without this the values
// keep their literal types, and the optional weather fields simply don't exist
// on the presets that omit them — so reading `look.stormOpacity` fails to
// compile rather than yielding undefined.
export const PLANET_PRESETS: Record<PlanetPresetName, PlanetPreset> = PRESETS;

export const DEFAULT_PRESET: PlanetPresetName = "kantar";
