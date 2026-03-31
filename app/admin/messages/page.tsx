import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserByUsername, getAllUsers } from "@/lib/db/users";
import AdminMessagesPanel from "@/components/admin/AdminMessagesPanel";
import AdminRestricted from "@/components/admin/AdminRestricted";

export default async function AdminMessagesPage() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) redirect("/login");

  const currentUser = await getUserByUsername(username);
  if (!currentUser) redirect("/login");
  if (currentUser.accessLevel < 127) return <AdminRestricted />;

  const users = await getAllUsers();

  return (
    <main className="flex-1 p-3 sm:p-6">
      <h1
        className="text-xl text-white/80 tracking-[0.3em] uppercase mb-6"
        style={{ fontFamily: "var(--font-cinzel), serif" }}
      >
        Messages
      </h1>
      <AdminMessagesPanel users={users} />
    </main>
  );
}
