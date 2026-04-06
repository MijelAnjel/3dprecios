// ──────────────────────────────────────────────
// Print3D Chile — Modelos TypeScript
// ──────────────────────────────────────────────

export interface Store {
  id: string;
  name: string;
  slug: string;
  url: string;
  logo: string;
  country: 'CL';
  shippingInfo?: string;
  lastScraped: string; // ISO date string
  isActive: boolean;
}

export interface SpecField {
  key: string;
  label: string;
  unit?: string;
  type: 'number' | 'text' | 'select';
  options?: string[];
  filterable: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string;
  specFields: SpecField[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  categoryId: string;
  description: string;
  images: string[];
  specs: Record<string, string | number>;
  minPrice: number;
  maxPrice: number;
  storeCount: number;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface ProductEntry {
  id: string;
  productId: string;
  storeId: string;
  url: string;
  price: number;
  currency: 'CLP';
  stock: 'available' | 'low' | 'out' | 'unknown';
  sku?: string;
  lastChecked: string; // ISO date string
  isActive: boolean;
}

export interface PriceHistory {
  productId: string;
  storeId: string;
  price: number;
  recordedAt: string; // ISO date string
}

export interface PriceAlert {
  id: string;
  userId: string;
  productId: string;
  targetPrice: number;
  email: string;
  isActive: boolean;
  createdAt: string; // ISO date string
}

// ─────────────────────────────────────────────
// Catalog JSON — estructura del archivo estático
// ─────────────────────────────────────────────

/** Entrada de precio embebida dentro del catálogo estático. */
export interface CatalogEntry {
  storeId: string;
  url: string;
  price: number;
  stock: 'available' | 'low' | 'out' | 'unknown';
  sku?: string;
}

/** Punto de historial de precios embebido. */
export interface CatalogHistoryPoint {
  storeId: string;
  price: number;
  recordedAt: string; // ISO date string
}

/** Producto con entradas e historial embebidos (catalog.json). */
export interface CatalogProduct extends Product {
  entries: CatalogEntry[];
  history: CatalogHistoryPoint[];
}

/** Estructura completa del archivo catalog.json. */
export interface CatalogData {
  meta: {
    generatedAt: string;
    productCount: number;
  };
  stores: Store[];
  products: CatalogProduct[];
}

// ─────────────────────────────────────────────
// Foro / Comunidad
// ─────────────────────────────────────────────

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
  body:           string;
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
  body:           string;
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
