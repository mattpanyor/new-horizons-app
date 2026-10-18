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
// Deliberately not behind a session. It shows no user data. Rendered per
// request for the same reason as /login: as a prerender it kept the theme from
// the last deploy. The settings read is cached, so this is not a database hit.
export const dynamic = "force-dynamic";

export default async function HomeArtPage() {
  return <HomeArtChrome preset={await getHomeScreenArt()} />;
}
