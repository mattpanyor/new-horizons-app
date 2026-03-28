import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import users from "@/data/users.json";
import Navbar from "@/components/Navbar";
import StarSystemBackground from "@/components/StarSystemBackground";
import ShipViewer from "@/components/ship/ShipViewer";
import NavIcon from "@/components/NavIcon";
import shipData from "@/content/ship/graviton.json";
import type { ShipData } from "@/types/ship";

export default async function ShipPage() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;

  if (!username) redirect("/login");

  const user = users.find((u) => u.username === username);
  if (!user) redirect("/login");

  return (
    <>
      <Navbar
        username={user.username}
        character={"character" in user ? user.character : undefined}
        role={"role" in user ? user.role : undefined}
        group={user.group}
        location="Ship"
      />
      <StarSystemBackground />
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
      <ShipViewer ship={shipData as ShipData} />
    </>
  );
}
