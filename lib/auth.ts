// Session helper for route handlers and server components.
//
// The app authenticates with a cookie holding the username, validated against
// the users table on every request. This wraps the read that would otherwise be
// repeated in every route handler.
//
// Only the investigation routes use this so far; the rest of app/api still
// inlines the same three lines.

import { cache } from "react";
import { cookies } from "next/headers";
import { getUserByUsername, type User } from "@/lib/db/users";

export const SESSION_COOKIE = "nh_user";

/**
 * The logged-in user, or null if there is no valid session.
 *
 * Memoised per request. A layout and the page beneath it routinely both want the
 * session — /admin/settings resolved it twice, and each is a database round trip
 * on a serverless Postgres driver. `cache` is per-request, so this changes
 * nothing about freshness across requests.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const username = cookieStore.get(SESSION_COOKIE)?.value;
  if (!username) return null;
  return getUserByUsername(username);
});

/**
 * The logged-in user if they meet a minimum access level, else null.
 *
 * This gates reachability of a whole endpoint — "who is allowed into the admin
 * area" — which is a routing concern. What a user may *do* to a given record is
 * decided by the domain layer (see lib/investigation/service.ts).
 */
export async function requireAccessLevel(level: number): Promise<User | null> {
  const user = await getSessionUser();
  if (!user || user.accessLevel < level) return null;
  return user;
}
