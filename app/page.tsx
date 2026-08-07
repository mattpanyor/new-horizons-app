import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserByUsername } from "@/lib/db/users";

export default async function Home() {
  const cookieStore = await cookies();
  const username = cookieStore.get("nh_user")?.value;

  if (!username) redirect("/login");

  const user = await getUserByUsername(username);
  if (!user) redirect("/login");

  redirect("/sectors");
}
