-- Schema for the New Horizons Neon database.
--
-- This file DESCRIBES the live database; it does not migrate it. There is no
-- migrations directory and no runner — DDL is applied by hand, and this file is
-- updated in the same change so the two never drift. Applied migrations are not
-- kept here as comments: `git log -p lib/db/schema.sql` is the history, and it
-- cannot go stale.
--
-- The database this points at is PRODUCTION. See CLAUDE.md before writing to it.

CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(50)  UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,
  "group"    VARCHAR(100) NOT NULL,
  role       VARCHAR(100),
  character  VARCHAR(100),
  access_level INTEGER NOT NULL DEFAULT 0,
  image_url    TEXT,
  color        VARCHAR(7)
);

CREATE TABLE IF NOT EXISTS ship_items (
  id          SERIAL PRIMARY KEY,
  category    VARCHAR(20) NOT NULL CHECK (category IN ('cargo', 'isolation')),
  item_type   VARCHAR(30) NOT NULL CHECK (item_type IN (
    'general', 'ordnance', 'precious', 'contraband', 'mission',
    'biogenic-seed', 'live-specimen', 'cadaver', 'excised-tissue', 'phytosample'
  )),
  name        VARCHAR(255) NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  image_url   TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chapters (
  number  INTEGER PRIMARY KEY,
  title   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clues (
  id            SERIAL PRIMARY KEY,
  chapter       INTEGER NOT NULL REFERENCES chapters(number) ON DELETE CASCADE,
  text          TEXT NOT NULL,
  faction_slugs TEXT[] NOT NULL DEFAULT '{}',
  -- Which real-world game session the clue was discovered in. Free integer,
  -- not managed anywhere: no session table, no sequence, gaps are fine.
  -- Nullable because clues predating the field have no answer.
  session_number INTEGER,
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS clues_chapter_created_at_idx ON clues (chapter, created_at DESC);

-- Story entries: admin-authored narrative pages, categorised by chapter,
-- optionally tagged with a session number, and read via /storybook/[uid].
-- visibility controls the audience:
--   'assigned' — only players listed in assigned_usernames (plus superadmins)
--   'players'  — any logged-in player
--   'world'    — anyone with the link, no login required
CREATE TABLE IF NOT EXISTS story_entries (
  id                 SERIAL PRIMARY KEY,
  uid                TEXT NOT NULL UNIQUE,
  chapter            INTEGER NOT NULL REFERENCES chapters(number) ON DELETE CASCADE,
  session_number     INTEGER,
  title              TEXT NOT NULL,
  body               TEXT NOT NULL DEFAULT '',
  visibility         TEXT NOT NULL DEFAULT 'assigned'
                       CHECK (visibility IN ('assigned', 'players', 'world')),
  assigned_usernames TEXT[] NOT NULL DEFAULT '{}',
  created_by         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS story_entries_chapter_idx ON story_entries (chapter, created_at DESC);

CREATE TABLE IF NOT EXISTS game_sessions (
  id                SERIAL PRIMARY KEY,
  game_type         VARCHAR(50) NOT NULL DEFAULT 'storm-queens-folly',
  status            VARCHAR(20) NOT NULL DEFAULT 'configured'
                    CHECK (status IN ('configured', 'launched', 'finished')),
  config            JSONB NOT NULL DEFAULT '{}',
  state             JSONB NOT NULL DEFAULT '{}',
  designated_player VARCHAR(50),
  winner            VARCHAR(20),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  launched_at       TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ
);

-- ── Map content (sectors, systems, stars, bodies, vortexes, connections, markers) ──
-- See map-migration.md for the full design rationale.

-- Faction slugs, and nothing else.
--
-- This is the anchor the allegiance_slug foreign keys point at — systems,
-- celestial_bodies, markers, faction_standings — not a description of the
-- factions. Who a faction is, its name, colour and crest, lives in
-- lib/allegiances.ts, which the map layers, the clue board, the investigation
-- tools and the campaign trackers all read.
--
-- It carried name/color/logo_url once. Only the trackers ever read them, and
-- the two copies drifted the first time a crest was replaced in one and not the
-- other. Adding a faction is two steps: the entry in lib/allegiances.ts, and a
-- row here so it can be referenced.
CREATE TABLE IF NOT EXISTS allegiances (
  slug VARCHAR(40) PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS biomes (
  slug            VARCHAR(30) PRIMARY KEY,
  label           VARCHAR(60) NOT NULL,
  color           VARCHAR(7)  NOT NULL,
  secondary_color VARCHAR(7)  NOT NULL
);

CREATE TABLE IF NOT EXISTS sectors (
  id           SERIAL PRIMARY KEY,
  slug         VARCHAR(60)  UNIQUE NOT NULL,
  name         VARCHAR(120) NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  color        VARCHAR(7)   NOT NULL,
  nebula_color VARCHAR(7),
  published    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS systems (
  id               SERIAL PRIMARY KEY,
  sector_id        INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  slug             VARCHAR(60) NOT NULL,
  name             VARCHAR(120) NOT NULL,
  x                DOUBLE PRECISION NOT NULL,
  y                DOUBLE PRECISION NOT NULL,
  allegiance_slug  VARCHAR(40) REFERENCES allegiances(slug) ON DELETE SET NULL,
  territory_radius DOUBLE PRECISION,
  center_kind      VARCHAR(20) NOT NULL DEFAULT 'single'
                   CHECK (center_kind IN ('single','binary','pulsar','neutron','black-hole')),
  binary_angle     DOUBLE PRECISION,
  external_url        TEXT,
  published        BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (sector_id, slug)
);
CREATE INDEX IF NOT EXISTS systems_sector_idx ON systems (sector_id);

CREATE TABLE IF NOT EXISTS stars (
  id              SERIAL PRIMARY KEY,
  system_id       INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  role            VARCHAR(10) NOT NULL CHECK (role IN ('primary','secondary')),
  name            VARCHAR(120) NOT NULL,
  fantasy_label   VARCHAR(80),
  color           VARCHAR(7)   NOT NULL,
  secondary_color VARCHAR(7),
  external_url       TEXT,
  UNIQUE (system_id, role)
);

CREATE TABLE IF NOT EXISTS celestial_bodies (
  id                SERIAL PRIMARY KEY,
  system_id         INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  body_id           VARCHAR(40) NOT NULL,
  name              VARCHAR(120) NOT NULL,
  type              VARCHAR(20) NOT NULL CHECK (type IN
    ('planet','station','moon','ship','fleet','asteroid-field','black-hole')),
  biome_slug        VARCHAR(30) REFERENCES biomes(slug) ON DELETE SET NULL,
  lore              TEXT,
  orbit_position    DOUBLE PRECISION NOT NULL,
  orbit_distance    DOUBLE PRECISION NOT NULL,
  label_position    VARCHAR(6) CHECK (label_position IN ('top','bottom')),
  special_attribute VARCHAR(20) CHECK (special_attribute IN
    ('lathanium','nobility','purified','lightbringer','cult','alien_int')),
  allegiance_slug   VARCHAR(40) REFERENCES allegiances(slug) ON DELETE SET NULL,
  external_url         TEXT,
  published         BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (system_id, body_id)
);
CREATE INDEX IF NOT EXISTS bodies_system_idx ON celestial_bodies (system_id);

CREATE TABLE IF NOT EXISTS vortexes (
  id         SERIAL PRIMARY KEY,
  sector_id  INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  slug       VARCHAR(60) NOT NULL,
  name       VARCHAR(120) NOT NULL,
  x          DOUBLE PRECISION NOT NULL,
  y          DOUBLE PRECISION NOT NULL,
  color      VARCHAR(7),
  radius     DOUBLE PRECISION,
  ratio_w    DOUBLE PRECISION,
  ratio_h    DOUBLE PRECISION,
  layer      VARCHAR(20) CHECK (layer IN ('movement','story','conflict','invasion')),
  UNIQUE (sector_id, slug)
);

CREATE TABLE IF NOT EXISTS connections (
  id         SERIAL PRIMARY KEY,
  sector_id  INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  from_slug  VARCHAR(60) NOT NULL,
  to_slug    VARCHAR(60) NOT NULL,
  curvature  DOUBLE PRECISION DEFAULT 0,
  label      VARCHAR(120),
  color      VARCHAR(7),
  dashes     VARCHAR(20),
  opacity    DOUBLE PRECISION,
  layer      VARCHAR(20) CHECK (layer IN ('movement','story','conflict','invasion'))
);
CREATE INDEX IF NOT EXISTS connections_sector_idx ON connections (sector_id);
CREATE INDEX IF NOT EXISTS connections_endpoints_idx ON connections (sector_id, from_slug, to_slug);

CREATE TABLE IF NOT EXISTS markers (
  id               SERIAL PRIMARY KEY,
  sector_id        INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  slug             VARCHAR(60) NOT NULL,
  name             VARCHAR(120) NOT NULL,
  type             VARCHAR(20) NOT NULL CHECK (type IN
    ('ship','fleet','anomaly','poi','black-hole')),
  allegiance_slug  VARCHAR(40) REFERENCES allegiances(slug) ON DELETE SET NULL,
  external_url        TEXT,
  territory_radius DOUBLE PRECISION,
  layer            VARCHAR(20) CHECK (layer IN ('movement','story','conflict','invasion')),
  connection_id    INTEGER REFERENCES connections(id) ON DELETE CASCADE,
  position         DOUBLE PRECISION,
  x                DOUBLE PRECISION,
  y                DOUBLE PRECISION,
  angle            DOUBLE PRECISION,
  UNIQUE (sector_id, slug),
  CHECK (
    (connection_id IS NOT NULL AND position IS NOT NULL AND x IS NULL AND y IS NULL)
    OR
    (connection_id IS NULL AND x IS NOT NULL AND y IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS markers_sector_idx ON markers (sector_id);
-- At most one marker per connection: the render model (ConnectionLine.marker)
-- and the loader (markersByConnection) are singular, so a second marker on the
-- same connection would be silently dropped on read. Enforce it at the DB so
-- writes fail loudly instead. Partial index since free markers have NULL
-- connection_id.
CREATE UNIQUE INDEX IF NOT EXISTS markers_connection_uniq
  ON markers (connection_id) WHERE connection_id IS NOT NULL;

-- MCP access tokens: let an external AI client act as a specific user over the
-- Model Context Protocol endpoint at /api/mcp/server.
--
-- Tokens are issued by an admin in /admin/mcp and handed to the player they
-- belong to, so they are stored twice, for two different jobs:
--
--   token_hash      SHA-256, indexed — authenticates every incoming request.
--                   Not bcrypt: bcrypt is deliberately slow, right for
--                   human-chosen passwords but wrong for a 256-bit random
--                   string checked on every tool call.
--   token_encrypted AES-256-GCM (see lib/mcp/crypto.ts) — lets the admin panel
--                   show the token again to re-send it. Keyed by
--                   MCP_TOKEN_SECRET, which lives in the environment, so a
--                   leaked database alone does not yield usable tokens.
--
-- scopes names which MCP modules the token may use (e.g. '{investigation}').
-- Effective permission is the user's access_level INTERSECT these scopes: the
-- app's own rules set the ceiling, scopes narrow it per token.
--
-- Revocation is a timestamp rather than a DELETE so a revoked token's
-- last_used_at survives for auditing.
CREATE TABLE IF NOT EXISTS mcp_tokens (
  id              SERIAL PRIMARY KEY,
  username        VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  token_encrypted TEXT,
  label           TEXT NOT NULL,
  scopes          TEXT[] NOT NULL DEFAULT '{}',
  issued_by       VARCHAR(50),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS mcp_tokens_hash_idx ON mcp_tokens (token_hash);
CREATE INDEX IF NOT EXISTS mcp_tokens_username_idx ON mcp_tokens (username);

-- kanka_entities — a local read-only mirror of the campaign's Kanka entities,
-- pulled by the sync at /admin/kanka (dev only). Nothing here is authored in
-- this app; the GM's Kanka campaign is the source of truth and every column is
-- overwritten on the next sync.
--
-- entity_id is Kanka's cross-type global id and the real key — `id` is only a
-- surrogate. Everything that references an entity does so by entity_id:
-- messages.kanka_entity_id, vips.kanka_entity_id, and the @[Name](kanka:ID)
-- mention markup stored in clue and story text.
--
-- Note that Kanka ALSO has a type-local id (a character is both character 1043764
-- and entity 4006898). We deliberately do not store it. Its only use is resolving
-- Kanka's own relation payloads, which reference the local id, and the sync
-- resolves those in memory while it holds the full fetch.
--
-- type is the entity KIND ('character', 'location', 'organisation', 'family'),
-- not Kanka's own user-defined type field (NPC, Cult, Nation), which the sync
-- discards. Deliberately left unconstrained: syncing a new Kanka entity type
-- should be one line in the sync route, not a schema change.
--
-- Entities marked private in Kanka are GM-only and are NEVER stored. The read
-- paths have no access-level gate — /api/investigation/mentions serves the whole
-- table to any logged-in player, as does the MCP investigation_search_entities
-- tool — so exclusion at sync time is the only thing keeping GM-only names out
-- of players' hands. Do not add a private row expecting a reader to filter it.
-- entry is the GM's description, stored as the raw HTML Kanka returns, NOT the
-- entry_parsed variant. Parsed bakes in absolute app.kanka.io links; raw keeps
-- Kanka's own [character:123] / [location:456] markup intact so this app can
-- resolve those against entity_id and point them wherever it likes. Note that
-- those bracket ids are entity_ids, while the relation payloads elsewhere in
-- the API use type-local ids — the two id spaces are easy to confuse.
--
-- Being raw HTML from an external system, it is NOT safe to render directly.
-- Nothing renders it today. Whatever eventually does must parse and sanitise
-- rather than dangerouslySetInnerHTML it.
--
-- members holds group membership for organisations and families:
--   [{"entityId": 4006898, "role": "Legate"}, {"entityId": 6135829}]
-- Null for kinds that cannot have members, so an organisation with nobody in
-- it ([]) stays distinguishable from a character (null). `role` is Kanka's
-- free-text title and only organisations have one; families are a bare list.
--
-- A column rather than a join table, matching clues.faction_slugs and
-- mcp_tokens.scopes. The decisive reason is not size (~68 memberships) but
-- staleness: replacing the whole array each sync means a member removed in
-- Kanka simply vanishes, where join rows would need reconciling deletes —
-- exactly the logic that does damage when a fetch half-fails.
--
-- Reverse lookup ("what does this character belong to") is a containment query
-- against the GIN index, not a scan:
--   SELECT * FROM kanka_entities WHERE members @> '[{"entityId": 4006898}]';
--
-- The tradeoff is a polymorphic table: members is meaningless on a character
-- row. Acceptable while this stays a read-only mirror. If membership ever
-- became editable in the app — per-row updated_by, history — it would want to
-- be its own table.
--
-- Every column here is Kanka-owned and blindly overwritten on each sync. This
-- table cannot hold locally-authored data: anything this app owns about an
-- entity belongs in its own table keyed on entity_id.
CREATE TABLE IF NOT EXISTS kanka_entities (
  id         SERIAL PRIMARY KEY,
  entity_id  INTEGER NOT NULL UNIQUE,
  name       VARCHAR(255) NOT NULL,
  type       VARCHAR(50) NOT NULL,
  image_url  TEXT,
  title      VARCHAR(255),
  entry      TEXT,
  members    JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kanka_entities_members_idx
  ON kanka_entities USING GIN (members);

-- app_settings — small, admin-controlled values that change how the app looks
-- or behaves without a deploy.
--
-- Deliberately a key/value table rather than a column per setting: these are
-- single-row, low-traffic, and adding one shouldn't need a migration. Values
-- are TEXT and each setting's own module is responsible for parsing and
-- validating them — a bad value in here must never be able to break a page, so
-- readers fall back to a default rather than trusting the string.
--
-- Keys in use:
--   home_screen_art  which entry of PLANET_PRESETS the login and sectors
--                    background renders. See lib/settings/service.ts.
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(50)
);

-- ── Campaign trackers (/campaign) ────────────────────────────────────────────
-- Bespoke state for this campaign: where the party stands with each faction,
-- and the condition of the VIPs whose deaths would end the campaign.

-- One row per faction the party has a standing with. Every allegiance is shown
-- on the tracker whether or not it has a row here, so a missing row means
-- 0/0 ("Unknown") rather than "not tracked" — the row appears on first edit.
--
-- red and green are independent counts, not two ends of one score: the party
-- can be simultaneously resented and useful to a faction, and 1 red / 2 green
-- is a real state the display must be able to show. The label comes from
-- whichever side has more cells (see lib/campaign/standing.ts), which is why
-- neither can be derived from the other.
--
-- hidden lets a superadmin drop an irrelevant faction off the page without
-- deleting its standing — un-hiding restores the cells as they were.
CREATE TABLE IF NOT EXISTS faction_standings (
  allegiance_slug VARCHAR(40) PRIMARY KEY REFERENCES allegiances(slug) ON DELETE CASCADE,
  red             SMALLINT NOT NULL DEFAULT 0 CHECK (red   BETWEEN 0 AND 4),
  green           SMALLINT NOT NULL DEFAULT 0 CHECK (green BETWEEN 0 AND 4),
  hidden          BOOLEAN  NOT NULL DEFAULT false,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      VARCHAR(50)
);

-- VIPs: campaign-critical NPCs whose survival the campaign depends on. Libra is
-- the one this page was built for, but nothing here is specific to her — a
-- replacement or a second subject is a row, not a code change.
--
-- cells is a 10-bit mask of the integrity honeycomb: bit i set means cell i is
-- intact. A mask rather than a count because the cluster is toggled cell by
-- cell — the GM clicks the one that failed — so which cells are gone is real
-- information a count cannot carry. Integrity is the popcount; see
-- lib/campaign/integrity.ts, which owns every operation on the mask.
--
-- Ten bits is fixed rather than per-VIP: the cluster's 3-4-3 honeycomb is drawn
-- for exactly ten cells, and a different count needs a generated layout, not a
-- column.
--
-- min_access_level gates who sees the VIP at all, using the app's usual scale
-- (0 player, 66 admin, 127 superadmin). A restricted VIP is absent from the
-- tab strip for everyone below the bar, and its anonymity log is unreachable
-- for them too — checked in lib/campaign/service.ts, not just hidden in the UI.
--
-- kanka_entity_id links the portrait and dossier. Nullable: a VIP with no Kanka
-- record still tracks, it just renders from `name` alone.
--
-- tagline is the second half of the panel's eyebrow, after the constant
-- "Unique Asset —". It lives here rather than in the component because what a
-- subject *is* to the campaign differs per subject, while the prefix does not.
-- Empty is valid: the separator is dropped and the eyebrow reads "Unique Asset".
CREATE TABLE IF NOT EXISTS vips (
  slug             VARCHAR(40) PRIMARY KEY,
  name             VARCHAR(120) NOT NULL,
  kanka_entity_id  INTEGER,
  blurb            TEXT NOT NULL DEFAULT '',
  tagline          VARCHAR(80) NOT NULL DEFAULT 'Continuity Critical',
  cells            INTEGER NOT NULL DEFAULT 1023 CHECK (cells BETWEEN 0 AND 1023),
  min_access_level INTEGER NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       VARCHAR(50)
);

-- The anonymity log: who knows a VIP is what they are. One log per VIP.
--   'confirmed' — established in play, someone knows
--   'suspicion' — a guess about who or what might be aware
--
-- Any logged-in player who can see the VIP may add, edit, or delete a line;
-- created_by records who opened it and updated_by who last touched it, so a
-- rewritten line still shows both hands.
--
-- vip_slug cascades: a VIP's log dies with the VIP. It also carries the read
-- gate — a line on a locked VIP is unreachable for anyone below that VIP's
-- min_access_level, enforced in lib/campaign/service.ts rather than by
-- filtering in the UI, so ids cannot be guessed.
CREATE TABLE IF NOT EXISTS anonymity_entries (
  id         SERIAL PRIMARY KEY,
  vip_slug   VARCHAR(40) NOT NULL REFERENCES vips(slug) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('confirmed', 'suspicion')),
  text       TEXT NOT NULL,
  created_by VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(50),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS anonymity_entries_vip_idx
  ON anonymity_entries (vip_slug, kind, created_at);
