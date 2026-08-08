import CamFrame from "@/components/obs/CamFrame";

// A framed camera feed, for use as an OBS browser source.
//
//   /obs/cam-frame?name=Malrik&view=gm&room=haviking
//   …&cam=4:3    camera's shape; fills the frame, crops the excess
//   …&zoom=1.15  nudge the feed larger by hand
//   …&bg=none    transparent instead of black behind the feed
//   …&cover=1    experimental: ask vdo.ninja to cover, via injected CSS
//   …&mute=1     mute the feed, which also lifts the browser autoplay gate
//   …&raw=1      embed the vdo.ninja link with nothing added, for bisecting
//
// No session and no cookies — an OBS browser source has neither, and this shows
// no user data. Nothing here is in the sitemap or linked from the app; it exists
// to be pasted into a browser source.

export const metadata = { robots: { index: false, follow: false } };

/**
 * The vdo.ninja URL to embed.
 *
 * Built from parts rather than taking a whole URL, because a vdo.ninja link
 * carries its own `?` and `&` and would have to be percent-encoded to survive
 * as a query value — easy to get wrong by hand in an OBS dialog, and it fails
 * confusingly when you do. `src` is still accepted for anything unusual.
 *
 * One thing is added on our side: `cleanoutput`, without which vdo.ninja draws
 * its own controls and labels inside the frame. Everything else is passed
 * through as given — no audio or quality flags are invented, so a link that
 * already works as a browser source keeps behaving the way it does.
 *
 * Making a non-16:9 camera fill the frame is handled by `cam=` here rather than
 * by anything asked of vdo.ninja. Its video is in a cross-origin iframe, so its
 * dimensions can't be read from this side — hence being told the ratio.
 */
/**
 * Optional: ask vdo.ninja to make its own video element cover its container.
 *
 * Off by default, and that default is the result of it breaking a working feed.
 * The parameter is documented against Social Stream's pages rather than a plain
 * view link, and forcing dimensions on a video whose parent is auto-sized
 * collapses it — the camera vanished entirely. `cam=` below does the same job
 * from this side, deterministically, so this stays available for experiments
 * and nothing depends on it.
 *
 * Only object-fit now: it changes how the picture fills the box it already has
 * and cannot collapse anything, unlike the width/height overrides it replaces.
 */
const COVER_CSS_B64 = Buffer.from(
  encodeURIComponent("video{object-fit:cover!important;}"),
).toString("base64");

function feedUrl(q: Record<string, string | string[] | undefined>): string | null {
  const one = (k: string) => (Array.isArray(q[k]) ? q[k][0] : q[k]) || "";

  const src = one("src");
  if (src) return src;

  const view = one("view");
  if (!view) return null;

  // raw=1 embeds nothing but what you passed — no cleanoutput, no autostart.
  // Purely for bisecting: if the feed appears with this and not without, the
  // problem is one of the params added below rather than the embedding itself.
  const raw = one("raw") === "1";

  const parts = [`view=${encodeURIComponent(view)}`];
  const room = one("room");
  if (room) parts.push(`room=${encodeURIComponent(room)}`);
  // Valueless flags, written by hand: URLSearchParams would render them as
  // `solo=`, and vdo.ninja's flags are presence-checked.
  if (one("solo") !== "0") parts.push("solo");
  if (raw) return `https://vdo.ninja/?${parts.join("&")}`;
  parts.push("cleanoutput");
  // Browsers gate playback behind a user gesture; OBS launches its browser with
  // that gate disabled, which is why the same link plays there and waits for a
  // click anywhere else. autostart asks vdo.ninja to begin on its own.
  parts.push("autostart");
  // Muting removes the gate entirely, since the restriction is really about
  // sound. Opt-in, because in OBS audio may be wanted.
  if (one("mute") === "1") parts.push("muted");
  if (one("cover") === "1") parts.push(`b64css=${encodeURIComponent(COVER_CSS_B64)}`);

  return `https://vdo.ninja/?${parts.join("&")}`;
}

/**
 * The camera's shape, when it differs from the browser source.
 *
 * The frame always fills the source — OBS controls that size, and every source
 * being the same shape is what makes them uniform — so the feed adapts instead:
 * the iframe is sized to the smallest box of this ratio that covers the frame,
 * centred, and the excess is clipped. A 4:3 camera in a 1920x1080 source gets a
 * 1920x1440 iframe and shows its middle 75%.
 *
 * Accepts "16:9", "4:3", "9:16" or a plain number.
 */
function parseAspect(raw: string): number | undefined {
  if (!raw) return undefined;
  const [w, h] = raw.split(":");
  const value = h === undefined ? Number(w) : Number(w) / Number(h);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export default async function CamFramePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const src = feedUrl(q);
  const one = (k: string) => (Array.isArray(q[k]) ? q[k][0] : q[k]) || "";
  const name = one("name") || undefined;
  const camAspect = parseAspect(one("cam"));
  // Black by default: it shows only where the feed doesn't reach, which after
  // covering is nowhere. Transparent lets OBS composite if it ever does.
  const opaque = one("bg") !== "none";
  // Clamped: below 1 would pull the picture off the frame's own edges, and a
  // runaway value in a URL should not blow the feed up to nothing.
  const zoomRaw = Number(one("zoom"));
  const zoom = Number.isFinite(zoomRaw) ? Math.min(Math.max(zoomRaw, 1), 3) : 1;

  if (!src) {
    // Better than a black rectangle in OBS with no clue why.
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center px-8">
        <p
          className="text-sm text-white/50 tracking-[0.2em] uppercase text-center"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          Add ?view=… (and ?room=…) to this URL
        </p>
      </div>
    );
  }

  return <CamFrame src={src} name={name} camAspect={camAspect} opaque={opaque} zoom={zoom} />;
}
