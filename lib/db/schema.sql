CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(50)  UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,
  "group"    VARCHAR(100) NOT NULL,
  role       VARCHAR(100),
  character  VARCHAR(100),
  access_level INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ship_items (
  id          SERIAL PRIMARY KEY,
  category    VARCHAR(20) NOT NULL CHECK (category IN ('cargo', 'isolation')),
  name        VARCHAR(255) NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  image_url   TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
