import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  listAnonymityAs,
  listStandingsAs,
  listVipsAs,
} from "@/lib/campaign/service";
import Navbar from "@/components/Navbar";
import CampaignBackground from "@/components/campaign/CampaignBackground";
import CampaignTrackers from "@/components/campaign/CampaignTrackers";

// Every read goes through the service so the page sees exactly what an API
// caller would — including the hidden-faction filter, which depends on who is
// asking.
export const dynamic = "force-dynamic";

export default async function CampaignPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [standings, vips, entries] = await Promise.all([
    listStandingsAs(user),
    listVipsAs(user),
    listAnonymityAs(user),
  ]);

  // A logged-in user passes every read check in the service, so a failure here
  // is a database problem rather than a permission one — let it surface.
  if (!standings.ok || !vips.ok || !entries.ok) {
    throw new Error("Could not load the campaign trackers");
  }

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
      <CampaignBackground />
      <CampaignTrackers
        initialStandings={standings.data}
        initialVips={vips.data}
        initialEntries={entries.data}
        accessLevel={user.accessLevel}
      />
    </>
  );
}
