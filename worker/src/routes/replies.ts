import { Hono } from 'hono';
import type { Env } from '../index';

export const repliesRoute = new Hono<{ Bindings: Env }>();

const PAGE_SIZE = 30;

// ── GET /api/forum/posts/:postId/replies?page= ────────────────────────────────
repliesRoute.get('/posts/:postId/replies', async (c) => {
  const postId = c.req.param('postId');
  const page   = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;
  const tokenUser = c.get('user');

  const post = await c.env.DB.prepare('SELECT id FROM posts WHERE id = ?').bind(postId).first();
  if (!post) return c.json({ error: 'Post no encontrado' }, 404);

  const [{ results }, countRow] = await Promise.all([
    c.env.DB.prepare(`
      SELECT r.*, u.displayName AS authorName, u.photoURL AS authorPhoto
      FROM replies r JOIN users u ON r.authorId = u.uid
      WHERE r.postId = ?
      ORDER BY r.createdAt ASC
      LIMIT ? OFFSET ?
    `).bind(postId, PAGE_SIZE, offset).all(),
    c.env.DB.prepare('SELECT COUNT(*) AS count FROM replies WHERE postId = ?')
      .bind(postId).first<{ count: number }>(),
  ]);

  // Marcar qué replies le dio like el usuario actual
  let likedIds = new Set<string>();
  if (tokenUser && results.length > 0) {
    const ids = (results as { id: string }[]).map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const { results: likes } = await c.env.DB.prepare(
      `SELECT replyId FROM reply_likes WHERE userId = ? AND replyId IN (${placeholders})`,
    ).bind(tokenUser.uid, ...ids).all<{ replyId: string }>();
    likedIds = new Set(likes.map((l) => l.replyId));
  }

  const enriched = (results as (Record<string, unknown> & { id: string })[]).map((r) => ({
    ...r,
    likedByMe: likedIds.has(r.id),
  }));

  return c.json({ replies: enriched, total: countRow?.count ?? 0, page, pageSize: PAGE_SIZE });
});

// ── POST /api/forum/posts/:postId/replies ─────────────────────────────────────
repliesRoute.post('/posts/:postId/replies', async (c) => {
  const tokenUser = c.get('user');
  if (!tokenUser) return c.json({ error: 'Unauthorized' }, 401);

  const postId = c.req.param('postId');
  const [post, dbUser] = await Promise.all([
    c.env.DB.prepare('SELECT isLocked FROM posts WHERE id = ?')
      .bind(postId).first<{ isLocked: number }>(),
    c.env.DB.prepare('SELECT banned FROM users WHERE uid = ?')
      .bind(tokenUser.uid).first<{ banned: number }>(),
  ]);

  if (!post)              return c.json({ error: 'Post no encontrado' }, 404);
  if (post.isLocked)      return c.json({ error: 'El post está cerrado' }, 403);
  if (!dbUser)            return c.json({ error: 'Perfil no encontrado' }, 403);
  if (dbUser.banned)      return c.json({ error: 'Usuario suspendido' }, 403);

  const body = await c.req.json<{ body: string }>();
  const text = body.body?.trim() ?? '';
  if (text.length < 10 || text.length > 5000) {
    return c.json({ error: 'Respuesta: 10-5000 caracteres' }, 400);
  }

  const id  = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO replies (id, postId, authorId, body, createdAt) VALUES (?, ?, ?, ?, ?)',
    ).bind(id, postId, tokenUser.uid, text, now),
    c.env.DB.prepare(
      'UPDATE posts SET replyCount = replyCount + 1, lastReplyAt = ? WHERE id = ?',
    ).bind(now, postId),
  ]);

  return c.json({ id, postId, authorId: tokenUser.uid, body: text, createdAt: now }, 201);
});

// ── PUT /api/forum/replies/:replyId ──────────────────────────────────────────
repliesRoute.put('/replies/:replyId', async (c) => {
  const tokenUser = c.get('user');
  if (!tokenUser) return c.json({ error: 'Unauthorized' }, 401);

  const replyId = c.req.param('replyId');
  const [reply, dbUser] = await Promise.all([
    c.env.DB.prepare('SELECT authorId FROM replies WHERE id = ?')
      .bind(replyId).first<{ authorId: string }>(),
    c.env.DB.prepare('SELECT banned FROM users WHERE uid = ?')
      .bind(tokenUser.uid).first<{ banned: number }>(),
  ]);

  if (!reply)                                return c.json({ error: 'Respuesta no encontrada' }, 404);
  if (reply.authorId !== tokenUser.uid)      return c.json({ error: 'Forbidden' }, 403);
  if (!dbUser || dbUser.banned)              return c.json({ error: 'Usuario suspendido' }, 403);

  const body = await c.req.json<{ body: string }>();
  const text = body.body?.trim() ?? '';
  if (text.length < 10 || text.length > 5000) return c.json({ error: 'Respuesta: 10-5000 caracteres' }, 400);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'UPDATE replies SET body = ?, isEdited = 1, updatedAt = ? WHERE id = ?',
  ).bind(text, now, replyId).run();

  return c.json({ id: replyId, updatedAt: now });
});

// ── DELETE /api/forum/replies/:replyId ────────────────────────────────────────
repliesRoute.delete('/replies/:replyId', async (c) => {
  const tokenUser = c.get('user');
  if (!tokenUser) return c.json({ error: 'Unauthorized' }, 401);

  const replyId = c.req.param('replyId');
  const reply = await c.env.DB.prepare('SELECT authorId, postId FROM replies WHERE id = ?')
    .bind(replyId).first<{ authorId: string; postId: string }>();
  if (!reply) return c.json({ error: 'Respuesta no encontrada' }, 404);

  const dbUser = await c.env.DB.prepare('SELECT role FROM users WHERE uid = ?')
    .bind(tokenUser.uid).first<{ role: string }>();
  const isMod = ['moderator', 'admin'].includes(dbUser?.role ?? '');
  if (reply.authorId !== tokenUser.uid && !isMod) return c.json({ error: 'Forbidden' }, 403);

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM replies WHERE id = ?').bind(replyId),
    c.env.DB.prepare(
      'UPDATE posts SET replyCount = MAX(0, replyCount - 1) WHERE id = ?',
    ).bind(reply.postId),
  ]);

  return c.json({ deleted: true });
});

// ── POST /api/forum/replies/:replyId/like  — toggle ──────────────────────────
repliesRoute.post('/replies/:replyId/like', async (c) => {
  const tokenUser = c.get('user');
  if (!tokenUser) return c.json({ error: 'Unauthorized' }, 401);

  const replyId = c.req.param('replyId');
  const reply = await c.env.DB.prepare('SELECT id FROM replies WHERE id = ?').bind(replyId).first();
  if (!reply) return c.json({ error: 'Respuesta no encontrada' }, 404);

  const existing = await c.env.DB.prepare(
    'SELECT 1 AS found FROM reply_likes WHERE replyId = ? AND userId = ?',
  ).bind(replyId, tokenUser.uid).first<{ found: number }>();

  if (existing) {
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM reply_likes WHERE replyId = ? AND userId = ?')
        .bind(replyId, tokenUser.uid),
      c.env.DB.prepare('UPDATE replies SET likes = MAX(0, likes - 1) WHERE id = ?').bind(replyId),
    ]);
    return c.json({ liked: false });
  } else {
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO reply_likes (replyId, userId) VALUES (?, ?)')
        .bind(replyId, tokenUser.uid),
      c.env.DB.prepare('UPDATE replies SET likes = likes + 1 WHERE id = ?').bind(replyId),
    ]);
    return c.json({ liked: true });
  }
});
