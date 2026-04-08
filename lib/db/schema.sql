CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(50)  UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,
  "group"    VARCHAR(100) NOT NULL,
  role       VARCHAR(100),
  character  VARCHAR(100),
  access_level INTEGER NOT NULL DEFAULT 0,
  image_url    TEXT
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
