import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserByUsername } from "@/lib/db/users";
import Navbar from "@/components/Navbar";
import StarSystemBackground from "@/components/StarSystemBackground";
import GamePage from "@/components/game/GamePage";

export default async function GameRoute() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;
  if (!username) redirect("/login");

  const user = await getUserByUsername(username);
  if (!user) redirect("/login");

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
      <GamePage username={user.username} />
    </>
  );
}
