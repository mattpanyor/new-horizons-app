// A framed camera feed for an OBS browser source.
//
// Black behind, the vdo.ninja feed filling the viewport, and a frame drawn over
// it in the same language as the rest of the app — corner brackets, glowing
// diamonds, gradient edge lines. Entirely server-rendered: there is no state
// here, so the browser source runs no JavaScript of ours at all.
//
// The feed is embedded rather than composited in OBS. Each browser source is a
// separate CEF instance, so a frame-only overlay would double the count, and two
// sources per player means every reposition has to be done twice — a frame a few
// pixels off its feed reads as broken.

const cinzel = { fontFamily: "var(--font-cinzel), serif" };
const GLOW = { boxShadow: "0 0 6px rgba(129,140,248,0.9)" };

/** A diamond at a frame corner. */
function Diamond({ className }: { className: string }) {
  return (
    <div
      className={`absolute w-[6px] h-[6px] rotate-45 bg-indigo-400 ${className}`}
      style={GLOW}
    />
  );
}

interface Props {
  /** The vdo.ninja URL to embed, already assembled. */
  src: string;
  /** Shown on the plate over the lower frame edge. Omitted if empty. */
  name?: string;
  /**
   * Width over height of the *camera*, when it isn't the shape of the browser
   * source.
   *
   * The frame always fills the source — every source is the same size in OBS so
   * they look uniform, and reshaping the frame per camera would break that. So
   * it is the feed that adapts: the iframe is sized to the smallest box of this
   * ratio that covers the frame, centred, and the excess is clipped. A 4:3
   * camera in a 1920x1080 source gets a 1920x1440 iframe and shows its middle
   * 75%, rather than sitting pillarboxed inside a border.
   *
   * Undefined lets vdo.ninja fit the video, which letterboxes if the ratios
   * differ.
   */
  camAspect?: number;
  /** False leaves everything outside the frame transparent, so OBS composites
   *  it over the scene rather than covering it with black. */
  opaque?: boolean;
  /**
   * Scale the feed inside the frame. 1 fits it; above 1 enlarges it and the
   * frame crops the excess.
   *
   * The manual counterpart to `aspect`: rather than declaring the camera's
   * shape, oversize the picture until it covers the opening and let the frame
   * hide what spills — the same thing as dragging a source out past a matte in
   * OBS, except it survives in the URL. Useful when the shape isn't known, or a
   * camera reports one ratio and sends another.
   */
  zoom?: number;
}

export default function CamFrame({ src, name, camAspect, opaque = true, zoom = 1 }: Props) {
  // Cover, computed in CSS so it needs no knowledge of the source's dimensions:
  // take the larger of the frame's own size and the size implied by the other
  // axis at this ratio. Whichever axis is short gets overflowed and clipped.
  const feed = camAspect
    ? {
        width: `max(100vw, ${100 * camAspect}vh)`,
        height: `max(100vh, ${100 / camAspect}vw)`,
      }
    : { width: "100%", height: "100%" };

  const scale = zoom === 1 ? "translate(-50%, -50%)" : `translate(-50%, -50%) scale(${zoom})`;

  return (
    <div
      className={`fixed inset-0 overflow-hidden flex items-center justify-center ${
        opaque ? "bg-black" : ""
      }`}
    >
      <div className="relative overflow-hidden w-full h-full">
        <iframe
          src={src}
          title={name ?? "Camera feed"}
          // Viewing needs autoplay; the rest are here so the same page works if it
          // is ever pointed at a publishing link rather than a view-only one.
          allow="autoplay; camera; microphone; display-capture; fullscreen"
          className="absolute left-1/2 top-1/2 border-0"
          // Centred and clipped by the box, so any overflow — from the cover
          // sizing or from zoom — is cropped evenly on all sides. This is the
          // matte, without needing a matte image.
          style={{ ...feed, transform: scale, transformOrigin: "center" }}
        />

        {/* Everything below is decoration and must never eat a click — OBS does
            not click, but the page is also openable in a browser to check it. */}
        <div className="pointer-events-none absolute inset-0">
          {/* Corners sink into black so the feed's own edges don't end abruptly. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(130% 100% at 50% 50%, transparent 55%, rgba(0,0,0,0.75) 100%)",
            }}
          />

          {/* Hairline containing border */}
          <div className="absolute inset-3 border border-indigo-400/25" />

          {/* Brighter runs along each edge, fading at the ends */}
          <div className="absolute top-3 left-3 right-3 h-px bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 h-px bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent" />
          <div className="absolute left-3 top-3 bottom-3 w-px bg-gradient-to-b from-transparent via-indigo-400/45 to-transparent" />
          <div className="absolute right-3 top-3 bottom-3 w-px bg-gradient-to-b from-transparent via-indigo-400/45 to-transparent" />

          {/* Corner brackets */}
          <div className="absolute top-3 left-3 w-14 h-14 border-t-2 border-l-2 border-indigo-400/80" />
          <div className="absolute top-3 right-3 w-14 h-14 border-t-2 border-r-2 border-indigo-400/80" />
          <div className="absolute bottom-3 left-3 w-14 h-14 border-b-2 border-l-2 border-indigo-400/80" />
          <div className="absolute bottom-3 right-3 w-14 h-14 border-b-2 border-r-2 border-indigo-400/80" />

          <Diamond className="top-3 left-3 -translate-x-1/2 -translate-y-1/2" />
          <Diamond className="top-3 right-3 translate-x-1/2 -translate-y-1/2" />
          <Diamond className="bottom-3 left-3 -translate-x-1/2 translate-y-1/2" />
          <Diamond className="bottom-3 right-3 translate-x-1/2 translate-y-1/2" />

          {/* Ticks at the midpoint of each side */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <div className="w-6 h-px bg-indigo-400/40" />
            <div className="w-[5px] h-[5px] rotate-45 bg-indigo-400/70" />
            <div className="w-6 h-px bg-indigo-400/40" />
          </div>
          <div className="absolute left-3 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5">
            <div className="h-6 w-px bg-indigo-400/40" />
            <div className="w-[5px] h-[5px] rotate-45 bg-indigo-400/70" />
            <div className="h-6 w-px bg-indigo-400/40" />
          </div>
          <div className="absolute right-3 top-1/2 translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5">
            <div className="h-6 w-px bg-indigo-400/40" />
            <div className="w-[5px] h-[5px] rotate-45 bg-indigo-400/70" />
            <div className="h-6 w-px bg-indigo-400/40" />
          </div>

          {/* Nameplate. Sits flush with the bottom of the frame box so the
              border line runs through it — it reads as part of the frame rather
              than a label floating over the picture. Deliberately not centred
              *on* that line with a translate: half the plate would then fall
              outside the box and overflow-hidden clips its lower border and
              corner brackets. */}
          {name && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
              <div className="relative px-8 py-2 flex items-center justify-center">
                <div className="absolute inset-0 bg-slate-950/85" style={{ backdropFilter: "blur(6px)" }} />
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/80 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/80 to-transparent" />
                <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-indigo-400/80" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-indigo-400/80" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-indigo-400/80" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-indigo-400/80" />
                <div className="absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 w-4 h-px bg-indigo-400/40" />
                <div className="absolute top-1/2 right-0 translate-x-full -translate-y-1/2 w-4 h-px bg-indigo-400/40" />
                <span
                  className="relative text-xl leading-none font-semibold tracking-[0.28em] uppercase text-white/90 whitespace-nowrap"
                  style={cinzel}
                >
                  {name}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
