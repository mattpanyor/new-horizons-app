import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserByUsername } from "@/lib/db/users";
import { getAllChapters } from "@/lib/db/chapters";
import { getCluesByChapter } from "@/lib/db/clues";
import Navbar from "@/components/Navbar";
import StarSystemBackground from "@/components/StarSystemBackground";
import InvestigationBoard from "@/components/investigation/InvestigationBoard";

export const dynamic = "force-dynamic";

export default async function InvestigationPage() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) redirect("/login");
  const user = await getUserByUsername(username);
  if (!user) redirect("/login");

  const chapters = await getAllChapters();
  const initialChapter = chapters.length > 0 ? chapters[chapters.length - 1].number : null;
  const initialClues = initialChapter !== null ? await getCluesByChapter(initialChapter) : [];

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
      <InvestigationBoard
        chapters={chapters}
        initialChapter={initialChapter}
        initialClues={initialClues}
        accessLevel={user.accessLevel}
      />
    </>
  );
}
