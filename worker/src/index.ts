import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verifyFirebaseToken, type TokenUser } from './auth';
import { categoriesRoute } from './routes/categories';
import { usersRoute }     from './routes/users';
import { postsRoute }     from './routes/posts';
import { repliesRoute }   from './routes/replies';

export interface Env {
  DB: D1Database;
  FIREBASE_PROJECT_ID: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: TokenUser | null;
  }
}

const app = new Hono<{ Bindings: Env }>();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use('*', cors({
  origin: (origin) => {
    const allowed = [
      'https://3dprecios.cl',
      'https://www.3dprecios.cl',
      'https://dprecios.web.app',
      'http://localhost:4200',
    ];
    return allowed.includes(origin ?? '') ? origin : '';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));

// ── Auth middleware global (opcional: lee el token si viene) ─────────────────
app.use('*', async (c, next) => {
  const auth = c.req.header('Authorization');
  if (auth?.startsWith('Bearer ')) {
    c.set('user', await verifyFirebaseToken(auth.slice(7), c.env.FIREBASE_PROJECT_ID));
  } else {
    c.set('user', null);
  }
  await next();
});

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.route('/api/forum/categories', categoriesRoute);
app.route('/api/users',            usersRoute);
app.route('/api/forum',            postsRoute);
app.route('/api/forum',            repliesRoute);

app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export default app;
