import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAllUsers, getUserByUsername } from "@/lib/db/users";
import { getKankaMemberMap } from "@/lib/kanka";
import UsersTable from "@/components/admin/UsersTable";

export default async function AdminUsersPage() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) redirect("/login");

  const currentUser = await getUserByUsername(username);
  if (!currentUser) redirect("/login");

  const users = await getAllUsers(currentUser.accessLevel);

  // Build kanka_id → display name map for pairing verification
  const kankaMembers = await getKankaMemberMap();
  const kankaNames: Record<number, string> = {};
  for (const [id, name] of kankaMembers) {
    kankaNames[id] = name;
  }

  return (
    <main className="flex-1 p-6">
      <h1
        className="text-xl text-white/80 tracking-[0.3em] uppercase mb-6"
        style={{ fontFamily: "var(--font-cinzel), serif" }}
      >
        User Management
      </h1>
      <UsersTable initialUsers={users} canEditAccessLevel={currentUser.accessLevel >= 127} kankaNames={kankaNames} />
    </main>
  );
}
