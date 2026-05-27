// Hybrid sector loader: DB-backed by default, with one slug-routed exception.
//   - "imperial-core" → sector metadata from DB, inner content from JSON
// Everything else queries the DB. See map-migration.md §4.

import fs from "fs";
import path from "path";
import type {
  SectorMetadata,
  SystemPin,
  VortexPin,
  MapMarker,
  ConnectionLine,
  LayerSlug,
  MarkerType,
} from "@/types/sector";
import { ALLEGIANCES, type AllegianceKey } from "@/lib/allegiances";
import { migrateKankaToExternal } from "@/lib/jsonMigrate";
import { getSectorRowBySlug, getAllSectorRows } from "@/lib/db/sectors";
import { getSystemsBySector } from "@/lib/db/systems";
import { getVortexesBySector } from "@/lib/db/vortexes";
import { getMarkersBySector, type MarkerRow } from "@/lib/db/markers";
import { getConnectionsBySector } from "@/lib/db/connections";

const sectorsDirectory = path.join(process.cwd(), "content/sectors");
const validAllegiances = new Set(Object.keys(ALLEGIANCES));

// ── JSON path helpers (Imperial Core only) ──

function validateSector(data: SectorMetadata, file: string): void {
  for (const sys of data.systems) {
    if (sys.allegiance && !validAllegiances.has(sys.allegiance)) {
      console.warn(`[sectors] Unknown allegiance "${sys.allegiance}" for system "${sys.slug}" in ${file}`);
    }
  }
  for (const conn of data.connections ?? []) {
    if (conn.marker?.allegiance && !validAllegiances.has(conn.marker.allegiance)) {
      console.warn(`[sectors] Unknown marker allegiance "${conn.marker.allegiance}" in connection ${conn.from}→${conn.to} in ${file}`);
    }
  }
}

function stripHidden(data: SectorMetadata): SectorMetadata {
  const next: SectorMetadata = {
    ...data,
    systems: data.systems.filter((s) => !s.hidden),
  };
  if (data.vortexes) next.vortexes = data.vortexes.filter((v) => !v.hidden);
  if (data.markers) next.markers = data.markers.filter((m) => !m.hidden);
  if (data.connections) {
    next.connections = data.connections
      .filter((c) => !c.hidden)
      .map((c) => {
        if (c.marker?.hidden) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { marker, ...rest } = c;
          return rest;
        }
        return c;
      });
  }
  return next;
}

function loadSectorFromJsonFile(filename: string): SectorMetadata {
  const fullPath = path.join(sectorsDirectory, filename);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Sector JSON not found: ${filename}`);
  }
  const raw = JSON.parse(fs.readFileSync(fullPath, "utf8")) as unknown;
  migrateKankaToExternal(raw);
  const data = raw as SectorMetadata;
  validateSector(data, filename);
  return stripHidden(data);
}

// ── DB path: assemble SectorMetadata shape from rows ──

async function loadSectorFromDb(slug: string): Promise<SectorMetadata | null> {
  const sectorRow = await getSectorRowBySlug(slug);
  if (!sectorRow) return null;

  const [systemRows, vortexRows, markerRows, connectionRows] = await Promise.all([
    getSystemsBySector(sectorRow.id),
    getVortexesBySector(sectorRow.id),
    getMarkersBySector(sectorRow.id),
    getConnectionsBySector(sectorRow.id),
  ]);

  // Partition markers: connection-attached live inside connection.marker, free ones go to sector.markers
  const markersByConnection = new Map<number, MarkerRow>();
  const freeMarkers: MarkerRow[] = [];
  for (const m of markerRows) {
    if (m.connectionId !== null) markersByConnection.set(m.connectionId, m);
    else freeMarkers.push(m);
  }

  // Drop unpublished systems at the loader so they never reach viewers.
  // (Editor-mode reads use the same loader today; if we ever want
  // superadmins to see drafts in edit mode, add a flag here.)
  const systems: SystemPin[] = systemRows
    .filter((s) => s.published !== false)
    .map((s) => {
      const pin: SystemPin = { id: s.id, slug: s.slug, name: s.name, x: s.x, y: s.y };
      if (s.allegianceSlug) pin.allegiance = s.allegianceSlug as AllegianceKey;
      if (s.territoryRadius !== null) pin.territoryRadius = s.territoryRadius;
      return pin;
    });

  const vortexes: VortexPin[] = vortexRows.map((v) => {
    const pin: VortexPin = { id: v.id, slug: v.slug, name: v.name, x: v.x, y: v.y };
    if (v.color) pin.color = v.color;
    if (v.radius !== null) pin.radius = v.radius;
    if (v.ratioW !== null && v.ratioH !== null) pin.ratio = [v.ratioW, v.ratioH];
    if (v.layer) pin.layer = v.layer as LayerSlug;
    return pin;
  });

  const connections: ConnectionLine[] = connectionRows.map((c) => {
    const line: ConnectionLine = { id: c.id, from: c.fromSlug, to: c.toSlug };
    if (c.curvature !== null && c.curvature !== 0) line.curvature = c.curvature;
    if (c.label) line.label = c.label;
    if (c.color) line.color = c.color;
    if (c.dashes) line.dashes = c.dashes;
    if (c.opacity !== null) line.opacity = c.opacity;
    if (c.layer) line.layer = c.layer as LayerSlug;
    const attached = markersByConnection.get(c.id);
    if (attached) {
      const m: MapMarker = {
        id: attached.id,
        connectionId: c.id,
        type: attached.type as MarkerType,
        name: attached.name,
      };
      if (attached.slug) m.slug = attached.slug;
      if (attached.allegianceSlug) m.allegiance = attached.allegianceSlug as AllegianceKey;
      if (attached.externalUrl) m.externalUrl = attached.externalUrl;
      if (attached.position !== null) m.position = attached.position;
      if (attached.territoryRadius !== null) m.territoryRadius = attached.territoryRadius;
      if (attached.layer) m.layer = attached.layer as LayerSlug;
      line.marker = m;
    }
    return line;
  });

  const markers: MapMarker[] = freeMarkers.map((m) => {
    const marker: MapMarker = { id: m.id, type: m.type as MarkerType, name: m.name };
    if (m.slug) marker.slug = m.slug;
    if (m.allegianceSlug) marker.allegiance = m.allegianceSlug as AllegianceKey;
    if (m.externalUrl) marker.externalUrl = m.externalUrl;
    if (m.x !== null) marker.x = m.x;
    if (m.y !== null) marker.y = m.y;
    if (m.angle !== null) marker.angle = m.angle;
    if (m.territoryRadius !== null) marker.territoryRadius = m.territoryRadius;
    if (m.layer) marker.layer = m.layer as LayerSlug;
    return marker;
  });

  const result: SectorMetadata = {
    slug: sectorRow.slug,
    name: sectorRow.name,
    description: sectorRow.description,
    color: sectorRow.color,
    systems,
    published: sectorRow.published,
  };
  if (sectorRow.nebulaColor) result.nebulaColor = sectorRow.nebulaColor;
  if (vortexes.length > 0) result.vortexes = vortexes;
  if (connections.length > 0) result.connections = connections;
  if (markers.length > 0) result.markers = markers;
  return result;
}

// ── Imperial Core: DB metadata + JSON inner content ──

async function loadImperialCore(): Promise<SectorMetadata> {
  const json = loadSectorFromJsonFile("core.json");
  const dbRow = await getSectorRowBySlug("imperial-core");
  if (!dbRow) return json;  // not seeded → JSON-only fallback
  return {
    ...json,
    slug: dbRow.slug,
    name: dbRow.name,
    description: dbRow.description,
    color: dbRow.color,
    nebulaColor: dbRow.nebulaColor ?? json.nebulaColor,
    published: dbRow.published,
  };
}

// ── Public API ──

export async function getSectorBySlug(slug: string): Promise<SectorMetadata> {
  if (slug === "imperial-core") {
    return loadImperialCore();
  }
  const result = await loadSectorFromDb(slug);
  if (!result) throw new Error(`Sector not found: ${slug}`);
  return result;
}

export async function getAllSectors(): Promise<SectorMetadata[]> {
  const rows = await getAllSectorRows();
  const sectors: SectorMetadata[] = [];
  for (const row of rows) {
    if (row.slug === "imperial-core") {
      sectors.push(await loadImperialCore());
    } else {
      const sector = await loadSectorFromDb(row.slug);
      if (sector) sectors.push(sector);
    }
  }
  return sectors;
}

export async function getSectorSlugs(): Promise<string[]> {
  const rows = await getAllSectorRows();
  return rows.map((r) => r.slug);
}
