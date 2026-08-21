// MCP tools for the investigation board (chapters and clues).
//
// Handlers do no policy work of their own — every one delegates to
// lib/investigation/service.ts, the same module the web routes call. A rule
// changed there applies here on the next request, with no edit to this file.

import { ALLEGIANCES } from "@/lib/allegiances";
import { getAllKankaEntities, getKankaEntityByEntityId } from "@/lib/db/kankaEntities";
import { kankaEntityUrl } from "@/lib/kanka";
import { parseClueText } from "@/lib/investigation/clueText";
import { CLUE_SEARCH_DEFAULT_LIMIT, CLUE_SEARCH_MAX_LIMIT } from "@/lib/db/clues";
import {
  MAX_CHAPTER_TITLE,
  MAX_CLUE_TEXT,
  MAX_SESSION_NUMBER,
} from "@/lib/investigation/validation";
import {
  can,
  createChapterAs,
  createClueAs,
  deleteClueAs,
  getClueAs,
  listChaptersWithCountsAs,
  renameChapterAs,
  searchCluesAs,
  updateClueAs,
  type ServiceResult,
} from "@/lib/investigation/service";
import type { ToolDef, ToolModule, ToolOutcome } from "../types";

// Bridges a ServiceResult to a ToolOutcome. HTTP status codes mean nothing to
// an MCP client, so only the message survives.
function fromService<T>(result: ServiceResult<T>): ToolOutcome {
  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error };
}

const MENTION_SYNTAX =
  'Mentions of campaign entities use the markup @[Display Name](kanka:ENTITY_ID) inline in the text, ' +
  "which renders as a link to the Kanka campaign. Call investigation_search_entities first to get a " +
  "real entity id — inventing one is rejected.";

/**
 * Rejects text referencing Kanka entities that do not exist. The web composer
 * cannot produce a bad id because it inserts them from a picker; an AI writing
 * raw markup can, and a wrong id renders as a dead link on the board.
 */
async function findUnknownMentions(text: unknown): Promise<number[]> {
  if (typeof text !== "string") return [];
  const ids = Array.from(
    new Set(parseClueText(text).flatMap((t) => (t.kind === "mention" ? [t.entityId] : [])))
  );
  if (ids.length === 0) return [];

  const found = await Promise.all(ids.map((id) => getKankaEntityByEntityId(id)));
  return ids.filter((_, i) => found[i] === null);
}

function mentionError(missing: number[]): ToolOutcome {
  return {
    ok: false,
    error:
      `Unknown Kanka entity id(s): ${missing.join(", ")}. ` +
      "Use investigation_search_entities to look up the correct id, or remove the mention.",
  };
}

const num = (v: unknown): number => Number(v);

const tools: ToolDef[] = [
  {
    name: "investigation_list_chapters",
    description:
      "List every chapter of the investigation with its clue count. Chapters are numbered in order; " +
      "the highest number is the current one.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    available: (user) => can(user, "chapter:read"),
    handler: async (_args, ctx) => fromService(await listChaptersWithCountsAs(ctx.user)),
  },

  {
    name: "investigation_list_clues",
    description:
      "Search and list clues. All filters are optional and combine — omit everything to get the most " +
      "recent clues across all chapters. Clue text may contain @[Name](kanka:ID) mention markup.",
    inputSchema: {
      type: "object",
      properties: {
        chapter: { type: "integer", minimum: 1, description: "Restrict to one chapter number." },
        session: {
          type: "integer",
          minimum: 1,
          maximum: MAX_SESSION_NUMBER,
          description:
            "Restrict to clues discovered in one game session. Clues recorded before this field " +
            "existed have no session number and never match.",
        },
        faction: {
          type: "string",
          description: "Faction slug the clue is tagged with. See investigation_list_factions.",
        },
        author: { type: "string", description: "Username of the clue's author." },
        query: { type: "string", description: "Case-insensitive substring match on the clue text." },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: CLUE_SEARCH_MAX_LIMIT,
          description: `Maximum results (default ${CLUE_SEARCH_DEFAULT_LIMIT}).`,
        },
      },
      additionalProperties: false,
    },
    available: (user) => can(user, "clue:read"),
    handler: async (args, ctx) =>
      fromService(
        await searchCluesAs(ctx.user, {
          chapter: args.chapter === undefined ? undefined : num(args.chapter),
          session: args.session === undefined ? undefined : num(args.session),
          faction: args.faction as string | undefined,
          author: args.author as string | undefined,
          query: args.query as string | undefined,
          limit: args.limit === undefined ? undefined : num(args.limit),
        })
      ),
  },

  {
    name: "investigation_get_clue",
    description:
      "Fetch a single clue by id, with its mentions resolved to names and campaign URLs.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "integer", minimum: 1 } },
      required: ["id"],
      additionalProperties: false,
    },
    available: (user) => can(user, "clue:read"),
    handler: async (args, ctx) => {
      const result = await getClueAs(ctx.user, num(args.id));
      if (!result.ok) return fromService(result);
      const mentions = parseClueText(result.data.text).flatMap((t) =>
        t.kind === "mention" ? [{ name: t.name, entityId: t.entityId, url: t.url }] : []
      );
      return { ok: true, data: { ...result.data, mentions } };
    },
  },

  {
    name: "investigation_list_factions",
    description:
      "List the valid faction slugs for tagging clues. Every clue must be tagged with at least one.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    available: (user) => can(user, "clue:read"),
    handler: async () => ({
      ok: true,
      data: Object.entries(ALLEGIANCES).map(([slug, a]) => ({
        slug,
        name: a.name,
        color: a.color,
      })),
    }),
  },

  {
    name: "investigation_search_entities",
    description:
      "Search campaign entities (characters, locations, organisations) synced from Kanka. Use this to " +
      "get the entity id needed for @[Name](kanka:ID) mention markup in clue text.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Case-insensitive substring of the entity name." },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Default 25." },
      },
      additionalProperties: false,
    },
    available: (user) => can(user, "clue:read"),
    handler: async (args) => {
      const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
      const limit = args.limit === undefined ? 25 : Math.min(Math.max(num(args.limit), 1), 100);

      const all = await getAllKankaEntities();
      const matched = (query ? all.filter((e) => e.name.toLowerCase().includes(query)) : all).slice(
        0,
        limit
      );

      return {
        ok: true,
        data: matched.map((e) => ({
          entityId: e.entityId,
          name: e.name,
          type: e.type,
          url: kankaEntityUrl(e.entityId),
          mentionMarkup: `@[${e.name}](kanka:${e.entityId})`,
        })),
      };
    },
  },

  {
    name: "investigation_create_clue",
    description:
      `Add a clue to the investigation board. Text is limited to ${MAX_CLUE_TEXT} characters and must be ` +
      "tagged with at least one faction. Omit `chapter` to file it under the current (highest) chapter. " +
      "`sessionNumber` is REQUIRED: ask the user which game session the clue was discovered in and use " +
      "the number they give you. Never guess it, never derive it from the chapter number, and never " +
      "copy it from another clue — if the user has not said, ask before calling this tool. " +
      MENTION_SYNTAX,
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", maxLength: MAX_CLUE_TEXT, description: "The clue body." },
        factionSlugs: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Faction slugs from investigation_list_factions.",
        },
        sessionNumber: {
          type: "integer",
          minimum: 1,
          maximum: MAX_SESSION_NUMBER,
          description:
            "The game session this clue was discovered in, as stated by the user. Required. Ask them " +
            "if you do not already know it — do not infer or invent a number.",
        },
        chapter: {
          type: "integer",
          minimum: 1,
          description: "Chapter number. Defaults to the current chapter.",
        },
        author: {
          type: "string",
          description: "Attribute the clue to another user. Superadmin only; defaults to you.",
        },
      },
      required: ["text", "factionSlugs", "sessionNumber"],
      additionalProperties: false,
    },
    available: (user) => can(user, "clue:create"),
    handler: async (args, ctx) => {
      const missing = await findUnknownMentions(args.text);
      if (missing.length > 0) return mentionError(missing);

      // `required` in the schema is a hint a client may not enforce, so the
      // real check is requireSessionNumber in the service layer.
      return fromService(
        await createClueAs(
          ctx.user,
          {
            chapter: args.chapter === undefined ? undefined : num(args.chapter),
            text: args.text,
            factionSlugs: args.factionSlugs,
            sessionNumber: args.sessionNumber,
            author: args.author as string | undefined,
          },
          { requireSessionNumber: true }
        )
      );
    },
  },

  {
    name: "investigation_update_clue",
    description:
      "Edit one of YOUR OWN clues — text, faction tags and/or session number. Pass only the fields " +
      "to change. Unlike creation, `sessionNumber` is optional here: leave it out to keep whatever " +
      "the clue already has, including none at all. " +
      "Clues written by other players cannot be edited through this connection, even by an admin; " +
      "use the web board for that. " +
      MENTION_SYNTAX,
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", minimum: 1 },
        text: { type: "string", maxLength: MAX_CLUE_TEXT },
        factionSlugs: { type: "array", items: { type: "string" }, minItems: 1 },
        sessionNumber: {
          type: ["integer", "null"],
          minimum: 1,
          maximum: MAX_SESSION_NUMBER,
          description:
            "Change the game session this clue was discovered in. Omit to leave it untouched; " +
            "pass null to clear it. Only set this when the user tells you the session.",
        },
        author: {
          type: "string",
          description: "Reassign the clue's author. Superadmin only.",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
    available: (user) => can(user, "clue:update"),
    handler: async (args, ctx) => {
      const missing = await findUnknownMentions(args.text);
      if (missing.length > 0) return mentionError(missing);

      // ownRecordsOnly is an MCP-surface restriction, not an app rule: the web
      // board still lets any player edit any clue. An AI acting on a loose
      // instruction could otherwise rewrite a dozen players' clues in one turn.
      return fromService(
        await updateClueAs(
          ctx.user,
          num(args.id),
          {
            text: args.text,
            factionSlugs: args.factionSlugs,
            sessionNumber: args.sessionNumber,
            author: args.author as string | undefined,
          },
          { ownRecordsOnly: true }
        )
      );
    },
  },

  {
    name: "investigation_delete_clue",
    description: "Permanently delete a clue. This cannot be undone.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "integer", minimum: 1 } },
      required: ["id"],
      additionalProperties: false,
    },
    available: (user) => can(user, "clue:delete"),
    handler: async (args, ctx) => {
      const result = await deleteClueAs(ctx.user, num(args.id));
      return result.ok ? { ok: true, data: { deleted: true } } : fromService(result);
    },
  },

  {
    name: "investigation_create_chapter",
    description:
      "Start a new chapter. It is appended after the highest existing number and becomes the current " +
      "chapter, which is where new clues go by default.",
    inputSchema: {
      type: "object",
      properties: { title: { type: "string", maxLength: MAX_CHAPTER_TITLE } },
      required: ["title"],
      additionalProperties: false,
    },
    available: (user) => can(user, "chapter:create"),
    handler: async (args, ctx) => fromService(await createChapterAs(ctx.user, args.title)),
  },

  {
    name: "investigation_rename_chapter",
    description: "Change a chapter's title. The number is unaffected.",
    inputSchema: {
      type: "object",
      properties: {
        number: { type: "integer", minimum: 1 },
        title: { type: "string", maxLength: MAX_CHAPTER_TITLE },
      },
      required: ["number", "title"],
      additionalProperties: false,
    },
    available: (user) => can(user, "chapter:rename"),
    handler: async (args, ctx) =>
      fromService(await renameChapterAs(ctx.user, num(args.number), args.title)),
  },

  // Deliberately NOT exposed over MCP: investigation_delete_chapter.
  //
  // Deleting a chapter cascades to every clue in it — dozens of records, no
  // undo. The web UI guards that with a type-the-exact-title prompt showing the
  // clue count (components/admin/ChaptersAdminPanel.tsx); an AI tool has no
  // equivalent, since a tool description asking for confirmation is advice the
  // model can reason past, and any programmatic precondition is something it can
  // simply satisfy. Ambiguous phrasing ("clear out the old chapter") should not
  // be able to destroy a chapter's worth of campaign history.
  //
  // deleteChapterAs() still exists in the service layer for the admin route.
  // Chapter deletion is a deliberate, rare act — it belongs in the admin panel.
];

export const investigationModule: ToolModule = {
  scope: "investigation",
  title: "Investigation",
  description: "Read and write the investigation board — chapters, clues, and faction tags.",
  tools,
};
