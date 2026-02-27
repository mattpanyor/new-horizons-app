import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import users from "@/data/users.json";
import WelcomeScreen from "@/components/WelcomeScreen";

export default async function Home() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;

  if (!username) redirect("/login");

  const user = users.find((u) => u.username === username);
  if (!user) redirect("/login");

  return (
    <WelcomeScreen
      username={user.username}
      character={"character" in user ? user.character : undefined}
      role={"role" in user ? user.role : undefined}
      group={user.group}
    />
  );
}
