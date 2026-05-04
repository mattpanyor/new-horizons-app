import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserByUsername, getAllUsers } from "@/lib/db/users";
import { getAllChapters } from "@/lib/db/chapters";
import { getCluesByChapter, getClueCountByUser } from "@/lib/db/clues";
import Navbar from "@/components/Navbar";
import StarSystemBackground from "@/components/StarSystemBackground";
import InvestigationBoard, { type PlayerInfo } from "@/components/investigation/InvestigationBoard";

export const dynamic = "force-dynamic";

export default async function InvestigationPage() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) redirect("/login");
  const user = await getUserByUsername(username);
  if (!user) redirect("/login");

  const chapters = await getAllChapters();
  const initialChapter = chapters.length > 0 ? chapters[chapters.length - 1].number : null;
  const [initialClues, playerTotals, allUsers] = await Promise.all([
    initialChapter !== null ? getCluesByChapter(initialChapter) : Promise.resolve([]),
    getClueCountByUser(),
    getAllUsers(),
  ]);

  // Trim to display info for actual players (not admins/GMs). Anyone whose
  // access level >= 127 is excluded from the player stat list.
  const players: Record<string, PlayerInfo> = {};
  for (const u of allUsers) {
    if (u.accessLevel >= 127) continue;
    const display = (u.character || u.username).trim();
    const firstName = display.split(/\s+/)[0] || u.username;
    players[u.username] = { firstName, imageUrl: u.imageUrl };
  }

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
        currentUsername={user.username}
        initialPlayerTotals={playerTotals}
        players={players}
      />
    </>
  );
}
