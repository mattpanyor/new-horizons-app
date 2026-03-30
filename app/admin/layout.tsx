import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserByUsername } from "@/lib/db/users";
import Navbar from "@/components/Navbar";
import StarSystemBackground from "@/components/StarSystemBackground";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;

  if (!username) redirect("/login");

  const user = await getUserByUsername(username);
  if (!user) redirect("/login");

  if (user.accessLevel < 66) redirect("/sectors");

  return (
    <div className="flex flex-col min-h-screen">
      <StarSystemBackground />
      <Navbar
        username={user.username}
        character={user.character ?? undefined}
        role={user.role ?? undefined}
        group={user.group}
        accessLevel={user.accessLevel}
      />
      {children}
    </div>
  );
}
