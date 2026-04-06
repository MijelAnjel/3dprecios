import { Hono } from 'hono';
import type { Env } from '../index';

export const categoriesRoute = new Hono<{ Bindings: Env }>();

// GET /api/forum/categories
categoriesRoute.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM forum_categories ORDER BY sortOrder ASC',
  ).all();
  return c.json(results);
});
