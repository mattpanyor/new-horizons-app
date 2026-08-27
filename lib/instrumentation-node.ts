import net from "net";

/**
 * Node 20+ dials a host with Happy Eyeballs: it races every address DNS
 * returned and gives each one `autoSelectFamilyAttemptTimeout` — 250ms by
 * default — to finish its TCP handshake. Neon's pooler resolves to three IPv6
 * and three IPv4 addresses; the IPv6 ones are unreachable from here and fail
 * instantly, and a *cold* connect to the IPv4 ones measures ~700ms. Every
 * address therefore blows the 250ms budget, undici collapses the six failures
 * into `AggregateError: ETIMEDOUT`, and the driver surfaces it as
 *
 *   NeonDbError: Error connecting to database: TypeError: fetch failed
 *
 * Warm (keep-alive) connections answer in ~85ms, which is why this looked
 * random: whichever request had to open a fresh socket was the one that blew
 * up, and a handler making several round-trips in a row — the storybook admin
 * save does six — drew that short straw far more often than a single-query
 * endpoint.
 *
 * Raising the per-address budget removes the false timeout without disabling
 * the IPv6→IPv4 fallback, which still happens immediately here (EHOSTUNREACH,
 * not a timeout).
 */
net.setDefaultAutoSelectFamilyAttemptTimeout(5000);
