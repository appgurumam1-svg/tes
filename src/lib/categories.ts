import type { CategoryItem } from '../types';

/** Kategori bawaan; dipakai untuk user baru dan mode lokal. */
export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: 'kendaraan', name: 'Kendaraan', emoji: '🛵' },
  { id: 'dokumen', name: 'Dokumen', emoji: '🪪' },
  { id: 'kesehatan', name: 'Kesehatan', emoji: '🩺' },
  { id: 'langganan', name: 'Langganan', emoji: '📱' },
  { id: 'rumah', name: 'Rumah', emoji: '🏠' },
  { id: 'lainnya', name: 'Lainnya', emoji: '📌' },
];

const STORAGE_KEY = 'tenggat.categories.v1';
const ID_RE = /^[a-z0-9-]{1,40}$/;

export function findCategory(categories: CategoryItem[], id: string): CategoryItem {
  return (
    categories.find((category) => category.id === id) ?? {
      id,
      name: id,
      emoji: '📌',
    }
  );
}

export function slugifyCategory(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return slug || 'kategori';
}

/** ID unik untuk kategori lokal (mis. "elektronik-a1b2"). */
export function createCategoryId(name: string, existing: CategoryItem[]): string {
  const base = slugifyCategory(name);
  if (!existing.some((category) => category.id === base)) return base;
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

export function normalizeCategories(value: unknown): CategoryItem[] {
  if (!Array.isArray(value)) return [...DEFAULT_CATEGORIES];

  const seen = new Set<string>();
  const result: CategoryItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === 'string' && ID_RE.test(item.id) ? item.id : '';
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      name: name.slice(0, 40),
      emoji: typeof item.emoji === 'string' && item.emoji.trim() ? item.emoji.trim().slice(0, 8) : '📌',
    });
  }

  return result.length > 0 ? result : [...DEFAULT_CATEGORIES];
}

export function loadCategories(): CategoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_CATEGORIES];
    return normalizeCategories(JSON.parse(raw));
  } catch {
    return [...DEFAULT_CATEGORIES];
  }
}

export function saveCategories(categories: CategoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  } catch {
    // localStorage penuh/diblokir: kategori tetap hidup di state sesi ini.
  }
}
