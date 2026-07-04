import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserByUsername, getAllUsers } from "@/lib/db/users";
import { getAllChapters } from "@/lib/db/chapters";
import { getAllStoryEntries } from "@/lib/db/story";
import StoryAdminPanel from "@/components/admin/StoryAdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminStoryPage() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) redirect("/login");

  const user = await getUserByUsername(username);
  if (!user) redirect("/login");
  if (user.accessLevel < 127) redirect("/sectors");

  const [chapters, users, entries] = await Promise.all([
    getAllChapters(),
    getAllUsers(),
    getAllStoryEntries(),
  ]);

  const userOptions = users.map((u) => ({
    username: u.username,
    character: u.character,
    imageUrl: u.imageUrl,
  }));

  return (
    <main className="flex-1 p-6 flex flex-col gap-8">
      <h1
        className="text-xl text-white/80 tracking-[0.3em] uppercase"
        style={{ fontFamily: "var(--font-cinzel), serif" }}
      >
        Storybook
      </h1>
      <StoryAdminPanel chapters={chapters} users={userOptions} initialEntries={entries} />
    </main>
  );
}
