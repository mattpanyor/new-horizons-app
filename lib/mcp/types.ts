// Shared shapes for the MCP tool modules.
//
// A module is one domain of the app — investigation now; messages and possibly
// sectors later. Adding one means writing a file under ./modules and listing it
// in ./registry.ts. Nothing else changes: the endpoint, auth, and token UI are
// module-agnostic.

import type { User } from "@/lib/db/users";

export interface ToolContext {
  user: User;
  scopes: string[];
}

export type ToolOutcome =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export interface ToolDef {
  /** Namespaced, e.g. "investigation_list_clues" — see registry.ts for why. */
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments. */
  inputSchema: Record<string, unknown>;
  /**
   * Whether this user may use the tool. Implementations delegate to the domain
   * layer's `can()` rather than comparing access levels themselves, so a rule
   * change in one place updates both enforcement and advertised tools.
   */
  available: (user: User) => boolean;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolOutcome>;
}

export interface ToolModule {
  /** Token scope name gating the whole module, e.g. "investigation". */
  scope: string;
  title: string;
  description: string;
  tools: ToolDef[];
}
