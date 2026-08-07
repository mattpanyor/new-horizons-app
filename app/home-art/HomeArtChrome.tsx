import { PLANET_PRESETS, type PlanetPresetName } from "@/lib/planetPresets";

/**
 * The only thing this page draws.
 *
 * The planet itself comes from the layer in the root layout, which already
 * holds the one WebGL context — mounting another here would put a second one on
 * the page for no reason. So the page's whole job is to be a route the layer
 * recognises, plus the one mark below.
 *
 * The world's name is that mark, faint and cornered. This is a page for
 * looking at the art, so anything drawn over it competes with the thing you came
 * to see — and with no session required there is no app context to navigate back
 * to, so there is no link either.
 */
export default function HomeArtChrome({ preset }: { preset: PlanetPresetName }) {
  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      <span
        className="absolute bottom-5 right-6 text-[10px] tracking-[0.35em] uppercase text-white/25 select-none"
        style={{ fontFamily: "var(--font-cinzel), serif" }}
      >
        {PLANET_PRESETS[preset].label}
      </span>
    </div>
  );
}
