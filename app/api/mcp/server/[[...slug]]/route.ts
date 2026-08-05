// The MCP endpoint.
//
// Mounted as a catch-all so it serves both authentication styles:
//   POST /api/mcp/server            with `Authorization: Bearer nhmcp_…`
//   POST /api/mcp/server/t/nhmcp_…  for clients whose only config is a URL
//
// The tool list is per-user: it is built from the caller's token scopes
// intersected with what their access level allows, so the handler must be
// constructed per request rather than once at module scope. That costs an
// object allocation per call and buys the guarantee that a player's AI is never
// even shown a superadmin tool.

import { createMcpHandler } from "mcp-handler";
import { NextResponse, type NextRequest } from "next/server";
import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { buildToolsFor } from "@/lib/mcp/registry";
import { jsonSchema } from "@/lib/mcp/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized: provide a New Horizons MCP token" },
    {
      status: 401,
      headers: {
        ...CORS_HEADERS,
        "WWW-Authenticate": 'Bearer realm="new-horizons"',
      },
    }
  );
}

async function handle(req: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await ctx.params;

  const auth = await authenticateMcpRequest(req, slug);
  if (!auth) return unauthorized();

  const tools = buildToolsFor(auth.user, auth.scopes);

  const handler = createMcpHandler(
    (server) => {
      for (const tool of tools) {
        server.registerTool(
          tool.name,
          {
            description: tool.description,
            inputSchema: jsonSchema(tool.inputSchema),
          },
          async (args: Record<string, unknown>) => {
            const outcome = await tool.handler(args ?? {}, {
              user: auth.user,
              scopes: auth.scopes,
            });

            if (!outcome.ok) {
              return {
                isError: true,
                content: [{ type: "text" as const, text: outcome.error }],
              };
            }
            return {
              content: [
                { type: "text" as const, text: JSON.stringify(outcome.data, null, 2) },
              ],
            };
          }
        );
      }
    },
    {
      serverInfo: { name: "new-horizons", version: "1.0.0" },
      instructions:
        `Connected to the New Horizons campaign companion as "${auth.user.username}". ` +
        "Tools act as that user and are limited to what they can do in the web app.",
    }
  );

  const res = await handler(req);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export { handle as GET, handle as POST, handle as DELETE };
