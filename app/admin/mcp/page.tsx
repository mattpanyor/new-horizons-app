import { redirect } from "next/navigation";
import { requireAccessLevel, getSessionUser } from "@/lib/auth";
import { getAllUsers } from "@/lib/db/users";
import { listAllTokensRevealed } from "@/lib/db/mcpTokens";
import { availableScopes } from "@/lib/mcp/registry";
import { isTokenSecretConfigured } from "@/lib/mcp/crypto";
import { ACCESS } from "@/lib/investigation/service";
import Navbar from "@/components/Navbar";
import StarSystemBackground from "@/components/StarSystemBackground";
import McpTokensPanel from "@/components/admin/McpTokensPanel";

export const dynamic = "force-dynamic";

export default async function AdminMcpPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const admin = await requireAccessLevel(ACCESS.ADMIN);
  if (!admin) redirect("/sectors");

  const [users, tokens] = await Promise.all([getAllUsers(), listAllTokensRevealed()]);

  // An admin may only issue tokens for users at or below their own level —
  // otherwise holding the token would grant them the higher access.
  const issuableUsers = users
    .filter((u) => u.accessLevel <= admin.accessLevel)
    .map((u) => ({
      username: u.username,
      character: u.character,
      accessLevel: u.accessLevel,
    }));

  return (
    <>
      <Navbar
        username={admin.username}
        character={admin.character ?? undefined}
        role={admin.role ?? undefined}
        group={admin.group}
        accessLevel={admin.accessLevel}
        imageUrl={admin.imageUrl ?? undefined}
        color={admin.color ?? undefined}
        userId={admin.id}
      />
      <StarSystemBackground />
      <McpTokensPanel
        initialTokens={tokens}
        users={issuableUsers}
        scopes={availableScopes()}
        secretConfigured={isTokenSecretConfigured()}
      />
    </>
  );
}
