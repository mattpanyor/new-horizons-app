/**
 * Next.js runs this once per server process, before any route is handled — and
 * compiles it for the Edge runtime too, because `proxy.ts` runs there.
 *
 * The Node-only work therefore lives in a separate module imported from inside
 * the positive `NEXT_RUNTIME` check, not after an early return: Next inlines
 * that constant per bundle, so the edge build evaluates the branch to `false`
 * and drops the import entirely. Written as an early-return guard the import
 * survives bundling, and the edge compiler warns that `net` is unsupported.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/instrumentation-node");
  }
}
