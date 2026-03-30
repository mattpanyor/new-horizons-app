import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.KANKA_API;
  const campaignId = process.env.KANKA_CAMPAIGN_ID;

  const results: Record<string, unknown> = {
    step1_env: {
      hasToken: !!token,
      tokenLength: token?.length ?? 0,
      tokenFirst10: token?.slice(0, 10) ?? null,
      hasCampaignId: !!campaignId,
      campaignId: campaignId ?? null,
    },
  };

  if (!token || !campaignId) {
    results.error = "Missing env vars — stopping here";
    return NextResponse.json(results);
  }

  // Step 2: Test Kanka API connectivity
  try {
    const res = await fetch(`https://api.kanka.io/1.0/campaigns/${campaignId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    results.step2_api_connection = {
      status: res.status,
      ok: res.ok,
    };

    if (res.ok) {
      const json = await res.json();
      results.step2_campaign_name = json.data?.name ?? "unknown";
    } else {
      const text = await res.text();
      results.step2_error_body = text.slice(0, 200);
    }
  } catch (err) {
    results.step2_api_connection = {
      error: String(err),
    };
  }

  // Step 3: Test locations endpoint
  try {
    const res = await fetch(`https://api.kanka.io/1.0/campaigns/${campaignId}/locations?page=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    results.step3_locations = {
      status: res.status,
      ok: res.ok,
    };

    if (res.ok) {
      const json = await res.json();
      results.step3_location_count = json.data?.length ?? 0;
      results.step3_first_location = json.data?.[0]?.name ?? null;
    }
  } catch (err) {
    results.step3_locations = { error: String(err) };
  }

  // Step 4: Test members endpoint
  try {
    const res = await fetch(`https://api.kanka.io/1.0/campaigns/${campaignId}/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    results.step4_members = {
      status: res.status,
      ok: res.ok,
    };

    if (res.ok) {
      const json = await res.json();
      results.step4_member_count = json.data?.length ?? 0;
    }
  } catch (err) {
    results.step4_members = { error: String(err) };
  }

  return NextResponse.json(results, { status: 200 });
}
