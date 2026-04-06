import { Hono } from 'hono';
import type { Env } from '../index';

export const usersRoute = new Hono<{ Bindings: Env }>();

// GET /api/users/:uid  — perfil público
usersRoute.get('/:uid', async (c) => {
  const user = await c.env.DB.prepare(
    'SELECT uid, displayName, photoURL, role, createdAt FROM users WHERE uid = ?',
  ).bind(c.req.param('uid')).first();
  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json(user);
});

// POST /api/users/me  — upsert del propio perfil (requiere auth)
usersRoute.post('/me', async (c) => {
  const tokenUser = c.get('user');
  if (!tokenUser) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json<{ displayName?: string; photoURL?: string | null }>();
  const displayName = (body.displayName ?? tokenUser.name ?? 'Usuario').slice(0, 60);
  const photoURL    = body.photoURL !== undefined ? body.photoURL : (tokenUser.picture ?? null);

  await c.env.DB.prepare(`
    INSERT INTO users (uid, displayName, photoURL)
    VALUES (?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET
      displayName = excluded.displayName,
      photoURL    = excluded.photoURL
  `).bind(tokenUser.uid, displayName, photoURL).run();

  const user = await c.env.DB.prepare(
    'SELECT uid, displayName, photoURL, role, banned, createdAt FROM users WHERE uid = ?',
  ).bind(tokenUser.uid).first();

  return c.json(user);
});
