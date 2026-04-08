import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserByUsername } from "@/lib/db/users";
import Navbar from "@/components/Navbar";
import StarSystemBackground from "@/components/StarSystemBackground";
import DotGridAnimation from "@/components/DotGridAnimation";
import ShipViewer from "@/components/ship/ShipViewer";
import ShipControls from "@/components/ship/ShipControls";
import NavIcon from "@/components/NavIcon";
import shipData from "@/content/ship/graviton.json";
import type { ShipData } from "@/types/ship";

export default async function ShipPage() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;

  if (!username) redirect("/login");

  const user = await getUserByUsername(username);
  if (!user) redirect("/login");

  return (
    <>
      <Navbar
        username={user.username}
        character={user.character ?? undefined}
        role={user.role ?? undefined}
        group={user.group}
        accessLevel={user.accessLevel}
      />
      <StarSystemBackground />
      <DotGridAnimation />
      <NavIcon href="/sectors" label="Galaxy">
        <svg width="64" height="64" viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          {/* Outer halo */}
          <circle cx="48" cy="48" r="42" strokeWidth="0.6" strokeOpacity="0.45" />
          <circle cx="48" cy="48" r="38" strokeWidth="0.5" strokeOpacity="0.25" />
          {/* Spiral arm 1 */}
          <path
            d="M48 10 C30 14, 16 26, 14 42 C12 58, 22 72, 38 78 C48 82, 56 78, 58 68"
            strokeWidth="1" strokeOpacity="0.6" fill="none"
          />
          <path
            d="M48 10 C32 16, 20 28, 18 42 C16 54, 24 66, 36 72"
            strokeWidth="3.5" strokeOpacity="0.12" fill="none"
          />
          {/* Spiral arm 2 */}
          <path
            d="M48 86 C66 82, 80 70, 82 54 C84 38, 74 24, 58 18 C48 14, 40 18, 38 28"
            strokeWidth="1" strokeOpacity="0.6" fill="none"
          />
          <path
            d="M48 86 C64 80, 76 68, 78 54 C80 42, 72 30, 60 24"
            strokeWidth="3.5" strokeOpacity="0.12" fill="none"
          />
          {/* Inner disc */}
          <ellipse cx="48" cy="48" rx="18" ry="9" strokeWidth="0.7" strokeOpacity="0.45" transform="rotate(-25 48 48)" />
          <ellipse cx="48" cy="48" rx="22" ry="10" strokeWidth="0.5" strokeOpacity="0.25" transform="rotate(20 48 48)" />
          {/* Core glow */}
          <circle cx="48" cy="48" r="8" fill="currentColor" fillOpacity="0.12" strokeWidth="0.7" strokeOpacity="0.6" />
          <circle cx="48" cy="48" r="4" fill="currentColor" fillOpacity="0.2" strokeWidth="0.6" strokeOpacity="0.7" />
          <circle cx="48" cy="48" r="1.8" fill="currentColor" fillOpacity="0.5" stroke="none" />
          {/* Star field */}
          <circle cx="24" cy="28" r="1.2" fill="currentColor" fillOpacity="0.7" stroke="none" />
          <circle cx="72" cy="32" r="1.0" fill="currentColor" fillOpacity="0.6" stroke="none" />
          <circle cx="30" cy="68" r="1.1" fill="currentColor" fillOpacity="0.6" stroke="none" />
          <circle cx="68" cy="66" r="1.2" fill="currentColor" fillOpacity="0.7" stroke="none" />
          <circle cx="18" cy="48" r="0.8" fill="currentColor" fillOpacity="0.5" stroke="none" />
          <circle cx="78" cy="48" r="0.8" fill="currentColor" fillOpacity="0.5" stroke="none" />
          <circle cx="36" cy="20" r="0.7" fill="currentColor" fillOpacity="0.45" stroke="none" />
          <circle cx="60" cy="76" r="0.7" fill="currentColor" fillOpacity="0.45" stroke="none" />
          <circle cx="56" cy="22" r="0.6" fill="currentColor" fillOpacity="0.4" stroke="none" />
          <circle cx="38" cy="78" r="0.6" fill="currentColor" fillOpacity="0.4" stroke="none" />
          <circle cx="20" cy="58" r="0.5" fill="currentColor" fillOpacity="0.35" stroke="none" />
          <circle cx="76" cy="40" r="0.5" fill="currentColor" fillOpacity="0.35" stroke="none" />
        </svg>
      </NavIcon>
      <a
        href="/game"
        title="Psychometric Room"
        className="fixed bottom-6 right-3 sm:right-6 md:right-10 z-40 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg border border-white/10 md:border-white/20 text-white/40 md:text-white/60 hover:text-white/70 md:hover:text-white/90 hover:border-white/25 md:hover:border-white/40 hover:bg-white/5 md:hover:bg-white/10 transition-all"
        style={{ backdropFilter: "blur(8px)", background: "rgba(10,10,30,0.5)" }}
      >
        <svg width="32" height="32" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Brain/psychometric symbol — eye with radiating waves */}
          <circle cx="24" cy="24" r="8" strokeOpacity="0.6" />
          <circle cx="24" cy="24" r="3" fill="currentColor" fillOpacity="0.2" strokeOpacity="0.7" />
          <circle cx="24" cy="24" r="1" fill="currentColor" fillOpacity="0.5" stroke="none" />
          {/* Radiating arcs */}
          <path d="M12 24 A12 12 0 0 1 24 12" strokeOpacity="0.3" strokeDasharray="2 3" />
          <path d="M36 24 A12 12 0 0 1 24 36" strokeOpacity="0.3" strokeDasharray="2 3" />
          <path d="M8 24 A16 16 0 0 1 24 8" strokeOpacity="0.15" strokeDasharray="2 4" />
          <path d="M40 24 A16 16 0 0 1 24 40" strokeOpacity="0.15" strokeDasharray="2 4" />
          {/* Top and bottom pulses */}
          <line x1="24" y1="4" x2="24" y2="10" strokeOpacity="0.25" />
          <line x1="24" y1="38" x2="24" y2="44" strokeOpacity="0.25" />
        </svg>
        <span
          className="text-[6px] md:text-[8px] tracking-[0.15em] md:tracking-[0.2em] uppercase"
          style={{ fontFamily: "var(--font-cinzel), serif" }}
        >
          Psychometric Room
        </span>
      </a>
      <ShipControls
        abilities={(shipData as ShipData).abilities ?? []}
        shipName={(shipData as ShipData).name}
        shipClass={(shipData as ShipData).class}
        accessLevel={user.accessLevel}
      />
      <ShipViewer ship={shipData as ShipData} />
    </>
  );
}
