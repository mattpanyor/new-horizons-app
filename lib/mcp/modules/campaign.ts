// MCP tools for the campaign trackers.
//
// Handlers do no policy work of their own — every one delegates to
// lib/campaign/service.ts, the same module the web routes call. A rule changed
// there applies here on the next request, with no edit to this file.
//
// Read-only for now. Standings and VIP integrity are superadmin-only writes on
// the web, and the anonymity log is a shared board where an AI acting on a
// loose instruction could rewrite many players' lines in one turn — the same
// reasoning that put `ownRecordsOnly` on investigation clues. Neither is
// exposed until there is a reason to.

import {
  can,
  listStandingsAs,
  type ServiceResult,
} from "@/lib/campaign/service";
import {
  GREEN_LABELS,
  RED_LABELS,
  NEUTRAL_LABEL,
  TIE_LABEL,
  standingVerdict,
} from "@/lib/campaign/standing";
import type { ToolDef, ToolModule, ToolOutcome } from "../types";

// Bridges a ServiceResult to a ToolOutcome. HTTP status codes mean nothing to
// an MCP client, so only the message survives.
function fromService<T>(result: ServiceResult<T>): ToolOutcome {
  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error };
}

const LADDER =
  `Antagonism runs ${RED_LABELS.join(" -> ")} at one through four red cells; ` +
  `regard runs ${GREEN_LABELS.join(" -> ")} at one through four green. ` +
  `Equal non-zero counts read "${TIE_LABEL}", and no cells at all reads "${NEUTRAL_LABEL}".`;

const tools: ToolDef[] = [
  {
    name: "campaign_list_faction_standings",
    description:
      "How the party stands with each faction. Each standing is two independent counts — red " +
      "(antagonism) and green (regard), 0-4 each — because a faction can resent the party and owe " +
      "them at the same time. The label comes from whichever side has more cells. " +
      LADDER +
      " Factions the GM has hidden are never returned, at any access level.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    available: (user) => can(user, "standing:read"),
    handler: async (_args, ctx) => {
      // excludeHidden is the point of this call: a hidden faction is a GM
      // secret, and the fact that it is being tracked at all is part of it.
      const result = await listStandingsAs(ctx.user, { excludeHidden: true });
      if (!result.ok) return fromService(result);

      return {
        ok: true,
        data: result.data.map((s) => {
          const verdict = standingVerdict(s.red, s.green);
          return {
            slug: s.slug,
            name: s.name,
            red: s.red,
            green: s.green,
            standing: verdict.label,
            // "hostile" | "friendly" | "neutral" — saves the model re-deriving
            // it from the two counts and getting a tie wrong.
            tone: verdict.tone,
          };
        }),
      };
    },
  },

  // Deliberately NOT exposed over MCP:
  //
  // Standing writes. Setting a faction's cells is superadmin-only on the web and
  // is a statement about the story's direction, not bookkeeping. An AI nudging
  // one from "Aligned" to "Trusted" because a conversation sounded positive
  // would be inventing campaign fact.
  //
  // Anything to do with VIPs. Their integrity is what the campaign's survival is
  // measured in, a locked VIP's very existence is a secret, and the anonymity
  // log is an open board any player can rewrite. Reading them over MCP is
  // defensible and worth adding when asked for; it needs its own decision about
  // whether locked subjects are addressable at all, which is not a decision to
  // make in passing while adding a standings reader.
];

export const campaignModule: ToolModule = {
  scope: "campaign",
  title: "Campaign Trackers",
  description: "Read the party's standing with each faction. Hidden factions are never included.",
  tools,
};
