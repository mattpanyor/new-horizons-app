import { redirect } from "next/navigation";
import { requireAccessLevel } from "@/lib/auth";
import { getAllUsers } from "@/lib/db/users";
import { listAllTokensRevealed } from "@/lib/db/mcpTokens";
import { availableScopes } from "@/lib/mcp/registry";
import { isTokenSecretConfigured } from "@/lib/mcp/crypto";
import { ACCESS } from "@/lib/investigation/service";
import McpTokensPanel from "@/components/admin/McpTokensPanel";

export const dynamic = "force-dynamic";

// Navbar, background and the accessLevel >= 66 gate all come from
// app/admin/layout.tsx. The check below is repeated only because the admin's
// own level decides which users they may issue tokens for.
export default async function AdminMcpPage() {
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
    <main className="flex-1 p-6 flex flex-col gap-10">
      <h1
        className="text-xl text-white/80 tracking-[0.3em] uppercase"
        style={{ fontFamily: "var(--font-cinzel), serif" }}
      >
        MCP Access
      </h1>
      <McpTokensPanel
        initialTokens={tokens}
        users={issuableUsers}
        scopes={availableScopes()}
        secretConfigured={isTokenSecretConfigured()}
      />
    </main>
  );
}
