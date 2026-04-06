# Foro Comunidad 3DPrecios — Diseño Técnico Completo

> Documento de arquitectura para la implementación del foro comunitario.
> Stack: Angular 21 + Firebase Auth + **Cloudflare Workers + D1 (SQLite)** — Zero Cost Real
> Estado: FASE 1 COMPLETADA / FASE 2 EN PROGRESO

---

## 1. Visión General

El foro es una sección al interior de 3DPrecios donde la comunidad de impresión 3D en Chile
puede publicar posts organizados por categorías. Los usuarios se autentican con Google o GitHub
(sin contraseña, sin correo de verificación) y pueden crear posts, responder y reaccionar.

**Principio clave:** arquitectura zero cost real y sostenible a cualquier escala.
- **Firebase Auth**: solo para autenticación (Google + GitHub). Gratis e ilimitado.
- **Cloudflare Workers + D1**: backend del foro (API REST + SQLite). Gratis con 5M lecturas/día.
- **Firebase Hosting**: sirve el frontend Angular. Ya usado para la app.
- Sin Firestore para el foro (demasiado costoso a escala — 50K lecturas/día en Spark).
- Sin media uploads en v1. Solo texto + Markdown.

---

## 2. Presupuesto Zero Cost Real

### Firebase (solo Auth + Hosting + priceAlerts)

| Recurso           | Límite Spark (gratis)        | Uso estimado              |
|-------------------|------------------------------|---------------------------|
| Auth users        | Ilimitado                    | —                         |
| Firestore reads   | 50.000 / día                 | ~500 / día (solo alerts)  |
| Hosting           | 10 GB / mes                  | Ya usado para la app      |

### Cloudflare (Workers + D1)

| Recurso              | Límite Free Tier             | Uso estimado              |
|----------------------|------------------------------|---------------------------|
| D1 reads             | 5.000.000 / día              | ~50.000 / día (1K DAU)    |
| D1 writes            | 100.000 / día                | ~3.000 / día              |
| D1 storage           | 500 MB                       | ~50 MB (texto puro)       |
| Workers requests     | 100.000 / día                | ~50.000 / día             |

> **Conclusión:** Cloudflare D1 soporta 100x más tráfico que Firestore Spark antes de
> generar costo. Sostenible hasta decenas de miles de usuarios activos diarios.

---

## 2. Autenticación

### 2.1 Proveedores habilitados

| Proveedor      | Por qué elegirlo                                 |
|----------------|--------------------------------------------------|
| Google         | Un click, máxima conversión, sin correo          |
| GitHub         | Perfecto para la audiencia tech/maker            |

### 2.2 Flujo de login

```
Usuario hace clic en "Iniciar sesión" (Google/GitHub)
    │
    ▼
Firebase Auth devuelve UserCredential + ID Token (JWT RS256)
    │
    ▼
UserProfileService llama POST /api/users/me
con Authorization: Bearer <idToken>
    │
    ▼
Worker verifica el JWT contra las claves públicas de Firebase
(crypto.subtle — Web Crypto API, sin dependencias)
    │
    ├── Usuario nuevo → INSERT INTO users
    └── Usuario existente → UPDATE displayName, photoURL
    │
    ▼
Worker devuelve el perfil completo (uid, role, banned, etc.)
    │
    ▼
UserProfileService.currentProfile signal actualizado
```

### 2.3 Modelo UserProfile (D1)

```sql
CREATE TABLE users (
  uid         TEXT PRIMARY KEY,
  displayName TEXT NOT NULL,
  photoURL    TEXT,
  role        TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'moderator' | 'admin'
  banned      INTEGER NOT NULL DEFAULT 0,
  createdAt   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 3. Esquema de Datos (D1 / SQLite)

### 3.1 Tablas

```sql
-- Categorías del foro
CREATE TABLE forum_categories (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT '💬',
  postCount   INTEGER NOT NULL DEFAULT 0,
  sortOrder   INTEGER NOT NULL DEFAULT 0
);

-- Posts
CREATE TABLE posts (
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

-- Respuestas
CREATE TABLE replies (
  id        TEXT PRIMARY KEY,
  postId    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  authorId  TEXT NOT NULL REFERENCES users(uid),
  body      TEXT NOT NULL,
  likes     INTEGER NOT NULL DEFAULT 0,
  isEdited  INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT
);

-- Likes de respuestas (tabla de join para toggle atómico)
CREATE TABLE reply_likes (
  replyId TEXT NOT NULL REFERENCES replies(id) ON DELETE CASCADE,
  userId  TEXT NOT NULL REFERENCES users(uid),
  PRIMARY KEY (replyId, userId)
);
```

### 3.2 Categorías iniciales (seed)

| id             | slug        | nombre       | icono |
|----------------|-------------|--------------|-------|
| cat-general    | general     | General      | 💬    |
| cat-filamentos | filamentos  | Filamentos   | 🎨    |
| cat-resinas    | resinas     | Resinas      | 🧪    |
| cat-impresoras | impresoras  | Impresoras   | 🖨️    |
| cat-ofertas    | ofertas     | Ofertas      | 🏷️    |
| cat-proyectos  | proyectos   | Proyectos    | 🏆    |
| cat-ayuda      | ayuda       | Ayuda        | 🆘    |
| cat-meta       | meta        | Meta         | ⚙️    |

---

## 4. API REST (Cloudflare Worker)

Worker URL producción: `https://dprecios-forum.3dprecios.workers.dev`

### 4.1 Endpoints

| Método | Ruta                                    | Auth | Descripción                    |
|--------|-----------------------------------------|------|--------------------------------|
| GET    | `/api/forum/categories`                 | No   | Lista todas las categorías     |
| GET    | `/api/forum/posts?categorySlug=&page=`  | No   | Posts de una categoría (p. 20) |
| GET    | `/api/forum/posts/:id`                  | No   | Post individual (+ views++)    |
| POST   | `/api/forum/posts`                      | Sí   | Crear post                     |
| PUT    | `/api/forum/posts/:id`                  | Sí   | Editar post (autor o mod)      |
| DELETE | `/api/forum/posts/:id`                  | Sí   | Eliminar post (autor o mod)    |
| GET    | `/api/forum/posts/:postId/replies`      | No   | Respuestas de un post (p. 30)  |
| POST   | `/api/forum/posts/:postId/replies`      | Sí   | Crear respuesta                |
| PUT    | `/api/forum/replies/:replyId`           | Sí   | Editar respuesta propia        |
| DELETE | `/api/forum/replies/:replyId`           | Sí   | Eliminar respuesta             |
| POST   | `/api/forum/replies/:replyId/like`      | Sí   | Toggle like en respuesta       |
| GET    | `/api/users/:uid`                       | No   | Perfil público de usuario      |
| POST   | `/api/users/me`                         | Sí   | Upsert perfil propio (login)   |

### 4.2 Autenticación en el Worker

Todas las rutas que requieren auth leen el header `Authorization: Bearer <Firebase ID Token>`.
El Worker verifica el JWT usando **Web Crypto API** (RSA-PKCS1-v1_5 / SHA-256) contra las
claves públicas de Firebase en `googleapis.com/service_accounts/v1/jwk/...` (cacheadas 1h en
el edge de Cloudflare). Sin dependencias externas.

### 4.3 CORS permitidos

- `https://3dprecios.cl`
- `https://www.3dprecios.cl`
- `https://dprecios.web.app`
- `http://localhost:4200`

---

## 5. Arquitectura Angular

### 5.1 Servicios

```
src/app/core/services/
  auth.service.ts          ← Firebase Auth (Google/GitHub login, logout, signals)
  user-profile.service.ts  ← POST /api/users/me al login; signal currentProfile
  forum-api.service.ts     ← Wrapper HTTP de todos los endpoints del Worker
```

### 5.2 Estructura de páginas

```
src/app/pages/forum/        ← lazy loaded desde app.routes.ts
  forum.routes.ts
  forum-home/               ← /foro — lista de categorías
  forum-category/           ← /foro/c/:slug — posts de una categoría
  forum-post/               ← /foro/post/:id — detalle + replies
  new-post/                 ← /foro/nuevo — crear post (authGuard)
```

### 5.3 Rutas

```typescript
// app.routes.ts
{ path: 'foro', loadChildren: () => import('./pages/forum/forum.routes').then(m => m.forumRoutes) }

// forum.routes.ts
{ path: '',         component: ForumHomeComponent }
{ path: 'c/:slug',  component: ForumCategoryComponent }
{ path: 'post/:id', component: ForumPostComponent }
{ path: 'nuevo',    canActivate: [authGuard], component: NewPostComponent }
```

---

## 6. Contratos TypeScript (Modelos)

```typescript
// core/models/index.ts

export interface ForumCategory {
  id:          string;
  slug:        string;
  name:        string;
  description: string;
  icon:        string;
  postCount:   number;
  sortOrder:   number;
}

export interface ForumPost {
  id:          string;
  categoryId:  string;
  authorId:    string;
  authorName:  string;   // denormalizado via JOIN en el Worker
  authorPhoto: string;
  title:       string;
  body:        string;   // Markdown
  isPinned:    boolean;
  isLocked:    boolean;
  isSolved:    boolean;
  replyCount:  number;
  views:       number;
  createdAt:   string;   // ISO date string de SQLite
  updatedAt:   string | null;
  lastReplyAt: string | null;
}

export interface ForumReply {
  id:          string;
  postId:      string;
  authorId:    string;
  authorName:  string;
  authorPhoto: string;
  body:        string;   // Markdown
  likes:       number;
  likedByMe:   boolean;  // añadido por el Worker si hay token
  isEdited:    boolean;
  createdAt:   string;
  updatedAt:   string | null;
}

export interface UserProfile {
  uid:         string;
  displayName: string;
  photoURL:    string;
  role:        'user' | 'moderator' | 'admin';
  createdAt:   Date;
  postCount:   number;
  replyCount:  number;
  banned:      boolean;
}
```

---

## 7. ForumApiService

Wrapper alrededor de `fetch()` que adjunta el Firebase ID Token automáticamente.
No usa RxJS Observables — usa Promises directas para simpleza.

```typescript
class ForumApiService {
  getCategories(): Promise<ForumCategory[]>
  getPosts(categorySlug: string, page?: number): Promise<PostsPage>
  getPost(id: string): Promise<ForumPost>
  createPost(data: { categoryId, title, body }): Promise<ForumPost>
  updatePost(id, data): Promise<{ id, updatedAt }>
  deletePost(id): Promise<{ deleted: boolean }>
  getReplies(postId: string, page?: number): Promise<RepliesPage>
  createReply(postId, body): Promise<ForumReply>
  updateReply(replyId, body): Promise<{ id, updatedAt }>
  deleteReply(replyId): Promise<{ deleted: boolean }>
  toggleLike(replyId): Promise<{ liked: boolean }>
}
```

---

## 8. Seguridad

### 8.1 Validaciones en el Worker

- JWT verificado criptográficamente en cada mutación (no se confía en el cliente)
- `banned=1` bloquea todas las escrituras del usuario
- Validaciones de longitud: title 5-200, body 20-10000, reply 10-5000
- `isPinned`, `isLocked` no editables por usuarios normales (rol admin/mod)
- Ownership verificado en edición/eliminación

### 8.2 Firestore (solo priceAlerts)

Las reglas de Firestore ya no incluyen nada del foro. Solo quedan:
- `/priceAlerts`: acceso restringido al propio usuario
- Catch-all deny para todo lo demás

---

## 9. Markdown

```bash
npm install marked
```

- Tamaño: ~50 KB (lazy loaded dentro del chunk del foro)
- `marked.parse()` para render HTML
- `DomSanitizer.bypassSecurityTrustHtml()` solo para el preview controlado

---

## 10. Anti-Spam y Moderación

- Rate limiting: el Worker devuelve 429 si mismo usuario crea >1 post por minuto (próxima fase)
- Validación de longitudes mínimas evita spam de caracteres únicos
- `banned=1` bloquea todas las escrituras desde el Worker (no depende de Firebase Rules)
- Mod/admin pueden editar `isPinned`, `isLocked`, `role`, `banned` directamente en D1

---

## 11. Fases de Implementación

### ✅ Fase 1 — Autenticación (COMPLETADA)
- Firebase Auth configurado (Google + GitHub)
- `provideAuth` en `app.config.ts`
- `UserProfileService` → POST /api/users/me
- `AuthService` con signals `firebaseUser`, `userProfile`, `isLoggedIn`
- `AuthModalComponent` (modal Google/GitHub)
- `UserAvatarComponent` (header badge)
- `authGuard`
- Header actualizado con Foro link + auth UI

### 🔄 Fase 2 — Forum Backbone (EN PROGRESO)
**Objetivo:** Páginas de listado funcionan. Se pueden leer posts. Sin creación aún.

1. Rutas lazy `/foro`, `/foro/c/:slug`, `/foro/post/:id`, `/foro/nuevo`
2. `ForumHomeComponent` — lista de categorías
3. `ForumCategoryComponent` — lista de posts con paginación
4. `ForumPostComponent` — detalle + replies
5. `NewPostComponent` — formulario (authGuard)

**Entregable:** El foro es navegable aunque vacío.

### ⏳ Fase 3 — Creación de contenido
1. `MarkdownEditorComponent` (tab Escribir/Preview)
2. Formulario nuevo post con validación ReactiveForm
3. Reply form inline al final de los replies
4. Toggle like en replies
5. Editar/eliminar post y reply propio

### ⏳ Fase 4 — UX y Moderación
1. Panel de moderador inline (pin, lock, delete)
2. Marcar post como resuelto
3. Perfil de usuario `/perfil/:uid`
4. Empty states, loading skeletons, error states
5. Links desde product-detail → foro

### ⏳ Fase 5 — SEO
1. Meta tags dinámicos por post (SSR compatible con `fetch()`)
2. Breadcrumbs accesibles
3. Actualizar sitemap.xml con `/foro`

---

## 12. Comandos de Referencia

```bash
# Desplegar Worker (desde /worker)
cd worker && npm run deploy

# Migrar schema a D1 remoto
npx wrangler d1 execute forum-db --remote --file=./schema.sql

# Ejecutar query directa en D1
npx wrangler d1 execute forum-db --remote --command="SELECT * FROM forum_categories"

# Build + deploy Angular
npm run build && firebase deploy --only hosting

# Desplegar reglas Firestore
firebase deploy --only firestore:rules
```

---

## 13. No incluir (decisiones deliberadas)

| Funcionalidad          | Motivo de exclusión                                         |
|------------------------|-------------------------------------------------------------|
| Upload de imágenes     | Requeriría R2 o Storage + moderación de contenido           |
| Notificaciones push    | Requiere FCM Cloud Functions (Blaze Plan)                   |
| Email/Password auth    | Límite de 100 correos/día en Spark Plan                     |
| Voting de posts        | Agrega complejidad; likes de replies son suficientes        |
| Búsqueda full-text     | D1 FTS5 posible en v2; por ahora filtro en cliente          |
| Editor WYSIWYG         | 200–500 KB extra. Markdown con `marked` es suficiente       |
| WebSockets (real-time) | Workers no soporta WS en free tier. Polling si se necesita  |
| Private messages       | Fuera del alcance v1                                        |

