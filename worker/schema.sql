-- ─────────────────────────────────────────────────────────────────────────────
-- schema.sql  —  dprecios forum (Cloudflare D1 / SQLite)
-- Ejecutar: wrangler d1 execute forum-db --file=./schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  uid         TEXT PRIMARY KEY,
  displayName TEXT NOT NULL,
  photoURL    TEXT,
  role        TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'moderator' | 'admin'
  banned      INTEGER NOT NULL DEFAULT 0,
  createdAt   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS forum_categories (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT '💬',
  postCount   INTEGER NOT NULL DEFAULT 0,
  sortOrder   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS posts (
  id          TEXT PRIMARY KEY,
  categoryId  TEXT NOT NULL REFERENCES forum_categories(id),
  authorId    TEXT NOT NULL REFERENCES users(uid),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  isPinned    INTEGER NOT NULL DEFAULT 0,
  isLocked    INTEGER NOT NULL DEFAULT 0,
  isSolved    INTEGER NOT NULL DEFAULT 0,
  replyCount  INTEGER NOT NULL DEFAULT 0,
  views       INTEGER NOT NULL DEFAULT 0,
  createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt   TEXT,
  lastReplyAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_posts_category_activity
  ON posts(categoryId, isPinned DESC, lastReplyAt DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author
  ON posts(authorId, createdAt DESC);

CREATE TABLE IF NOT EXISTS replies (
  id        TEXT PRIMARY KEY,
  postId    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  authorId  TEXT NOT NULL REFERENCES users(uid),
  body      TEXT NOT NULL,
  likes     INTEGER NOT NULL DEFAULT 0,
  isEdited  INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_replies_post
  ON replies(postId, createdAt ASC);

CREATE TABLE IF NOT EXISTS reply_likes (
  replyId TEXT NOT NULL REFERENCES replies(id) ON DELETE CASCADE,
  userId  TEXT NOT NULL REFERENCES users(uid),
  PRIMARY KEY (replyId, userId)
);

-- ── Categorías iniciales ────────────────────────────────────────────────────
INSERT OR IGNORE INTO forum_categories (id, slug, name, description, icon, sortOrder) VALUES
  ('cat-general',    'general',    'General',    'Discusiones generales sobre impresión 3D', '💬', 1),
  ('cat-filamentos', 'filamentos', 'Filamentos', 'PLA, ABS, PETG, TPU y más',                '🎨', 2),
  ('cat-resinas',    'resinas',    'Resinas',    'Resinas UV, comparativas y experiencias',   '🧪', 3),
  ('cat-impresoras', 'impresoras', 'Impresoras', 'Modelos, configuración y troubleshooting',  '🖨️', 4),
  ('cat-ofertas',    'ofertas',    'Ofertas',    'Promociones y descuentos encontrados',       '🏷️', 5),
  ('cat-proyectos',  'proyectos',  'Proyectos',  'Muestra tus prints y proyectos',            '🏆', 6),
  ('cat-ayuda',      'ayuda',      'Ayuda',      'Preguntas y soporte técnico',               '🆘', 7),
  ('cat-meta',       'meta',       'Meta',       'Sugerencias para 3dprecios.cl',             '⚙️', 8);
