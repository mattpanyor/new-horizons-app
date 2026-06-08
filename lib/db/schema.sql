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
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS clues_chapter_created_at_idx ON clues (chapter, created_at DESC);

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

-- Migration for existing tables:
-- ALTER TABLE ship_items ADD COLUMN item_type VARCHAR(30);
-- UPDATE ship_items SET item_type = 'general' WHERE category = 'cargo' AND item_type IS NULL;
-- UPDATE ship_items SET item_type = 'live-specimen' WHERE category = 'isolation' AND item_type IS NULL;
-- ALTER TABLE ship_items ALTER COLUMN item_type SET NOT NULL;
-- ALTER TABLE ship_items ADD CONSTRAINT ship_items_item_type_check CHECK (item_type IN (
--   'general', 'ordnance', 'precious', 'contraband', 'mission',
--   'biogenic-seed', 'live-specimen', 'cadaver', 'excised-tissue', 'phytosample'
-- ));

-- ── Map content (sectors, systems, stars, bodies, vortexes, connections, markers) ──
-- See map-migration.md for the full design rationale.

CREATE TABLE IF NOT EXISTS allegiances (
  slug      VARCHAR(40) PRIMARY KEY,
  name      VARCHAR(120) NOT NULL,
  color     VARCHAR(7)   NOT NULL,
  logo_url  TEXT
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
-- connection_id. Migration for an existing DB (dedupe first if needed):
--   CREATE UNIQUE INDEX markers_connection_uniq ON markers (connection_id)
--     WHERE connection_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS markers_connection_uniq
  ON markers (connection_id) WHERE connection_id IS NOT NULL;
