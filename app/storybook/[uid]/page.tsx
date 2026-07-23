import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getUserByUsername } from "@/lib/db/users";
import { getStoryEntryByUid } from "@/lib/db/story";
import { parseStoryBody } from "@/lib/story";
import StarSystemBackground from "@/components/StarSystemBackground";
import StoryBook from "@/components/storybook/StoryBook";

export const dynamic = "force-dynamic";

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

export default async function StorybookPage({
  params,
  searchParams,
}: {
  params: Promise<{ uid: string }>;
  searchParams: Promise<{ p?: string | string[] }>;
}) {
  const { uid } = await params;
  const sp = await searchParams;
  const rawP = Array.isArray(sp.p) ? sp.p[0] : sp.p;
  const parsedP = rawP ? parseInt(rawP, 10) : 1;
  const initialSpread = Number.isFinite(parsedP) && parsedP > 0 ? parsedP - 1 : 0;

  // Load the entry first: a 'world' entry is readable without any login, so we
  // must not redirect to /login before we know the entry's visibility.
  const entry = await getStoryEntryByUid(uid);
  if (!entry) notFound();

  let canView = entry.visibility === "world";

  if (!canView) {
    // Every non-'world' entry requires a valid session.
    const cookieStore = await cookies();
    const username = cookieStore.get("nh_user")?.value;
    if (!username) redirect("/login");

    const user = await getUserByUsername(username);
    if (!user) redirect("/login");

    // Superadmins (127+) may open any entry without being assigned.
    canView =
      user.accessLevel >= 127 ||
      entry.visibility === "players" ||
      entry.assignedUsernames.includes(user.username);
  }

  if (!canView) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <StarSystemBackground />
        <div className="relative text-center px-6">
          <p className="text-[11px] tracking-[0.4em] uppercase text-white/40" style={cinzel}>
            Sealed Record
          </p>
          <p className="mt-3 text-white/70 max-w-sm" style={cinzel}>
            This chronicle was not entrusted to you.
          </p>
        </div>
      </div>
    );
  }

  const pages = parseStoryBody(entry.body);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 100% at 50% 0%, #1a140c 0%, #0d0a06 55%, #050403 100%)",
      }}
    >
      <StoryBook
        title={entry.title}
        chapter={entry.chapter}
        chapterTitle={entry.chapterTitle}
        sessionNumber={entry.sessionNumber}
        pages={pages}
        initialSpread={initialSpread}
      />
    </div>
  );
}
