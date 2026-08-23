import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  setVipAccessAs,
  setVipBlurbAs,
  setVipCellAs,
  setVipTaglineAs,
} from "@/lib/campaign/service";

/**
 * Two distinct edits share this endpoint, told apart by the body:
 *   { locked }        lock or unlock the subject
 *   { blurb }         rewrite the description
 *   { tagline }       rewrite the eyebrow's editable half
 *   { cell, intact }  flip one cell of the integrity cluster
 * Both are superadmin-only; the service decides that, not this handler.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await ctx.params;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const result =
    body.locked !== undefined
      ? await setVipAccessAs(user, slug, body.locked)
      : body.blurb !== undefined
        ? await setVipBlurbAs(user, slug, body.blurb)
        : body.tagline !== undefined
          ? await setVipTaglineAs(user, slug, body.tagline)
          : await setVipCellAs(user, slug, { cell: body.cell, intact: body.intact });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ vip: result.data });
}
