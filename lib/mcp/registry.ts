// The module registry: the one place that knows which domains are exposed
// over MCP.
//
// To add a domain (messages, sectors, …): write lib/mcp/modules/<name>.ts
// exporting a ToolModule, then add it to MODULES below. The endpoint, auth, and
// token UI pick it up automatically — the new scope appears as a checkbox when
// minting a token.

import type { User } from "@/lib/db/users";
import { investigationModule } from "./modules/investigation";
import type { ToolDef, ToolModule } from "./types";

export const MODULES: ToolModule[] = [investigationModule];

export interface ScopeInfo {
  scope: string;
  title: string;
  description: string;
}

export function availableScopes(): ScopeInfo[] {
  return MODULES.map((m) => ({ scope: m.scope, title: m.title, description: m.description }));
}

export function isKnownScope(scope: string): boolean {
  return MODULES.some((m) => m.scope === scope);
}

/**
 * The tools a caller may actually use: the intersection of what their token is
 * scoped to and what their access level permits.
 *
 * Tools failing either test are omitted rather than rejected on call, so a
 * player's AI never sees a superadmin tool in the first place.
 */
export function buildToolsFor(user: User, scopes: string[]): ToolDef[] {
  const granted = new Set(scopes);
  return MODULES.filter((m) => granted.has(m.scope))
    .flatMap((m) => m.tools)
    .filter((t) => t.available(user));
}

export function findTool(user: User, scopes: string[], name: string): ToolDef | null {
  return buildToolsFor(user, scopes).find((t) => t.name === name) ?? null;
}
