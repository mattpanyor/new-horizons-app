import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { listTokensForUser } from "@/lib/db/mcpTokens";
import { availableScopes } from "@/lib/mcp/registry";
import Navbar from "@/components/Navbar";
import StarSystemBackground from "@/components/StarSystemBackground";
import TokensPanel from "@/components/mcp/TokensPanel";

export const dynamic = "force-dynamic";

export default async function McpPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const tokens = await listTokensForUser(user.username);

  return (
    <>
      <Navbar
        username={user.username}
        character={user.character ?? undefined}
        role={user.role ?? undefined}
        group={user.group}
        accessLevel={user.accessLevel}
        imageUrl={user.imageUrl ?? undefined}
        color={user.color ?? undefined}
        userId={user.id}
      />
      <StarSystemBackground />
      <TokensPanel
        initialTokens={tokens}
        scopes={availableScopes()}
        username={user.username}
      />
    </>
  );
}
