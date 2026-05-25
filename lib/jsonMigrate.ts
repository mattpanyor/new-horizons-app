// JSON-key compatibility shim. Map content JSON files (Imperial Core,
// atlas-sector-legacy) still use the legacy `kankaUrl` key. The DB and TS
// types use `externalUrl`. This walker translates `kankaUrl` → `externalUrl`
// in-place on a parsed JSON tree before it's typed as a domain object.
//
// Keep this trivial: the JSON shape isn't a hot path and the data set is small.

export function migrateKankaToExternal(node: unknown): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) migrateKankaToExternal(item);
    return;
  }
  const rec = node as Record<string, unknown>;
  if ("kankaUrl" in rec) {
    rec.externalUrl = rec.kankaUrl;
    delete rec.kankaUrl;
  }
  for (const v of Object.values(rec)) migrateKankaToExternal(v);
}
