// MCP tools for the campaign trackers.
//
// Handlers do no policy work of their own — every one delegates to
// lib/campaign/service.ts, the same module the web routes call. A rule changed
// there applies here on the next request, with no edit to this file.
//
// Read-only, by design. Standings and VIP integrity are superadmin-only writes on
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
      "How the party stands with each faction, with the faction's dossier. Each standing is two " +
      "independent counts — red (antagonism) and green (regard), 0-4 each — because a faction can " +
      "resent the party and owe them at the same time. The label comes from whichever side has " +
      "more cells. " +
      LADDER +
      " `description` and `members` come from the campaign's Kanka record and are absent for a " +
      "faction with no record under that name; `members` gives each name the title that faction " +
      "knows them by, and an entityId usable as @[Name](kanka:ID) mention markup. " +
      "Factions the GM has hidden are never returned, at any access level.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    available: (user) => can(user, "standing:read"),
    handler: async (_args, ctx) => {
      // excludeHidden is the point of this call: a hidden faction is a GM
      // secret, and the fact that it is being tracked at all is part of it.
      const result = await listStandingsAs(ctx.user, { excludeHidden: true });
      if (!result.ok) return fromService(result);

      return {
        ok: true,
        // color, logoUrl and hidden are deliberately left off the projection
        // below: the first two are presentation a text client cannot use, and
        // hidden is always false here — excludeHidden filtered those rows out.
        // updatedAt/updatedBy are omitted as noise; add them if a client ever
        // needs to ask what the GM moved recently.
        data: result.data.map((s) => {
          const verdict = standingVerdict(s.red, s.green);
          return {
            slug: s.slug,
            name: s.name,
            // Which of the board's three sections it is dealt into.
            category: s.category,
            red: s.red,
            green: s.green,
            standing: verdict.label,
            // "hostile" | "friendly" | "neutral" — saves the model re-deriving
            // it from the two counts and getting a tie wrong.
            tone: verdict.tone,
            // The dossier the web card opens. Already flattened from Kanka's
            // HTML to plain text by getKankaDossierMap, so it can go straight
            // to a model. Null when Kanka has no record under this name.
            description: s.description,
            // Passed through as the service shapes it: entityId, name, title,
            // kankaUrl. Rolls are a handful of names, so there is nothing to
            // paginate. Empty when the faction has no members or no record.
            members: s.members,
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
  // log is an open board any player can rewrite. Kept off deliberately, and
  // reaffirmed when the standings reader was widened to carry dossiers.
  //
  // A reader would not be free: listVipsAs scopes by canSeeVip, which is right
  // for a player but hands a superadmin token the locked subjects — the same
  // trap hidden factions had. It would need the mirror of excludeHidden on
  // CampaignConstraints before it is safe, which is its own decision.
];

export const campaignModule: ToolModule = {
  scope: "campaign",
  title: "Campaign Trackers",
  description: "Read the party's standing with each faction. Hidden factions are never included.",
  tools,
};
