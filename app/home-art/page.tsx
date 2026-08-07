import { getHomeScreenArt } from "@/lib/settings/service";
import HomeArtChrome from "./HomeArtChrome";

// The home art on its own, at full bleed, showing whatever theme is currently
// selected.
//
// The page renders almost nothing: the planet is drawn by HomeArtLayer in the
// root layout, which recognises this route and shows the canvas it already
// holds. That keeps one WebGL context for the whole app — arriving here from
// /sectors rebuilds nothing, it just stops drawing the map over it.
//
// Deliberately not behind a session. It shows no user data, and the settings
// read is cached, so this prerenders and is served from the CDN.

export default async function HomeArtPage() {
  return <HomeArtChrome preset={await getHomeScreenArt()} />;
}
