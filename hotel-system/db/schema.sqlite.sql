-- =============================================================
-- 云栖酒店客房管理系统 —— SQLite 建表脚本（本地免安装运行用）
-- 表结构与 schema.mysql.sql 完全一致，仅做方言适配：
--   AUTO_INCREMENT  -> INTEGER PRIMARY KEY AUTOINCREMENT
--   ENUM            -> TEXT + CHECK 约束
--   DATETIME/DATE   -> TEXT（'YYYY-MM-DD HH:MM:SS' / 'YYYY-MM-DD'）
-- =============================================================

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS room_images;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS room_types;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  real_name   TEXT NOT NULL,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'guest' CHECK (role IN ('admin','guest')),
  vip_level   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE room_types (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  price          REAL NOT NULL,
  capacity       INTEGER NOT NULL DEFAULT 2,
  bed_type       TEXT,
  area           INTEGER,
  cover_img      TEXT,
  intro          TEXT,
  features       TEXT,
  discount_vip1  REAL NOT NULL DEFAULT 0.95,
  discount_vip2  REAL NOT NULL DEFAULT 0.90,
  sort           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE rooms (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  room_no  TEXT NOT NULL UNIQUE,
  type_id  INTEGER NOT NULL REFERENCES room_types(id),
  floor    INTEGER NOT NULL DEFAULT 1,
  status   TEXT NOT NULL DEFAULT 'idle'
           CHECK (status IN ('idle','booked','occupied','cleaning','maintenance'))
);

CREATE TABLE room_images (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  type_id  INTEGER NOT NULL REFERENCES room_types(id),
  url      TEXT NOT NULL,
  caption  TEXT,
  kind     TEXT NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo','panorama')),
  sort     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE bookings (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no       TEXT NOT NULL UNIQUE,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  room_id        INTEGER NOT NULL REFERENCES rooms(id),
  type_id        INTEGER NOT NULL REFERENCES room_types(id),
  check_in       TEXT NOT NULL,
  check_out      TEXT NOT NULL,
  guests         INTEGER NOT NULL DEFAULT 1,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','checked_in','checked_out','cancelled')),
  amount         REAL NOT NULL DEFAULT 0,
  final_amount   REAL,
  remark         TEXT,
  created_at     TEXT NOT NULL,
  checked_in_at  TEXT,
  checked_out_at TEXT
);

CREATE INDEX idx_bookings_room_date ON bookings (room_id, check_in, check_out);
CREATE INDEX idx_bookings_user ON bookings (user_id);
CREATE INDEX idx_bookings_status ON bookings (status);
CREATE INDEX idx_rooms_type ON rooms (type_id);
CREATE INDEX idx_images_type ON room_images (type_id);
