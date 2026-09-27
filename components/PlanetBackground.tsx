"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StarSystemBackground from "@/components/StarSystemBackground";
import {
  CUBE_FACE_BASIS,
  PLANET_BAKE_FRAG,
  PLANET_HEAL_FRAG,
  PLANET_MAIN_FRAG,
  PLANET_VERT,
} from "@/lib/planetBackgroundShader";
import {
  DEFAULT_PRESET,
  PLANET_PRESETS,
  type PlanetPreset,
  type PlanetPresetName,
} from "@/lib/planetPresets";

// Desktop only, by decision: the shader is a per-pixel cost we don't want on a
// phone, and the login page is the one screen every user opens on one. Below
// this width — and for anyone asking for less motion — the old star field is
// the background, not a degraded version of this one.
const DESKTOP = "(min-width: 1024px)";
const REDUCED = "(prefers-reduced-motion: reduce)";

// With the fractal work baked, the per-frame shader is a few texture fetches
// and some lighting, so it can afford native resolution. Rendering below native
// and letting the browser scale up is itself a blur pass, and undoing that is
// half of what makes the surface look sharp.
const MAX_DPR = 2;
const MAX_PIXELS = 5_000_000;

// Refused outright, whatever the page asks for. Measured at 1920x1080, DPR 1,
// the main pass costs 0.12–0.39 ms a frame on an Apple M4 and 193–234 ms on
// SwiftShader, Chrome's software WebGL fallback (61–76 ms even at 960x540, and
// ~360 ms for the six-face bake) — and that was on ten fast cores. A machine
// that falls back to software is by definition not one of those, and because
// GPU-process work stalls every frame of the browser, that alone was the whole
// of the "mouse lag" reports. `failIfMajorPerformanceCaveat` makes Chrome and
// Firefox refuse the context; this catches what it misses (Safari ignores the
// flag, some Linux builds hand out llvmpipe without calling it a caveat, and
// "Microsoft Basic Render Driver" is Windows' software rasteriser).
const SOFTWARE_RENDERER = /SwiftShader|llvmpipe|Software|Mesa OffScreen|Basic Render Driver/i;

// ── Adaptive quality ──
// Integrated GPUs are unmeasured. Extrapolating from the M4 by raw throughput
// puts them at roughly 4–10 ms a frame at 1080p DPR 1 and 10–25 ms at DPR
// 1.5–2 — enough to saturate the GPU and drop compositor frames, which the
// player feels as input lag everywhere on the page, not as a slow planet. So
// quality steps down until the page keeps pace, one level at a time:
//   0  native, up to MAX_DPR and MAX_PIXELS
//   1  DPR capped at 1
//   2  0.75 of CSS pixels
//   3  0.5 of CSS pixels, drawn every other frame — the planet turns slowly
//      enough that ~30 fps is invisible
//   4  give up; the star field is the background
// Never back up within a session: a level that failed once would fail again,
// and stepping up to find out is exactly the jank this exists to remove.
const RENDER_SCALE = [MAX_DPR, 1, 0.75, 0.5] as const;
const HALF_RATE_LEVEL = 3;
const GIVE_UP_LEVEL = RENDER_SCALE.length;

// Pacing is judged over this much drawn time, so one verdict costs the player
// at most a second and a half of a struggling page.
const MEASURE_MS = 1500;
// Slow is an average frame interval above this — under ~42 fps. Absolute, not
// relative to the display, so a 120/144 Hz panel holding a steady 60 is not
// read as struggling…
const SLOW_MS = 24;
// …but never tighter than this many refresh intervals, so a 30 Hz display is
// not read as struggling either. The refresh estimate is capped: it is the
// smallest interval seen, and on a GPU that was saturated from the start that
// could itself be a slow frame, which must not raise the bar indefinitely.
const SLOW_VS_REFRESH = 1.4;
const MAX_REFRESH_MS = 34;
// One long task (a route render, a GC) is clamped so it cannot condemn a
// window on its own. A GPU that is genuinely behind is behind on every frame.
const MAX_SAMPLE_MS = 100;

// Only a canvas that covers most of the viewport is governed. The admin panel
// mounts a small preview through this same component; it is cheap at any
// quality, and a verdict formed there must never be persisted for the login
// page to inherit.
const GOVERN_COVERAGE = 0.5;
const QUALITY_KEY = "nh.planetQuality";

/** Whether a window of frames averaging `avgMs` apart is too slow, given the
 *  shortest interval seen so far as an estimate of the display's refresh. */
function isSlowPacing(avgMs: number, minMs: number): boolean {
  const refresh = Number.isFinite(minMs) ? Math.min(minMs, MAX_REFRESH_MS) : 0;
  return avgMs > Math.max(SLOW_MS, refresh * SLOW_VS_REFRESH);
}

/** Device pixels per CSS pixel at a quality level, before the MAX_PIXELS cap. */
function pixelScale(level: number): number {
  return Math.min(window.devicePixelRatio || 1, RENDER_SCALE[level]);
}

// A hard refresh starts at the level this machine settled on last time instead
// of re-ramping through seconds of jank. Keyed by renderer so a laptop that
// moves between its integrated and discrete GPU keeps a verdict for each.
// Storage can throw (private mode, blocked site data); the governor then just
// works from scratch.
// A verdict expires. The governor measures page pacing, not the GPU alone, so
// a stretch of unrelated main-thread work — a huge download in another tab, a
// runaway extension — can push a capable machine down a level or two, and a
// permanent record would hide the planet from it for good. Re-measuring once a
// day costs a genuinely slow machine at most a few seconds of ramp a day.
const QUALITY_TTL_MS = 24 * 60 * 60 * 1000;

function readLevel(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const [levelPart, atPart] = raw.split("|");
    const n = Number(levelPart);
    const at = Number(atPart);
    if (!Number.isInteger(n) || n < 0 || n > GIVE_UP_LEVEL) return null;
    if (!Number.isFinite(at) || Date.now() - at > QUALITY_TTL_MS) return null;
    return n;
  } catch {
    return null;
  }
}

function writeLevel(key: string, level: number) {
  try {
    localStorage.setItem(key, `${level}|${Date.now()}`);
  } catch {
    // Not remembered; the next load measures again.
  }
}

/** A first guess for a machine with no verdict yet. Only ever a guess: the
 *  governor still measures, and can only step further down from it. */
function hintedLevel(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const fewCores = !!nav.hardwareConcurrency && nav.hardwareConcurrency <= 4;
  const lowMemory = !!nav.deviceMemory && nav.deviceMemory <= 4;
  return fewCores || lowMemory ? 1 : 0;
}

// Per cube face. Six of these is 25MB of GPU memory at RGBA8 — the next step up
// would be 100MB, which is not a reasonable thing to spend on a login page. The
// main pass adds fine grain on top, which covers the gap under magnification.
const BAKE_SIZE = 1024;

// Fraction of the surface texture blended toward its half-offset copy at each
// edge, to make it tileable. Wider hides the wrap more thoroughly and softens
// more of the picture; this is about the smallest that reliably kills the step.
const HEAL_BAND = 0.10;

// Surface art, one file per preset. A world without a file falls back to the
// procedural surface, so adding art is incremental — nothing breaks while only
// some worlds are painted.
const texturePath = (preset: PlanetPresetName) => `/planets/${preset}.jpg`;

/** Load an image, resolving to null if there isn't one — a world without art
 *  falls back rather than failing. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // `decode()` does the JPEG work off the main thread. Without it the decode
    // is deferred to the texImage2D call, so a single frame pays a full 1024²
    // decode plus the upload plus the heal pass plus generateMipmap — tens of
    // milliseconds, landing during the fade-in where a hitch is most visible.
    img.onload = () => (img.decode ? img.decode().then(() => resolve(img), () => resolve(img)) : resolve(img));
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Anisotropy earns its keep near the limb, where the surface is raked at a
 *  grazing angle and plain mipmapping blurs along the wrong axis. */
function setAnisotropy(gl: WebGLRenderingContext) {
  const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
  if (aniso) {
    gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  }
}

interface Pending {
  program: WebGLProgram;
  vert: WebGLShader;
  frag: WebGLShader;
}

/** Hand a program to the driver without waiting for it.
 *
 *  Nothing here queries COMPILE_STATUS or LINK_STATUS, and that omission is the
 *  point. Those queries force the driver to finish translating on the spot, and
 *  since compilation happens in the GPU process — which every tab shares — a
 *  slow one does not merely stall this page, it stops compositing browser-wide.
 *  On this shader that was minutes on a cold load, which is what a first visit
 *  or any deploy that changes the source always is.
 *
 *  Readiness is polled from the render loop instead; see `settled` below. */
function startProgram(
  gl: WebGLRenderingContext,
  vertSrc: string,
  fragSrc: string,
): Pending | null {
  const vert = gl.createShader(gl.VERTEX_SHADER);
  const frag = gl.createShader(gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vert || !frag || !program) {
    if (vert) gl.deleteShader(vert);
    if (frag) gl.deleteShader(frag);
    if (program) gl.deleteProgram(program);
    return null;
  }
  gl.shaderSource(vert, vertSrc);
  gl.compileShader(vert);
  gl.shaderSource(frag, fragSrc);
  gl.compileShader(frag);
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  // Pin the attribute so every program shares one enabled vertex array.
  gl.bindAttribLocation(program, 0, "a_pos");
  gl.linkProgram(program);
  return { program, vert, frag };
}

/** Whether the driver has finished, when it can tell us.
 *
 *  Without KHR_parallel_shader_compile there is no way to ask, so this reports
 *  ready and the status query below blocks — but by then it is one frame after
 *  mount rather than inside it. The extension is present on the Chromium and
 *  Firefox builds where the stall is worst, which is where it matters. */
function settled(
  gl: WebGLRenderingContext,
  ext: { COMPLETION_STATUS_KHR: number } | null,
  pending: Pending,
): boolean {
  if (!ext) return true;
  return !!gl.getProgramParameter(pending.program, ext.COMPLETION_STATUS_KHR);
}

/** Collect the result once the driver is done, and release the shaders. Returns
 *  false if anything failed to compile or link. */
function finishProgram(gl: WebGLRenderingContext, pending: Pending): boolean {
  const { program, vert, frag } = pending;
  let ok = true;
  for (const [shader, label] of [[vert, "vertex"], [frag, "fragment"]] as const) {
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(`PlanetBackground ${label} shader:`, gl.getShaderInfoLog(shader));
      ok = false;
    }
  }
  if (ok && !gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("PlanetBackground link:", gl.getProgramInfoLog(program));
    ok = false;
  }
  // Detached implicitly by deletion once the program stops referencing them.
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return ok;
}

/** Uniform locations, resolved once per program.
 *
 *  `getUniformLocation` marshals a string into the driver and validates it, and
 *  it was being called for every name on every frame — including names the
 *  program doesn't declare, which pay the lookup and resolve to null. With ~70
 *  preset fields against two programs that was ~146 GL calls a frame to upload
 *  values that never change after link. */
function locationCache(gl: WebGLRenderingContext, program: WebGLProgram) {
  const cache = new Map<string, WebGLUniformLocation | null>();
  return (name: string) => {
    let loc = cache.get(name);
    if (loc === undefined) {
      loc = gl.getUniformLocation(program, name);
      cache.set(name, loc);
    }
    return loc;
  };
}

type Locate = ReturnType<typeof locationCache>;

function setUniform(
  gl: WebGLRenderingContext,
  locate: Locate,
  name: string,
  value: number | readonly number[],
) {
  const loc = locate(name);
  if (!loc) return;
  // Sampler bindings are integers; everything else the shaders declare is float.
  if (name === "u_map" || name === "u_tex") gl.uniform1i(loc, value as number);
  else if (typeof value === "number") gl.uniform1f(loc, value);
  else if (value.length === 3) gl.uniform3fv(loc, value as number[]);
  else if (value.length === 2) gl.uniform2fv(loc, value as number[]);
}

function setUniforms(
  gl: WebGLRenderingContext,
  locate: Locate,
  values: Record<string, number | readonly number[]>,
) {
  for (const name in values) setUniform(gl, locate, name, values[name]);
}

/** Every preset field the shaders read, under its uniform name. Both programs
 *  get the whole set: names a program doesn't declare resolve to null and are
 *  skipped, which is cheaper to maintain than two hand-kept lists that drift.
 *  Optional weather fields default to values that draw nothing. */
function presetUniforms(look: PlanetPreset) {
  return {
    u_oceanDeep: look.oceanDeep,
    u_oceanShelf: look.oceanShelf,
    u_landLow: look.landLow,
    u_landMid: look.landMid,
    u_landHigh: look.landHigh,
    u_ice: look.ice,
    u_vein: look.vein,
    u_veinGain: look.veinGain,
    u_filament: look.filament,
    u_cloudColor: look.cloudColor,
    u_atmo: look.atmo,
    u_atmoCool: look.atmoCool,
    u_seaLevel: look.seaLevel,
    u_iceExtent: look.iceExtent,
    u_detailScale: look.detailScale,
    u_bandStretch: look.bandStretch,
    u_flowStrength: look.flowStrength,
    u_shear: look.shear,
    u_ridgeMix: look.ridgeMix,
    u_filamentGain: look.filamentGain,
    u_cloudScale: look.cloudScale,
    u_cloudBand: look.cloudBand,
    u_cloudCoverage: look.cloudCoverage,
    u_cloudOpacity: look.cloudOpacity,
    u_cloudSoft: look.cloudSoft ?? 0.08,
    u_cloudUnderlit: look.cloudUnderlit ?? 0,
    u_atmoGain: look.atmoGain,
    u_spinPeriod: look.spinPeriod,
    u_tilt: look.tilt,
    u_cloudSpin: look.cloudSpin,
    u_texScale: look.texScale,
    u_emissive: look.emissive ?? 0,
    u_emissiveThresh: look.emissiveThreshold ?? 0.4,

    u_stormOpacity: look.stormOpacity ?? 0,
    u_stormColor: look.stormColor ?? [0.7, 0.7, 0.7],
    u_stormCoverage: look.stormCoverage ?? 0.5,
    u_stormSystemScale: look.stormSystemScale ?? 1.4,
    u_stormScale: look.stormScale ?? 5,
    u_stormShadow: look.stormShadow ?? 0.5,
    u_stormHeight: look.stormHeight ?? 0.10,
    u_stormSpin: look.stormSpin ?? 1.8,
    u_boltColor: look.boltColor ?? [0.5, 0.4, 1],
    u_boltRate: look.boltRate ?? 0.2,
    u_boltChance: look.boltChance ?? 0,
    u_boltDensity: look.boltDensity ?? 12,

    // Defaults reproduce the yellow dwarf the other worlds have always had.
    u_starCore: look.starCore ?? [1.0, 0.94, 0.82],
    u_starSpot: look.starSpot ?? [1.0, 0.86, 0.62],
    u_starGlow: look.starGlow ?? [1.0, 0.66, 0.29],
    u_starRadius: look.starRadius ?? 0.105,
    u_starGrain: look.starGrain ?? 0,
    u_jetStrength: look.jetStrength ?? 0,
    u_flareStrength: look.flareStrength ?? 0,
    u_jetTilt: look.jetTilt ?? 0,
    u_pulseRate: look.pulseRate ?? 0,
    u_pulseDepth: look.pulseDepth ?? 0.4,
    u_nebula: look.nebula ?? 0,
    u_blackHole: look.blackHole ?? 0,
    u_discOuter: look.discOuter ?? 9,
    u_discIncline: look.discIncline ?? 0.14,
    u_discInner: look.discInner ?? 3,
    u_discGain: look.discGain ?? 1.15,
    u_ribFreq: look.ribFreq ?? 6,
    u_ribDepth: look.ribDepth ?? 0.42,
    u_discBright: look.discBright ?? [0.4, 0.47, 0.59],
    u_discDim: look.discDim ?? [0.17, 0.23, 0.41],
    u_lightTint: look.lightTint ?? [1, 1, 1],
    u_terminator: look.terminator ?? [1.0, 0.48, 0.32],

    u_craterDensity: look.craterDensity ?? 9,
    u_craterChance: look.craterChance ?? 0,
  };
}

interface Props {
  /** Which world to show. A campaign can point different screens at different
   *  entries in PLANET_PRESETS; switching costs one re-bake. */
  preset?: PlanetPresetName;
  /** Fill the nearest positioned ancestor instead of the viewport. For previews;
   *  the parent supplies `relative` and a size. */
  inline?: boolean;
  /** Stop drawing without tearing anything down. Used when the layer is mounted
   *  but hidden, so returning to a route that shows it costs nothing. */
  paused?: boolean;
}

export default function PlanetBackground({
  preset = DEFAULT_PRESET,
  inline = false,
  paused = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [painted, setPainted] = useState(false);
  // The canvas is opaque (`alpha: false`), so once its fade-in has finished the
  // star field beneath it is invisible but still animating. Set when the fade
  // ends, and cleared with `painted` so the field is back the moment the canvas
  // goes.
  const [covered, setCovered] = useState(false);
  // Once WebGL has failed on this machine, stop offering it — a later media
  // query change shouldn't retry a context that isn't coming back.
  const failed = useRef(false);

  // Read through a ref inside the render loop. As a dependency of the GL effect
  // it would tear down the context and re-bake every time the route changed,
  // which is exactly what this prop exists to prevent.
  const pausedRef = useRef(paused);
  const resumeRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) resumeRef.current?.();
  }, [paused]);

  const giveUp = useCallback(() => {
    failed.current = true;
    setEnabled(false);
    setPainted(false);
    setCovered(false);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP);
    const reduced = window.matchMedia(REDUCED);
    const decide = () => setEnabled(!failed.current && desktop.matches && !reduced.matches);
    decide();
    desktop.addEventListener("change", decide);
    reduced.addEventListener("change", decide);
    return () => {
      desktop.removeEventListener("change", decide);
      reduced.removeEventListener("change", decide);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const look = PLANET_PRESETS[preset];
    const lookUniforms = presetUniforms(look);

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      failIfMajorPerformanceCaveat: true,
    });
    if (!gl) {
      giveUp();
      return;
    }

    const releaseContext = () => gl.getExtension("WEBGL_lose_context")?.loseContext();
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      gl.getParameter(debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "",
    );
    if (SOFTWARE_RENDERER.test(renderer)) {
      releaseContext();
      giveUp();
      return;
    }

    const qualityKey = `${QUALITY_KEY}:${debugInfo && renderer ? renderer : "default"}`;
    const coversViewport = (cw: number, ch: number) =>
      cw * ch >= GOVERN_COVERAGE * window.innerWidth * window.innerHeight;
    // A machine that already gave up once is not made to compile and bake again
    // just to reach the same verdict.
    if (coversViewport(canvas.clientWidth, canvas.clientHeight) &&
        (readLevel(qualityKey) ?? 0) >= GIVE_UP_LEVEL) {
      releaseContext();
      giveUp();
      return;
    }

    // Both are needed together: derivatives to measure the footprint, and
    // texture-lod to sample with it. Directives have to lead the source, so the
    // prelude is prepended rather than living in the shader file.
    const hasGrad =
      !!gl.getExtension("OES_standard_derivatives") && !!gl.getExtension("EXT_shader_texture_lod");
    const gradPrelude = hasGrad
      ? "#extension GL_OES_standard_derivatives : enable\n" +
        "#extension GL_EXT_shader_texture_lod : enable\n" +
        "#define TEX_GRAD 1\n"
      : "";

    // The accretion-disc raymarch is compiled only where it is used. It is a
    // 190-iteration loop that the driver unrolls, and it dominates this shader's
    // translation time — see the comment on the block in planetBackgroundShader.
    // Uniforms cannot gate it: the compiler has to translate a branch it cannot
    // fold away, so the gate has to be a preprocessor one. Must follow the
    // #extension lines, which have to lead the source.
    const bhPrelude = look.blackHole ? "#define BLACK_HOLE 1\n" : "";

    // Lets the driver translate on its own thread and be asked later whether it
    // is done, instead of us demanding the answer immediately and blocking every
    // tab until it arrives.
    const parallel = gl.getExtension("KHR_parallel_shader_compile") as
      | { COMPLETION_STATUS_KHR: number }
      | null;

    const healPending = startProgram(gl, PLANET_VERT, PLANET_HEAL_FRAG);
    const bakePending = startProgram(gl, PLANET_VERT, PLANET_BAKE_FRAG);
    const mainPending = startProgram(gl, PLANET_VERT, gradPrelude + bhPrelude + PLANET_MAIN_FRAG);
    if (!bakePending || !mainPending || !healPending) {
      // Release whatever was allocated, and the context with it. Returning early
      // skips the cleanup function entirely, so nothing else will — on a machine
      // where allocation fails this leaked a live context per mount.
      for (const p of [healPending, bakePending, mainPending]) {
        if (!p) continue;
        gl.deleteShader(p.vert);
        gl.deleteShader(p.frag);
        gl.deleteProgram(p.program);
      }
      releaseContext();
      giveUp();
      return;
    }
    const healProgram = healPending.program;
    const bakeProgram = bakePending.program;
    const mainProgram = mainPending.program;

    // One triangle large enough to cover the clip volume — cheaper than a quad
    // and there's no seam down the diagonal.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const bakeAt = locationCache(gl, bakeProgram);
    const mainAt = locationCache(gl, mainProgram);

    // ── Cubemap the bake writes into ──
    const cube = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cube);
    for (let i = 0; i < 6; i++) {
      gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA,
        BAKE_SIZE, BAKE_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    // ── Surface art ──
    // Loaded alongside the bake rather than before it: the star field is already
    // covering this moment, so half a megabyte of JPEG never blocks anything.
    // Until it lands (or if it 404s) u_hasTex stays 0 and the procedural surface
    // draws instead.
    let surfaceTex: WebGLTexture | null = null;
    let disposed = false;
    // Held until the next frame rather than healed inside the load callback, so
    // the pass can't land in the middle of the bake's framebuffer state.
    let pendingSurface: HTMLImageElement | null = null;
    void loadImage(texturePath(preset)).then((img) => {
      if (img && !disposed) pendingSurface = img;
    });


    const fbo = gl.createFramebuffer();

    // Render a tileable copy of the surface art. The raw image is uploaded with
    // CLAMP_TO_EDGE and no mip chain — it exists only as this pass's input — and
    // is discarded as soon as the healed copy exists.
    const healSurface = (img: HTMLImageElement) => {
      const size = img.width;
      // Explicit, because the frame loop leaves unit 1 selected once the art is
      // bound, and u_src reads unit 0.
      gl.activeTexture(gl.TEXTURE0);
      const src = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, src);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      const out = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, out);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, size, size, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, out, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        gl.deleteTexture(src);
        gl.deleteTexture(out);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return null;
      }
      gl.viewport(0, 0, size, size);
      gl.useProgram(healProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src);
      gl.uniform1i(gl.getUniformLocation(healProgram, "u_src"), 0);
      gl.uniform1f(gl.getUniformLocation(healProgram, "u_size"), size);
      gl.uniform1f(gl.getUniformLocation(healProgram, "u_band"), HEAL_BAND);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, out);
      gl.generateMipmap(gl.TEXTURE_2D);
      setAnisotropy(gl);
      gl.deleteTexture(src);
      return out;
    };

    // The bake and heal programs and the framebuffer are each used once, within
    // the first second. Held to unmount they would sit in driver memory for the
    // whole session, which is now the life of the tab.
    let oneShotsLive = true;
    const releaseOneShots = () => {
      if (!oneShotsLive || pendingSurface || surfaceTex === null) return;
      oneShotsLive = false;
      gl.deleteProgram(healProgram);
      gl.deleteProgram(bakeProgram);
      gl.deleteFramebuffer(fbo);
    };

    const bakeFace = (i: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, cube, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return false;

      gl.viewport(0, 0, BAKE_SIZE, BAKE_SIZE);
      gl.useProgram(bakeProgram);
      const face = CUBE_FACE_BASIS[i];
      setUniforms(gl, bakeAt, {
        ...lookUniforms,
        u_size: BAKE_SIZE,
        u_faceA: face.a,
        u_faceB: face.b,
        u_faceC: face.c,
      });
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return true;
    };

    // Loaded on first need, and only for a canvas that is governed — a preview
    // never reads or writes the persisted verdict.
    let level: number | null = null;
    const governedLevel = () => {
      if (level === null) {
        // A stored give-up is handled before any compile; reaching here with one
        // means the canvas only grew to full size later, so try the lowest level.
        level = Math.min(readLevel(qualityKey) ?? hintedLevel(), GIVE_UP_LEVEL - 1);
      }
      return level;
    };
    // What resize() last applied: whether this canvas is governed, and the level
    // it actually renders at (always 0 for one that isn't).
    let governed = false;
    let applied = 0;

    let w = 0;
    let h = 0;
    const resize = () => {
      const cw = Math.max(1, canvas.clientWidth);
      const ch = Math.max(1, canvas.clientHeight);
      governed = coversViewport(cw, ch);
      applied = governed ? governedLevel() : 0;
      let dpr = pixelScale(applied);
      if (cw * ch * dpr * dpr > MAX_PIXELS) dpr = Math.sqrt(MAX_PIXELS / (cw * ch));
      const nw = Math.max(1, Math.round(cw * dpr));
      const nh = Math.max(1, Math.round(ch * dpr));
      if (nw === w && nh === h) return;
      w = nw;
      h = nh;
      canvas.width = w;
      canvas.height = h;
    };

    const onLost = (e: Event) => {
      e.preventDefault();
      giveUp();
    };
    canvas.addEventListener("webglcontextlost", onLost);

    // Clock that only advances while the tab is visible, so coming back to a
    // backgrounded login page doesn't snap the planet a quarter turn.
    let elapsed = 0;
    let last = performance.now();
    let raf = 0;
    let baked = 0;
    let first = true;
    let uniformsSent = false;
    let texBound = false;
    let sentW = -1;
    let sentH = -1;
    let needsResize = true;
    let running = true;
    let linked = false;

    // ── Pacing measurement ──
    // The shortest interval seen estimates the display's refresh. It is taken
    // from every frame, including the compile and bake ones, which are cheap —
    // so it is learned before the main pass has had a chance to saturate
    // anything.
    let minDt = Infinity;
    let windowMs = 0;
    let windowFrames = 0;
    // The next interval spans something that isn't rendering (a hidden tab, a
    // pause, a resize, a level change) and must not be counted.
    let fresh = true;
    let skipNext = false;
    const restartWindow = () => {
      windowMs = 0;
      windowFrames = 0;
      fresh = true;
    };

    /** One level down, skipping levels that would render identically — on a
     *  DPR 1 display, "cap DPR at 1" changes nothing and would only cost the
     *  player another measurement window. Returns false once there is nothing
     *  left to step down to. */
    const stepDown = () => {
      let next = (level ?? 0) + 1;
      while (next < HALF_RATE_LEVEL && pixelScale(next) === pixelScale(next - 1)) next++;
      level = next;
      writeLevel(qualityKey, next);
      if (next >= GIVE_UP_LEVEL) return false;
      needsResize = true;
      restartWindow();
      return true;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = now - last;
      last = now;
      // Below ~3 ms is a callback that landed off the vsync grid, not a refresh.
      if (dt >= 3 && dt < minDt) minDt = dt;
      // The bake still runs while paused — better to have it finished before the
      // layer is ever shown than to stall on first sight of it. Once it is done
      // the loop stops entirely rather than spinning on an early return: the
      // layer stays mounted for the whole session, so on /admin and /game that
      // was sixty no-op callbacks a second, forever, beside three.js.
      if (document.hidden) {
        restartWindow();
        return;
      }

      // Wait for the driver rather than demanding it finish. Nothing below may
      // touch a program before this passes — not even a uniform lookup — so the
      // gate sits above everything, including the bake. The star field is the
      // background meanwhile, exactly as it is during the bake, so the only
      // visible consequence of a slow compile is a later fade-in.
      if (!linked) {
        if (!settled(gl, parallel, mainPending) ||
            !settled(gl, parallel, bakePending) ||
            !settled(gl, parallel, healPending)) {
          return;
        }
        if (!finishProgram(gl, healPending) ||
            !finishProgram(gl, bakePending) ||
            !finishProgram(gl, mainPending)) {
          cancelAnimationFrame(raf);
          giveUp();
          return;
        }
        linked = true;
      }

      if (pausedRef.current && baked >= 6) {
        running = false;
        cancelAnimationFrame(raf);
        return;
      }

      if (pendingSurface) {
        surfaceTex = healSurface(pendingSurface);
        pendingSurface = null;
        if (baked >= 6) releaseOneShots();
      }

      // One face per frame. All six in a single frame is a visible hitch on
      // slower GPUs, and there is nothing to show until it's done anyway.
      if (baked < 6) {
        if (!bakeFace(baked)) {
          cancelAnimationFrame(raf);
          giveUp();
          return;
        }
        baked++;
        if (baked === 6) {
          gl.bindTexture(gl.TEXTURE_CUBE_MAP, cube);
          gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
          gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          releaseOneShots();
        }
        return;
      }

      elapsed += Math.min(dt, 100);
      if (needsResize) {
        needsResize = false;
        resize();
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(mainProgram);

      // The preset block is constant for the life of the context, and uniform
      // state is per-program and survives until relink — so it is uploaded once
      // rather than re-sent every frame. Only the three values below actually
      // change: time every frame, resolution on resize, and the texture flag
      // exactly once when the art finishes loading.
      if (!uniformsSent) {
        uniformsSent = true;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, cube);
        setUniform(gl, mainAt, "u_map", 0);
        setUniforms(gl, mainAt, lookUniforms);
      }
      if (surfaceTex && !texBound) {
        texBound = true;
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, surfaceTex);
        setUniform(gl, mainAt, "u_tex", 1);
        setUniform(gl, mainAt, "u_hasTex", 1);
      }
      if (w !== sentW || h !== sentH) {
        sentW = w;
        sentH = h;
        setUniform(gl, mainAt, "u_res", [w, h]);
      }
      setUniform(gl, mainAt, "u_time", elapsed / 1000);

      // Judged only once the planet is on screen: compile, bake and first paint
      // are one-off costs, not the steady state the player lives with.
      if (governed && !first) {
        if (fresh) {
          fresh = false;
        } else {
          windowMs += Math.min(dt, MAX_SAMPLE_MS);
          windowFrames++;
          if (windowMs >= MEASURE_MS) {
            const slow = isSlowPacing(windowMs / windowFrames, minDt);
            windowMs = 0;
            windowFrames = 0;
            if (slow && !stepDown()) {
              cancelAnimationFrame(raf);
              giveUp();
              return;
            }
          }
        }
      }

      // The clock above still advanced, so skipping a draw costs no motion —
      // the next one lands where the planet would have been anyway.
      if (applied >= HALF_RATE_LEVEL) {
        skipNext = !skipNext;
        if (skipNext && !first) return;
      }

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (first) {
        first = false;
        setPainted(true);
      }
    };
    raf = requestAnimationFrame(frame);

    // Restarting after a pause resets the clock's reference point; without it
    // `dt` would be the whole time spent paused and the planet would jump.
    const resume = () => {
      if (running || disposed) return;
      running = true;
      last = performance.now();
      needsResize = true;
      restartWindow();
      raf = requestAnimationFrame(frame);
    };
    resumeRef.current = resume;

    // A ResizeObserver rather than reading clientWidth/clientHeight every frame.
    // The rAF callback runs after React commits, so on a page with a live layout
    // that read forces a style and layout recalculation inside the render loop.
    // The observer also catches container-driven resizes in `inline` mode, which
    // the window listener alone misses.
    const onResize = () => {
      needsResize = true;
      restartWindow();
    };
    window.addEventListener("resize", onResize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    ro?.observe(canvas);

    return () => {
      running = false;
      resumeRef.current = null;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.deleteBuffer(buffer);
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(cube);
      disposed = true;
      if (surfaceTex) gl.deleteTexture(surfaceTex);
      // Unmounted mid-compile: finishProgram never ran, so the shaders were
      // never released. Deleting the program alone would leave them attached
      // and alive.
      if (!linked) {
        for (const p of [healPending, bakePending, mainPending]) {
          gl.deleteShader(p.vert);
          gl.deleteShader(p.frag);
        }
      }
      gl.deleteProgram(healProgram);
      gl.deleteProgram(bakeProgram);
      gl.deleteProgram(mainProgram);
      releaseContext();
      // The canvas goes with this context — a new preset mounts a fresh one —
      // so the star field has to be back before it does, and the next canvas
      // has to fade in over it rather than appear already opaque and black.
      setPainted(false);
      setCovered(false);
    };
  }, [enabled, preset, giveUp]);

  // The star field stays mounted underneath: it's the server-rendered first
  // paint, the fallback, and what the canvas fades up over once the bake lands.
  return (
    <div className={inline ? "absolute inset-0 overflow-hidden" : "fixed inset-0 -z-10"}>
      <StarSystemBackground covered={enabled && painted && covered} />
      {enabled && (
        <canvas
          // Keyed so switching worlds mounts a fresh canvas. The old context is
          // deliberately released on teardown, and a released context can't be
          // re-acquired from the same element.
          key={preset}
          ref={canvasRef}
          aria-hidden="true"
          onTransitionEnd={(e) => {
            if (e.propertyName === "opacity" && painted) setCovered(true);
          }}
          className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${
            painted ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}
