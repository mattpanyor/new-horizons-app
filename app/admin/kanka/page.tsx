import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserByUsername } from "@/lib/db/users";
import KankaSyncPanel from "@/components/admin/KankaSyncPanel";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };
const isDev = process.env.NODE_ENV === "development";

export default async function AdminKankaPage() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) redirect("/login");

  const currentUser = await getUserByUsername(username);
  if (!currentUser) redirect("/login");

  if (!isDev) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-col items-center text-center max-w-md gap-4">
          <h1 className="text-xl text-white/70 tracking-[0.3em] uppercase" style={cinzel}>
            Unavailable
          </h1>
          <p className="text-sm text-white/40 leading-relaxed" style={cinzel}>
            Kanka sync can only be run from a local development server. Start the app with <span className="text-white/60">npm run dev</span> and access this page from there.
          </p>
          <Link
            href="/sectors"
            className="mt-4 px-6 py-2.5 text-xs tracking-[0.3em] uppercase rounded transition-colors"
            style={{
              ...cinzel,
              background: "rgba(99, 102, 241, 0.15)",
              border: "1px solid rgba(99, 102, 241, 0.35)",
              color: "rgba(165, 180, 252, 0.8)",
            }}
          >
            Return to Galactic Map
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-6">
      <h1
        className="text-xl text-white/80 tracking-[0.3em] uppercase mb-6"
        style={cinzel}
      >
        Kanka Sync
      </h1>
      <KankaSyncPanel />
    </main>
  );
}
