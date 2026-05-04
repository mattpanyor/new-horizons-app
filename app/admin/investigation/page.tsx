import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserByUsername, getAllUsers } from "@/lib/db/users";
import { getAllChapters, getClueCountByChapter } from "@/lib/db/chapters";
import ChaptersAdminPanel from "@/components/admin/ChaptersAdminPanel";
import CluesAdminPanel from "@/components/admin/CluesAdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminInvestigationPage() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) redirect("/login");

  const user = await getUserByUsername(username);
  if (!user) redirect("/login");
  if (user.accessLevel < 127) redirect("/sectors");

  const [chapters, clueCounts, users] = await Promise.all([
    getAllChapters(),
    getClueCountByChapter(),
    getAllUsers(),
  ]);

  // Trim the user list before sending to the client — picker only needs identity
  const userOptions = users.map((u) => ({
    username: u.username,
    character: u.character,
    imageUrl: u.imageUrl,
  }));

  return (
    <main className="flex-1 p-6 flex flex-col gap-10">
      <h1
        className="text-xl text-white/80 tracking-[0.3em] uppercase"
        style={{ fontFamily: "var(--font-cinzel), serif" }}
      >
        Investigation Settings
      </h1>
      <ChaptersAdminPanel initialChapters={chapters} initialClueCounts={clueCounts} />
      <CluesAdminPanel chapters={chapters} users={userOptions} />
    </main>
  );
}
