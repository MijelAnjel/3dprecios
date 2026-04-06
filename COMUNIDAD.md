# Foro Comunidad 3DPrecios — Diseño Técnico Completo

> Documento de arquitectura para la implementación del foro comunitario.
> Stack: Angular 21 + Firebase (Auth + Firestore) — Zero Cost (Spark Plan)
> Estado: DISEÑO / NO IMPLEMENTADO

---

## 1. Visión General

El foro es una sección al interior de 3DPrecios donde la comunidad de impresión 3D en Chile
puede publicar posts organizados por categorías. Los usuarios se autentican con Google o GitHub
(sin contraseña, sin correo de verificación) y pueden crear posts, responder y reaccionar.

**Principio clave:** la misma filosofía zero cost del catálogo.
- Sin servidor propio. Sin base de datos pagada.
- Firebase Firestore (Spark Plan) cubre holgadamente el tráfico esperado.
- Sin media uploads en Phase 1. Solo texto + Markdown.

---

## 2. Presupuesto Firebase Spark (Gratuito)

| Recurso           | Límite Spark (gratis)        | Uso estimado comunidad pequeña |
|-------------------|------------------------------|-------------------------------|
| Firestore reads   | 50.000 / día                 | ~3.000 / día (100 DAU)        |
| Firestore writes  | 20.000 / día                 | ~300 / día (50 posts + 250 replies) |
| Firestore deletes | 20.000 / día                 | ~10 / día                     |
| Firestore storage | 1 GiB                        | ~50 MB (texto puro)           |
| Auth users        | Ilimitado                    | —                             |
| Hosting           | 10 GB / mes                  | Ya usado para la app          |

> **Conclusión:** El Spark Plan soporta cómodamente hasta ~500 DAU antes de necesitar Blaze.
> No se requiere Firebase Functions (evita la necesidad de Blaze para llamadas externas).

---

## 3. Autenticación

### 3.1 Proveedores habilitados

| Proveedor      | Por qué elegirlo                                 |
|----------------|--------------------------------------------------|
| Google         | Un click, máxima conversión, sin correo          |
| GitHub         | Perfecto para la audiencia tech/maker            |

Se excluye Email/Password en Phase 1 para evitar el límite de 100 correos de verificación/día
del Spark Plan.

### 3.2 Flujo de primer login

```
Usuario hace clic en "Iniciar sesión" (Google/GitHub)
    │
    ▼
Firebase Auth devuelve UserCredential
    │
    ▼
AuthService verifica si existe doc /users/{uid} en Firestore
    │
    ├── NO existe → crear doc UserProfile (nombre, foto, role: 'user', createdAt)
    │
    └── SÍ existe → cargar perfil al signal userProfile()
```

### 3.3 Modelo UserProfile en Firestore

```
/users/{uid}
  uid:          string
  displayName:  string
  photoURL:     string
  role:         'user' | 'moderator' | 'admin'
  createdAt:    Timestamp
  postCount:    number   ← incrementado por el cliente (no cloud function)
  replyCount:   number
  banned:       boolean  ← default false
```

---

## 4. Esquema de Datos Firestore

### 4.1 Colecciones principales

```
/forumCategories/{categoryId}
/posts/{postId}
/posts/{postId}/replies/{replyId}
/users/{uid}
```

### 4.2 /forumCategories/{categoryId}

```typescript
{
  id:           string;    // 'ayuda-soporte'
  name:         string;    // 'Ayuda y Soporte'
  description:  string;
  icon:         string;    // emoji o nombre de icon
  order:        number;    // para ordenar en UI
  postCount:    number;    // denormalizado
  color:        string;    // hex para badge
}
```

Categorías iniciales:
| id                     | nombre                    | icono |
|------------------------|---------------------------|-------|
| ayuda-soporte          | Ayuda y Soporte           | 🛠️    |
| materiales-filamentos  | Materiales y Filamentos   | 🧵    |
| impresoras             | Impresoras                | 🖨️    |
| proyectos              | Proyectos y Creaciones    | 🎨    |
| compras-precios        | Compras y Precios         | 💰    |
| software-slicer        | Software y Slicers        | 💻    |
| diseno-3d              | Diseño 3D                 | 📐    |
| off-topic              | Off-Topic                 | 💬    |

> Las categorías se guardan en Firestore (no en JSON estático) para poder
> gestionar postCount dinámicamente y permitir agregar categorías sin rebuild.
> Se cachean en memoria por sesión (rara vez cambian).

### 4.3 /posts/{postId}

```typescript
{
  id:             string;    // auto-generated
  title:          string;    // 5–200 chars (validado en reglas)
  body:           string;    // Markdown, 20–10000 chars
  categoryId:     string;
  categoryName:   string;    // denormalizado para evitar join
  authorId:       string;    // uid
  authorName:     string;    // denormalizado
  authorPhotoURL: string;    // denormalizado
  createdAt:      Timestamp;
  updatedAt:      Timestamp;
  lastReplyAt:    Timestamp | null;
  lastReplyBy:    string | null;  // displayName
  replyCount:     number;      // denormalizado
  views:          number;      // incrementado en el cliente
  isPinned:       boolean;
  isLocked:       boolean;
  isSolved:       boolean;     // para posts de ayuda
  tags:           string[];    // max 5 tags, from whitelist
}
```

**Índices compuestos necesarios (firestore.indexes.json):**
```json
[
  { "collectionGroup": "posts", "fields": [
      { "fieldPath": "categoryId",  "order": "ASCENDING" },
      { "fieldPath": "createdAt",   "order": "DESCENDING" }
  ]},
  { "collectionGroup": "posts", "fields": [
      { "fieldPath": "categoryId",  "order": "ASCENDING" },
      { "fieldPath": "lastReplyAt", "order": "DESCENDING" }
  ]},
  { "collectionGroup": "posts", "fields": [
      { "fieldPath": "authorId",    "order": "ASCENDING" },
      { "fieldPath": "createdAt",   "order": "DESCENDING" }
  ]}
]
```

### 4.4 /posts/{postId}/replies/{replyId}

```typescript
{
  id:             string;
  body:           string;    // Markdown, 10–5000 chars
  authorId:       string;
  authorName:     string;
  authorPhotoURL: string;
  createdAt:      Timestamp;
  updatedAt:      Timestamp | null;
  isEdited:       boolean;
  likes:          number;
  likedBy:        string[];  // array de uids (max 500 por límite de array Firestore)
}
```

---

## 5. Reglas de Seguridad Firestore

```javascript
// firestore.rules — reemplazar el contenido actual con esto

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helpers ───────────────────────────────────────────────
    function isSignedIn() {
      return request.auth != null;
    }
    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    function isModOrAdmin() {
      return isSignedIn() && getUserData().role in ['moderator', 'admin'];
    }
    function isNotBanned() {
      return isSignedIn() && getUserData().banned == false;
    }

    // ── /users/{uid} ──────────────────────────────────────────
    match /users/{uid} {
      allow read: if true;
      allow create: if isOwner(uid)
        && request.resource.data.role == 'user'
        && request.resource.data.banned == false;
      allow update: if (isOwner(uid)
          && !request.resource.data.diff(resource.data).affectedKeys()
              .hasAny(['role', 'banned']))
        || isModOrAdmin();
    }

    // ── /forumCategories/{categoryId} ─────────────────────────
    match /forumCategories/{categoryId} {
      allow read: if true;
      allow write: if isModOrAdmin();
    }

    // ── /posts/{postId} ───────────────────────────────────────
    match /posts/{postId} {
      allow read: if true;

      allow create: if isNotBanned()
        && request.resource.data.authorId == request.auth.uid
        && request.resource.data.title.size() >= 5
        && request.resource.data.title.size() <= 200
        && request.resource.data.body.size() >= 20
        && request.resource.data.body.size() <= 10000
        && request.resource.data.isPinned == false
        && request.resource.data.isLocked == false;

      allow update: if
        // Autor puede editar solo el body (no metadatos)
        (isOwner(resource.data.authorId) && isNotBanned()
          && request.resource.data.diff(resource.data).affectedKeys()
              .hasOnly(['body', 'updatedAt', 'isSolved']))
        // Moderadores pueden pinear, bloquear, etc.
        || isModOrAdmin();

      allow delete: if isModOrAdmin();

      // ── Replies ─────────────────────────────────────────────
      match /replies/{replyId} {
        allow read: if true;

        allow create: if isNotBanned()
          && !get(/databases/$(database)/documents/posts/$(postId)).data.isLocked
          && request.resource.data.authorId == request.auth.uid
          && request.resource.data.body.size() >= 10
          && request.resource.data.body.size() <= 5000
          && request.resource.data.likes == 0
          && request.resource.data.likedBy.size() == 0;

        allow update: if
          // Autor edita su respuesta
          (isOwner(resource.data.authorId) && isNotBanned()
            && request.resource.data.diff(resource.data).affectedKeys()
                .hasOnly(['body', 'updatedAt', 'isEdited']))
          // Cualquier usuario autenticado puede dar like (actualiza likes + likedBy)
          || (isNotBanned()
            && request.resource.data.diff(resource.data).affectedKeys()
                .hasOnly(['likes', 'likedBy']))
          || isModOrAdmin();

        allow delete: if isOwner(resource.data.authorId) || isModOrAdmin();
      }
    }
  }
}
```

---

## 6. Arquitectura Angular

### 6.1 Estructura de archivos

```
src/app/
├── core/
│   ├── models/
│   │   └── index.ts               ← agregar ForumPost, Reply, UserProfile, ForumCategory
│   ├── services/
│   │   ├── auth.service.ts        ← NUEVO
│   │   ├── forum.service.ts       ← NUEVO
│   │   └── user-profile.service.ts ← NUEVO
│   └── guards/
│       └── auth.guard.ts          ← NUEVO
│
├── pages/
│   └── forum/                     ← NUEVO (lazy loaded)
│       ├── forum.routes.ts        ← child routes
│       ├── forum-home/            ← lista de categorías + posts recientes
│       ├── forum-category/        ← posts de una categoría
│       ├── forum-post/            ← post + replies
│       └── new-post/              ← form de creación (ruta protegida)
│
└── shared/
    └── components/
        ├── auth-modal/            ← NUEVO — modal de login (Google/GitHub)
        ├── user-avatar/           ← NUEVO — avatar + nombre de usuario
        └── markdown-editor/       ← NUEVO — textarea + preview
```

### 6.2 Rutas (lazy loading)

```typescript
// app.routes.ts — agregar:
{
  path: 'foro',
  loadChildren: () =>
    import('./pages/forum/forum.routes').then(m => m.forumRoutes)
}
```

```typescript
// pages/forum/forum.routes.ts
export const forumRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./forum-home/forum-home.component').then(m => m.ForumHomeComponent),
    title: 'Foro Comunidad — 3DPrecios'
  },
  {
    path: 'c/:slug',
    loadComponent: () =>
      import('./forum-category/forum-category.component').then(m => m.ForumCategoryComponent)
  },
  {
    path: 'post/:id',
    loadComponent: () =>
      import('./forum-post/forum-post.component').then(m => m.ForumPostComponent)
  },
  {
    path: 'nuevo',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./new-post/new-post.component').then(m => m.NewPostComponent),
    title: 'Nuevo Post — Foro 3DPrecios'
  }
];
```

---

## 7. Contratos TypeScript (Modelos)

```typescript
// Agregar a core/models/index.ts

export interface ForumCategory {
  id:          string;
  name:        string;
  description: string;
  icon:        string;
  order:       number;
  postCount:   number;
  color:       string;
}

export interface ForumPost {
  id:             string;
  title:          string;
  body:           string;       // Markdown
  categoryId:     string;
  categoryName:   string;
  authorId:       string;
  authorName:     string;
  authorPhotoURL: string;
  createdAt:      Date;
  updatedAt:      Date;
  lastReplyAt:    Date | null;
  lastReplyBy:    string | null;
  replyCount:     number;
  views:          number;
  isPinned:       boolean;
  isLocked:       boolean;
  isSolved:       boolean;
  tags:           string[];
}

export interface ForumReply {
  id:             string;
  postId:         string;
  body:           string;       // Markdown
  authorId:       string;
  authorName:     string;
  authorPhotoURL: string;
  createdAt:      Date;
  updatedAt:      Date | null;
  isEdited:       boolean;
  likes:          number;
  likedBy:        string[];
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

## 8. AuthService

```typescript
// core/services/auth.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { Auth, signInWithPopup, GoogleAuthProvider, GithubAuthProvider, signOut, user } from '@angular/fire/auth';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserProfileService } from './user-profile.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth            = inject(Auth);
  private profileService  = inject(UserProfileService);

  // Signal del usuario Firebase Auth (null = no autenticado)
  readonly firebaseUser = toSignal(user(this.auth), { initialValue: null });

  // Signal del perfil extendido de Firestore
  readonly userProfile = this.profileService.currentProfile;

  readonly isLoggedIn   = computed(() => this.firebaseUser() !== null);
  readonly isAdmin      = computed(() => this.userProfile()?.role === 'admin');
  readonly isModerator  = computed(() => ['admin', 'moderator'].includes(this.userProfile()?.role ?? ''));

  async loginWithGoogle(): Promise<void> {
    const cred = await signInWithPopup(this.auth, new GoogleAuthProvider());
    await this.profileService.ensureProfile(cred.user);
  }

  async loginWithGitHub(): Promise<void> {
    const cred = await signInWithPopup(this.auth, new GithubAuthProvider());
    await this.profileService.ensureProfile(cred.user);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    this.profileService.clearProfile();
  }
}
```

---

## 9. ForumService

Principio de diseño: usar `getDocs` (one-time fetch) en lugar de `onSnapshot` (real-time)
para conservar el cupo de lecturas del Spark Plan. Solo usar `onSnapshot` en la vista de un
post para mostrar replies nuevas en tiempo real.

```typescript
// core/services/forum.service.ts — interfaz pública

class ForumService {
  // Categorías (cacheadas en memoria por sesión)
  getCategories(): Observable<ForumCategory[]>

  // Posts por categoría — paginados, 20 por página
  getPostsByCategory(categoryId: string, pageSize: number, after?: DocumentSnapshot): Observable<ForumPost[]>

  // Posts recientes globales (para forum-home)
  getRecentPosts(limit: number): Observable<ForumPost[]>

  // Post individual + replies (replies como onSnapshot para tiempo real)
  getPost(postId: string): Observable<ForumPost | null>
  getReplies(postId: string): Observable<ForumReply[]>   // onSnapshot

  // Mutaciones (requieren auth)
  createPost(data: Omit<ForumPost, 'id' | 'createdAt' | 'updatedAt' | ...>): Promise<string>
  createReply(postId: string, body: string): Promise<void>
  likeReply(postId: string, replyId: string, uid: string): Promise<void>
  markSolved(postId: string): Promise<void>

  // Incrementar views (best-effort, no await)
  incrementViews(postId: string): void

  // Moderación
  lockPost(postId: string, locked: boolean): Promise<void>
  pinPost(postId: string, pinned: boolean): Promise<void>
  deletePost(postId: string): Promise<void>
  deleteReply(postId: string, replyId: string): Promise<void>
}
```

---

## 10. Anti-Spam y Moderación

### 10.1 Rate limiting en cliente

- Guardar `lastPostAt` en UserProfile Firestore
- Antes de crear post: verificar que `now - lastPostAt > 5 minutos`
- Antes de crear reply: verificar `now - lastReplyAt > 30 segundos`
- Implementado en ForumService (verificación optimista en cliente + regla en Firestore)

### 10.2 Validación de contenido (Firestore Rules)

- Post title: 5–200 caracteres
- Post body: 20–10.000 caracteres
- Reply body: 10–5.000 caracteres
- `isPinned`, `isLocked` no editables por usuarios normales

### 10.3 Herramientas de moderación

- Los roles `moderator` y `admin` pueden: pinear, bloquear, eliminar
- Campo `banned: true` en UserProfile bloquea todas las escrituras
- No requiere Cloud Functions: todo se maneja con Firestore Rules + campo banned

### 10.4 Política de comentarios
- Existe la ruta `/politica-comentarios` — extenderla para cubrir el foro
- Vinculada desde el footer y desde el formulario de nuevo post

---

## 11. Markdown

### Dependencia: `marked` (solo rendering)

```bash
npm install marked
npm install --save-dev @types/marked
```

- Tamaño: ~50 KB minified (lazy loaded dentro del chunk del foro)
- NO usar editor WYSIWYG (ProseMirror, Quill, etc.) — agregan 200–500 KB

### Componente MarkdownEditorComponent

```
┌──────────────────────────────────────────┐
│ [Escribir] [Vista previa]                │  ← tabs
├──────────────────────────────────────────┤
│ **Negrita**  _Cursiva_  `código`  [link] │  ← toolbar mínima
├──────────────────────────────────────────┤
│                                          │
│  <textarea> o <div preview>              │
│                                          │
├──────────────────────────────────────────┤
│ 0 / 10000 caracteres                     │  ← contador
└──────────────────────────────────────────┘
```

- `input()`: valor actual (string)
- `output()`: valueChange (string)
- Preview: `innerHTML` con DOMSanitizer (bypassSecurityTrustHtml, solo para el render de marked)
- El content policy header ya permite `unsafe-inline` necesario para esto

---

## 12. Integración con Firebase en app.config.ts

Agregar `provideAuth`:

```typescript
import { getAuth, provideAuth } from '@angular/fire/auth';

// En providers:
provideAuth(() => getAuth()),
```

> `provideFirebaseApp` y `provideFirestore` ya están. Solo falta `provideAuth`.

---

## 13. Fases de Implementación

### Fase 1 — Autenticación (2–3 días)
**Objetivo:** El usuario puede iniciar sesión con Google o GitHub. Botón en el header.

1. Activar Google Auth y GitHub Auth en Firebase Console
2. Agregar `provideAuth` a `app.config.ts`
3. Implementar `UserProfileService` (ensureProfile)
4. Implementar `AuthService`
5. Crear `AuthModalComponent` (modal, no página) con botones Google/GitHub
6. Crear `UserAvatarComponent` (header badge cuando logueado)
7. Implementar `authGuard`

**Entregable:** Login funcional. El usuario ve su foto en el header.

---

### Fase 2 — Forum Backbone (3–4 días)
**Objetivo:** Páginas de listado funcionan. Se pueden leer posts. Sin creación aún.

1. Crear datos iniciales: 8 `forumCategories` en Firestore (script o consola)
2. Crear índices en `firestore.indexes.json`
3. Implementar `ForumService` (read-only: getCategories, getPostsByCategory, getPost, getReplies)
4. Forum Home — lista de categorías + 5 posts recientes por categoría
5. Forum Category — lista de posts con paginación (cursor-based)
6. Forum Post — detalle con replies en tiempo real (`onSnapshot`)
7. Actualizar `firestore.rules`

**Entregable:** El foro es navegable aunque vacío.

---

### Fase 3 — Creación de contenido (2–3 días)
**Objetivo:** Usuarios autenticados pueden publicar posts y responder.

1. `MarkdownEditorComponent`
2. Instalar `marked`
3. New Post page (ruta `/foro/nuevo`, protegida con authGuard)
4. Reply form en Forum Post (inline, al final de los replies)
5. Rate limiting client-side en ForumService
6. Validación de formulario (ReactiveForm, longitudes, categoría requerida)
7. Like en replies (toggle)

**Entregable:** Foro completamente funcional para usuarios.

---

### Fase 4 — UX y Moderación (2 días)
**Objetivo:** Experiencia pulida. Herramientas mínimas de moderación.

1. Editar/eliminar post propio
2. Editar/eliminar reply propio
3. Panel de moderador (inline en el post: pin, lock, delete)
4. Marcar post como resuelto (autor del post)
5. Perfil de usuario (`/perfil/:uid` — posts del usuario)
6. Empty states, loading states, error states
7. Links desde product-detail → `"¿Tienes dudas? Pregunta en el foro"`

---

### Fase 5 — SEO y compartir (1 día)
**Objetivo:** Posts indexables.

1. SSR: el post detail hace `getDocs` en el servidor (SSR ya habilitado en el proyecto)
2. Meta tags dinámicos por post (title, description, og:title)
3. Breadcrumbs accesibles en forum-category y forum-post
4. Actualizar `sitemap.xml` con `/foro` (posts individuales no se indexan aún — demasiados)

---

## 14. SEO y SSR

El proyecto ya usa Angular SSR. Para que los posts sean indexables:

- `ForumService.getPost()` debe funcionar en el servidor (Firestore Admin SDK no es necesario
  si las reglas permiten `read: if true`; el SDK de cliente funciona en SSR).
- Usar `@angular/fire` con `FIREBASE_OPTIONS` token que ya está configurado.
- `Meta` y `Title` services de Angular para las tags dinámicas.

Posts no requieren prerender estático ya que son contenido dinámico.

---

## 15. Consideraciones de Accesibilidad (WCAG AA)

- Modal de auth: focus trap, Escape cierra, `role="dialog"`, `aria-labelledby`
- Posts list: `role="feed"`, cada post como `article`
- Markdown editor: `<textarea>` nativo (accesible por defecto), `aria-label`
- Preview del markdown: `aria-live="polite"` para anunciar cambios
- Botones de like: `aria-pressed` (toggle), `aria-label="Me gusta (N)"`
- Contraste: todos los colores de badges de categoría deben pasar ratio 4.5:1

---

## 16. Checklist de Seguridad

- [x] Firestore Rules validan en servidor (no solo en cliente)
- [x] No se expone el uid en URLs (se usa id del post, no del usuario)
- [x] `banned` no lo puede modificar el propio usuario (regla Firestore)
- [x] `role` no lo puede modificar el usuario (regla Firestore)
- [x] Markdown renderizado con `marked` (sin eval, sin scripts)
- [x] DOMSanitizer para HTML renderizado (bypassSecurityTrustHtml solo en preview controlado)
- [x] Rate limiting impide spam (5 min entre posts)
- [x] Longitudes mínimas evitan spam de caracteres único
- [x] No hay Cloud Functions → no hay superficie de ataque de server-side
- [ ] Content Security Policy: revisar si `marked` necesita ajuste al header CSP

---

## 17. Comandos de Referencia

```bash
# Instalar dependencia de markdown
npm install marked

# Desplegar reglas de Firestore actualizadas
firebase deploy --only firestore:rules

# Desplegar índices de Firestore
firebase deploy --only firestore:indexes

# Crear datos iniciales de categorías (una vez)
# → Script Node en scraper/src/seed-forum.ts (crear en su momento)

# Build + deploy completo
npm run build && firebase deploy --only hosting
```

---

## 18. No incluir (decisiones deliberadas)

| Funcionalidad          | Motivo de exclusión                                     |
|------------------------|---------------------------------------------------------|
| Upload de imágenes     | Requeriría Firebase Storage + moderación de contenido   |
| Notificaciones push    | Requiere FCM Cloud Functions (necesita Blaze Plan)      |
| Email/Password auth    | Límite de 100 correos/día en Spark Plan                 |
| Voting de posts        | Agrega complejidad de índices; likes de replies suffice |
| Búsqueda full-text     | Requiere Algolia/Typesense (costo). Usar filtro local   |
| Editor WYSIWYG         | Demasiado peso (200–500 KB). Markdown es suficiente     |
| Private messages       | Fuera del alcance v1                                    |

---

## 19. Próximos pasos inmediatos (para iniciar Fase 1)

1. **Firebase Console** → Authentication → Sign-in methods:
   - Habilitar Google
   - Habilitar GitHub (requiere crear OAuth App en GitHub → Settings → Developer Settings)

2. **Agregar `provideAuth`** en `app.config.ts`

3. **Actualizar `firestore.rules`** con las reglas de la Sección 5

4. **Agregar índices** en `firestore.indexes.json` (Sección 4.3)

5. **Crear `AuthService`** y `UserProfileService`

6. **Crear `AuthModalComponent`** y conectarlo al header

> Una vez que el login funciona y el perfil se crea en Firestore, el resto del foro
> se construye sobre esa base sin bloqueos.
