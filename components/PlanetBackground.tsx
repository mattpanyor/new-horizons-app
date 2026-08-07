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
    img.onload = () => resolve(img);
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

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("PlanetBackground shader:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function link(gl: WebGLRenderingContext, vertSrc: string, fragSrc: string): WebGLProgram | null {
  const vert = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  // Pin the attribute so every program shares one enabled vertex array.
  gl.bindAttribLocation(program, 0, "a_pos");
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("PlanetBackground link:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function setUniforms(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  values: Record<string, number | readonly number[]>,
) {
  for (const [name, value] of Object.entries(values)) {
    const loc = gl.getUniformLocation(program, name);
    if (!loc) continue;
    if (typeof value === "number") gl.uniform1f(loc, value);
    else if (value.length === 3) gl.uniform3fv(loc, value as number[]);
    else if (value.length === 2) gl.uniform2fv(loc, value as number[]);
  }
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
    u_discSquash: look.discSquash ?? 0.15,
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
  // Once WebGL has failed on this machine, stop offering it — a later media
  // query change shouldn't retry a context that isn't coming back.
  const failed = useRef(false);

  // Read through a ref inside the render loop. As a dependency of the GL effect
  // it would tear down the context and re-bake every time the route changed,
  // which is exactly what this prop exists to prevent.
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const giveUp = useCallback(() => {
    failed.current = true;
    setEnabled(false);
    setPainted(false);
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
    });
    if (!gl) {
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

    const healProgram = link(gl, PLANET_VERT, PLANET_HEAL_FRAG);
    const bakeProgram = link(gl, PLANET_VERT, PLANET_BAKE_FRAG);
    const mainProgram = link(gl, PLANET_VERT, gradPrelude + PLANET_MAIN_FRAG);
    if (!bakeProgram || !mainProgram || !healProgram) {
      giveUp();
      return;
    }

    // One triangle large enough to cover the clip volume — cheaper than a quad
    // and there's no seam down the diagonal.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

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

    const bakeFace = (i: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, cube, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return false;

      gl.viewport(0, 0, BAKE_SIZE, BAKE_SIZE);
      gl.useProgram(bakeProgram);
      const face = CUBE_FACE_BASIS[i];
      setUniforms(gl, bakeProgram, {
        ...lookUniforms,
        u_size: BAKE_SIZE,
        u_faceA: face.a,
        u_faceB: face.b,
        u_faceC: face.c,
      });
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return true;
    };

    let w = 0;
    let h = 0;
    const resize = () => {
      const cw = Math.max(1, canvas.clientWidth);
      const ch = Math.max(1, canvas.clientHeight);
      let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
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

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = now - last;
      last = now;
      // The bake still runs while paused — better to have it finished before the
      // layer is ever shown than to stall on first sight of it.
      if (document.hidden || (pausedRef.current && baked >= 6)) return;

      if (pendingSurface) {
        surfaceTex = healSurface(pendingSurface);
        pendingSurface = null;
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
        }
        return;
      }

      elapsed += Math.min(dt, 100);
      resize();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(mainProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, cube);
      gl.uniform1i(gl.getUniformLocation(mainProgram, "u_map"), 0);
      if (surfaceTex) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, surfaceTex);
        gl.uniform1i(gl.getUniformLocation(mainProgram, "u_tex"), 1);
      }
      setUniforms(gl, mainProgram, {
        ...lookUniforms,
        u_res: [w, h],
        u_time: elapsed / 1000,
        u_hasTex: surfaceTex ? 1 : 0,
      });
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (first) {
        first = false;
        setPainted(true);
      }
    };
    raf = requestAnimationFrame(frame);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.deleteBuffer(buffer);
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(cube);
      disposed = true;
      if (surfaceTex) gl.deleteTexture(surfaceTex);
      gl.deleteProgram(healProgram);
      gl.deleteProgram(bakeProgram);
      gl.deleteProgram(mainProgram);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [enabled, preset, giveUp]);

  // The star field stays mounted underneath: it's the server-rendered first
  // paint, the fallback, and what the canvas fades up over once the bake lands.
  return (
    <div className={inline ? "absolute inset-0 overflow-hidden" : "fixed inset-0 -z-10"}>
      <StarSystemBackground />
      {enabled && (
        <canvas
          // Keyed so switching worlds mounts a fresh canvas. The old context is
          // deliberately released on teardown, and a released context can't be
          // re-acquired from the same element.
          key={preset}
          ref={canvasRef}
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${
            painted ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}
