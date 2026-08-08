import CamFrame from "@/components/obs/CamFrame";
import { resolveTheme } from "@/components/obs/camFrameThemes";

// A frame for a camera feed, for use as an OBS browser source.
//
//   /obs/cam-frame?name=Malrik
//
// It draws the frame alone, over a transparent page, to be layered above the
// camera source you already have in OBS. Two sources per player, and they have
// to be moved and resized together.
//
//   …&theme=1..6 or a name:
//        1 nexus     the app's own indigo, square
//        2 deco      brass Art Deco — stepped corners, sunburst, cartouche
//        3 sentinel  neon HUD with stepped notches and glow
//        4 tactical  green phosphor gun-camera, scanlines and reticles
//        5 bastion   armoured bulkhead, bolts and hazard stripes
//        6 nostromo  1979 amber CRT, rounded window, rivets
//   …&scale=1.3   the whole frame, bigger or smaller
//   …&namescale=3 the nameplate alone, when the frame is right but the name is small
//   …&bg=black    fill the opening, for looking at a theme in a browser. Never
//                 use this in OBS — it covers the camera.
//
// On `scale`, which is the parameter people actually need: the frame sizes
// itself against the browser source, and knows nothing about what OBS does to
// the source afterwards. Set a source to 1920x1080 and then shrink it to a third
// of the canvas and the frame is shrunk by the same third — a 30px band lands as
// 10px and the name becomes unreadable, with nothing wrong on this side.
//
// Two ways out, and the first is better:
//
//   Set the browser source's width and height to the size it actually occupies
//   on the canvas, so OBS is not scaling it at all. One CSS pixel is then one
//   canvas pixel, and the pixel floors in CamFrame keep the frame legible.
//
//   Or leave the source at 1920x1080 and pass scale= the reciprocal of the
//   shrink. A frame a third of the canvas wide wants scale=3.
//
// Why the feed is a separate source rather than embedded here: vdo.ninja will
// not display inside a cross-origin iframe in this setup. It was tried at
// length — from an HTTPS origin, with autostart, with the autoplay permissions
// set, in OBS and in Safari — and the identical link plays fine as a direct
// browser source while showing nothing when framed. Everything to do with it has
// been removed rather than left behind as dead options; this paragraph is the
// only trace, kept so the idea is not attempted a third time.
//
// No session and no cookies — an OBS browser source has neither, and this shows
// no user data. Nothing here is in the sitemap or linked from the app; it exists
// to be pasted into a browser source.

export const metadata = { robots: { index: false, follow: false } };

export default async function CamFramePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const one = (k: string) => (Array.isArray(q[k]) ? q[k][0] : q[k]) || "";

  const name = one("name") || undefined;
  // Frame size, tuned so 1 suits a source shown at its own pixel size. Raise it
  // when OBS is shrinking the source on the canvas — see the note above, since a
  // frame that looks too thin is almost always this and not the CSS.
  const scaleRaw = Number(one("scale"));
  const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? Math.min(scaleRaw, 4) : 1;
  // The nameplate on its own, for when the frame is right but the name isn't
  // readable. Falls back to scale, so it only exists once you use it.
  const nameRaw = Number(one("namescale"));
  const nameScale =
    Number.isFinite(nameRaw) && nameRaw > 0 ? Math.min(nameRaw, 6) : undefined;
  // Anything unrecognised falls back rather than erroring — a typo in an OBS
  // dialog should still put a frame on screen.
  const theme = resolveTheme(one("theme"));

  return (
    <>
      {/* globals.css gives every page an opaque body, which for an overlay would
          mean covering the very source it sits on. OBS happens to inject
          transparent-body CSS into browser sources by default and so hides the
          problem, but that is a setting the user can clear, and it does not
          apply anywhere else — so the route undoes it itself. */}
      <style>{"html,body{background:transparent !important}"}</style>
      <CamFrame
        name={name}
        opaque={one("bg") === "black"}
        scale={scale}
        nameScale={nameScale}
        theme={theme}
      />
    </>
  );
}
