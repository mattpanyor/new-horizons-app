import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import users from "@/data/users.json";
import Navbar from "@/components/Navbar";

export default async function SectorsLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;

  if (!username) redirect("/login");

  const user = users.find((u) => u.username === username);
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar
        username={user.username}
        character={"character" in user ? user.character : undefined}
        role={"role" in user ? user.role : undefined}
        group={user.group}
      />
      {children}
    </div>
  );
}
