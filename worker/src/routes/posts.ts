import { Hono } from 'hono';
import type { Env } from '../index';

export const postsRoute = new Hono<{ Bindings: Env }>();

const PAGE_SIZE = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getDbUser(db: D1Database, uid: string) {
  return db.prepare('SELECT role, banned FROM users WHERE uid = ?')
    .bind(uid).first<{ role: string; banned: number }>();
}

// ── GET /api/forum/posts?categorySlug=&page= ──────────────────────────────────
postsRoute.get('/posts', async (c) => {
  const categorySlug = c.req.query('categorySlug');
  const page   = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  if (!categorySlug) return c.json({ error: 'categorySlug is required' }, 400);

  const category = await c.env.DB.prepare(
    'SELECT id FROM forum_categories WHERE slug = ?',
  ).bind(categorySlug).first<{ id: string }>();
  if (!category) return c.json({ error: 'Category not found' }, 404);

  const [{ results }, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT p.*, u.displayName AS authorName, u.photoURL AS authorPhoto
      FROM posts p JOIN users u ON p.authorId = u.uid
      WHERE p.categoryId = ?
      ORDER BY p.isPinned DESC, COALESCE(p.lastReplyAt, p.createdAt) DESC
      LIMIT ? OFFSET ?
    `).bind(category.id, PAGE_SIZE, offset).all(),
    c.env.DB.prepare(
      'SELECT COUNT(*) AS count FROM posts WHERE categoryId = ?',
    ).bind(category.id).first<{ count: number }>(),
  ]);

  return c.json({ posts: results, total: countRow?.count ?? 0, page, pageSize: PAGE_SIZE });
});

// ── GET /api/forum/posts/:id ──────────────────────────────────────────────────
postsRoute.get('/posts/:id', async (c) => {
  const id = c.req.param('id');
  const post = await c.env.DB.prepare(`
    SELECT p.*, u.displayName AS authorName, u.photoURL AS authorPhoto
    FROM posts p JOIN users u ON p.authorId = u.uid
    WHERE p.id = ?
  `).bind(id).first();
  if (!post) return c.json({ error: 'Post not found' }, 404);

  // Incrementar vistas de forma asíncrona
  c.executionCtx.waitUntil(
    c.env.DB.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').bind(id).run(),
  );

  return c.json(post);
});

// ── POST /api/forum/posts ─────────────────────────────────────────────────────
postsRoute.post('/posts', async (c) => {
  const tokenUser = c.get('user');
  if (!tokenUser) return c.json({ error: 'Unauthorized' }, 401);

  const dbUser = await getDbUser(c.env.DB, tokenUser.uid);
  if (!dbUser)        return c.json({ error: 'Perfil de usuario no encontrado' }, 403);
  if (dbUser.banned)  return c.json({ error: 'Usuario suspendido' }, 403);

  const body = await c.req.json<{ categoryId: string; title: string; body: string }>();
  const title = body.title?.trim() ?? '';
  const text  = body.body?.trim()  ?? '';

  if (!body.categoryId)                      return c.json({ error: 'categoryId requerido' }, 400);
  if (title.length < 5 || title.length > 200) return c.json({ error: 'Título: 5-200 caracteres' }, 400);
  if (text.length < 20 || text.length > 10000) return c.json({ error: 'Cuerpo: 20-10000 caracteres' }, 400);

  const category = await c.env.DB.prepare(
    'SELECT id FROM forum_categories WHERE id = ?',
  ).bind(body.categoryId).first();
  if (!category) return c.json({ error: 'Categoría no encontrada' }, 404);

  const id  = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO posts (id, categoryId, authorId, title, body, createdAt, lastReplyAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(id, body.categoryId, tokenUser.uid, title, text, now, now),
    c.env.DB.prepare(
      'UPDATE forum_categories SET postCount = postCount + 1 WHERE id = ?',
    ).bind(body.categoryId),
  ]);

  return c.json({ id, categoryId: body.categoryId, authorId: tokenUser.uid, title, body: text, createdAt: now }, 201);
});

// ── PUT /api/forum/posts/:id ──────────────────────────────────────────────────
postsRoute.put('/posts/:id', async (c) => {
  const tokenUser = c.get('user');
  if (!tokenUser) return c.json({ error: 'Unauthorized' }, 401);

  const id   = c.req.param('id');
  const post = await c.env.DB.prepare('SELECT authorId FROM posts WHERE id = ?')
    .bind(id).first<{ authorId: string }>();
  if (!post) return c.json({ error: 'Post no encontrado' }, 404);

  const dbUser  = await getDbUser(c.env.DB, tokenUser.uid);
  const isMod   = ['moderator', 'admin'].includes(dbUser?.role ?? '');
  const isOwner = post.authorId === tokenUser.uid;
  if (!isOwner && !isMod) return c.json({ error: 'Forbidden' }, 403);
  if (dbUser?.banned)     return c.json({ error: 'Usuario suspendido' }, 403);

  const body = await c.req.json<{
    body?: string; isSolved?: boolean; isPinned?: boolean; isLocked?: boolean;
  }>();
  const now = new Date().toISOString();

  if (isOwner && !isMod) {
    const text = body.body?.trim() ?? '';
    if (text.length < 20 || text.length > 10000) return c.json({ error: 'Cuerpo: 20-10000 caracteres' }, 400);
    await c.env.DB.prepare('UPDATE posts SET body = ?, updatedAt = ? WHERE id = ?')
      .bind(text, now, id).run();
  } else {
    // Mod/admin puede editar todos los campos; COALESCE preserva el valor actual si no se envía
    await c.env.DB.prepare(`
      UPDATE posts SET
        body     = COALESCE(?, body),
        isSolved = COALESCE(?, isSolved),
        isPinned = COALESCE(?, isPinned),
        isLocked = COALESCE(?, isLocked),
        updatedAt = ?
      WHERE id = ?
    `).bind(
      body.body?.trim() ?? null,
      body.isSolved != null ? (body.isSolved ? 1 : 0) : null,
      body.isPinned != null ? (body.isPinned ? 1 : 0) : null,
      body.isLocked != null ? (body.isLocked ? 1 : 0) : null,
      now, id,
    ).run();
  }

  return c.json({ id, updatedAt: now });
});

// ── DELETE /api/forum/posts/:id ───────────────────────────────────────────────
postsRoute.delete('/posts/:id', async (c) => {
  const tokenUser = c.get('user');
  if (!tokenUser) return c.json({ error: 'Unauthorized' }, 401);

  const id   = c.req.param('id');
  const post = await c.env.DB.prepare('SELECT authorId, categoryId FROM posts WHERE id = ?')
    .bind(id).first<{ authorId: string; categoryId: string }>();
  if (!post) return c.json({ error: 'Post no encontrado' }, 404);

  const dbUser = await getDbUser(c.env.DB, tokenUser.uid);
  const isMod  = ['moderator', 'admin'].includes(dbUser?.role ?? '');
  if (post.authorId !== tokenUser.uid && !isMod) return c.json({ error: 'Forbidden' }, 403);

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id),
    c.env.DB.prepare(
      'UPDATE forum_categories SET postCount = MAX(0, postCount - 1) WHERE id = ?',
    ).bind(post.categoryId),
  ]);

  return c.json({ deleted: true });
});
