import { redirect } from "next/navigation";
import { requireAccessLevel } from "@/lib/auth";
import { ACCESS } from "@/lib/investigation/service";
import { getHomeScreenArtStatus, presetOptions } from "@/lib/settings/service";
import AppearancePanel from "@/components/admin/AppearancePanel";

export const dynamic = "force-dynamic";

// Navbar, background and the accessLevel >= 66 gate all come from
// app/admin/layout.tsx.
export default async function AdminSettingsPage() {
  const admin = await requireAccessLevel(ACCESS.ADMIN);
  if (!admin) redirect("/sectors");

  const status = await getHomeScreenArtStatus();

  return (
    <main className="flex-1 p-6 flex flex-col gap-10">
      <h1
        className="text-xl text-white/80 tracking-[0.3em] uppercase"
        style={{ fontFamily: "var(--font-cinzel), serif" }}
      >
        Appearance
      </h1>
      <AppearancePanel
        initial={status.stored}
        options={presetOptions()}
        updatedAt={status.row?.updatedAt ?? null}
        updatedBy={status.row?.updatedBy ?? null}
        overriddenBy={status.overriddenBy}
      />
    </main>
  );
}
