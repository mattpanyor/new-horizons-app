"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import PlanetBackground from "@/components/PlanetBackground";
import type { PlanetPresetName } from "@/lib/planetPresets";

// Mounted once in the root layout so the planet survives navigation.
//
// React keeps anything above the changing route segment mounted, so moving the
// canvas here means the WebGL context, the cubemap bake and the surface texture
// all persist from /login to /sectors to /ship — the planet simply keeps turning
// while the page changes around it. Rendered per-page, each navigation threw all
// of that away and paid for a fresh six-frame bake and a texture load.
//
// This only holds for client-side navigation. A hard refresh or a typed URL
// starts over, which is what the fade-in is still for.

/** Routes that show the planet. Everything else renders its own background. */
const SHOWS_ART = ["/login", "/sectors", "/ship"];

function showsArt(pathname: string): boolean {
  // /sectors/[slug] has its own star field, so match the index exactly rather
  // than by prefix.
  return SHOWS_ART.includes(pathname);
}

export default function HomeArtLayer({ preset }: { preset: PlanetPresetName }) {
  const pathname = usePathname();
  const visible = showsArt(pathname ?? "");

  // Mounted on first sight of a route that shows it, and kept from then on.
  // Mounting everywhere would create a WebGL context and pay for a bake on
  // /admin and /game, which never display it — and /game already runs its own
  // three.js context. Mounting only while visible would re-bake on every return
  // trip. This does neither: nothing until it is first needed, then permanent.
  // Adjusted during render rather than in an effect: React re-runs the component
  // immediately without committing, so there is no second paint and no cascading
  // render. An effect here would be the documented anti-pattern.
  const [everVisible, setEverVisible] = useState(visible);
  if (visible && !everVisible) setEverVisible(true);

  if (!everVisible) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 -z-10 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Paused rather than unmounted on routes that don't show it: unmounting
          would drop the context and force a re-bake on the way back, which is
          the whole thing this component exists to avoid. Paused costs a rAF
          callback that returns immediately. */}
      <PlanetBackground preset={preset} inline paused={!visible} />
    </div>
  );
}
