import { Timestamp } from '@angular/fire/firestore';

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
  lastScraped: Timestamp;
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  lastChecked: Timestamp;
  isActive: boolean;
}

export interface PriceHistory {
  productId: string;
  storeId: string;
  price: number;
  recordedAt: Timestamp;
}

export interface PriceAlert {
  id: string;
  userId: string;
  productId: string;
  targetPrice: number;
  email: string;
  isActive: boolean;
  createdAt: Timestamp;
}
