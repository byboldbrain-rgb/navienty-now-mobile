import { publicSupabase } from '../lib/supabase';
import type {
  CatalogProduct,
  CatalogSection,
  StoreCatalog,
} from './catalog-service';

type RawCategoryContext = {
  catalog: StoreCatalog;
  currencyCode: string | null;
  offerRootCategoryIds: string[] | null;
};

export type FastSupermarketCategoryContext = {
  catalog: StoreCatalog;
  currencyCode: string;
  offerRootCategoryIds: string[];
};

/**
 * The category screen needs the actual DB category names and hierarchy,
 * not a complete supermarket product catalog. The same underlying metadata
 * is used for normal categories, subcategories and the offers category rail.
 */
export async function getFastSupermarketCategoryContext(
  serviceAreaId: string | null,
  requestedStoreId: string | null,
): Promise<FastSupermarketCategoryContext> {
  const { data, error } = await publicSupabase.rpc(
    'get_supermarket_category_context',
    {
      p_service_area_id: serviceAreaId?.trim() || null,
      p_store_id: requestedStoreId?.trim() || null,
    },
  );

  if (error) {
    throw new Error(`Loading supermarket category metadata failed: ${error.message}`);
  }

  const raw = data as RawCategoryContext | null;
  if (!raw?.catalog?.store?.id || !Array.isArray(raw.catalog.sections)) {
    throw new Error('هذا القسم غير متاح في منطقة التوصيل المختارة.');
  }

  // Restore the expected CategorySection tree without downloading products.
  // The API sends every active category with its canonical DB name and ID.
  return normalizeSupermarketCategoryContext(raw);
}

/**
 * Convert compact DB metadata into the same category hierarchy the existing
 * screen expects. Also used to instantly show DB names from the cached home
 * snapshot before the category-specific request completes.
 */
export function normalizeSupermarketCategoryContext(
  raw: RawCategoryContext,
): FastSupermarketCategoryContext {
  const sections: CatalogSection[] = raw.catalog.sections.map((section) => ({
    ...section,
    products: [],
    children: [],
  }));
  const byId = new Map(sections.map((section) => [section.id, section]));
  const roots: CatalogSection[] = [];
  for (const section of sections) {
    const parent = section.parentId ? byId.get(section.parentId) : null;
    if (parent && parent.id !== section.id) {
      parent.children.push(section);
    } else {
      roots.push(section);
    }
  }
  function decorate(section: CatalogSection, depth: number, seen: Set<string>) {
    if (seen.has(section.id)) return;
    const nextSeen = new Set(seen);
    nextSeen.add(section.id);
    section.depth = depth;
    section.children.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ar'));
    for (const child of section.children) decorate(child, depth + 1, nextSeen);
  }
  roots.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ar'));
  for (const root of roots) decorate(root, 0, new Set());

  return {
    catalog: {
      ...raw.catalog,
      sections,
      categoryTree: roots,
    },
    currencyCode: raw.currencyCode || 'EGP',
    offerRootCategoryIds: Array.isArray(raw.offerRootCategoryIds)
      ? raw.offerRootCategoryIds
      : [],
  };
}

type RawProduct = Omit<CatalogProduct, 'price' | 'compareAtPrice'> & {
  price: number | string;
  compareAtPrice: number | string | null;
};

type RawProductPage = {
  items: RawProduct[] | null;
  hasMore: boolean;
};

export type FastSupermarketCategoryPage = {
  items: CatalogProduct[];
  hasMore: boolean;
};

export const SUPERMARKET_CATEGORY_PAGE_SIZE = 24;

export type FastSupermarketProductParams = {
  storeId: string;
  serviceAreaId: string | null;
  categoryId: string | null;
  offersOnly: boolean;
  search: string;
  offset: number;
};

/**
 * Paged catalog, scoped to one store and selected category/offer root.
 * Filter/search happens at the database, so distant products are neither
 * downloaded nor lost due to a client-side first-page-only filter.
 */
export async function getFastSupermarketCategoryPage(
  params: FastSupermarketProductParams,
): Promise<FastSupermarketCategoryPage> {
  const { data, error } = await publicSupabase.rpc(
    'get_supermarket_category_product_page',
    {
      p_store_id: params.storeId,
      p_service_area_id: params.serviceAreaId?.trim() || null,
      p_category_id: params.categoryId,
      p_offers_only: params.offersOnly,
      p_search: params.search.trim(),
      p_limit: SUPERMARKET_CATEGORY_PAGE_SIZE,
      p_offset: Math.max(0, Math.floor(params.offset)),
    },
  );
  if (error) {
    throw new Error(`Loading supermarket category products failed: ${error.message}`);
  }
  const page = data as RawProductPage | null;
  const rows = Array.isArray(page?.items) ? page.items : [];
  return {
    items: rows
      .filter((item) => Boolean(item.id && item.name))
      .map((item): CatalogProduct => ({
        ...item,
        price: Number(item.price) || 0,
        compareAtPrice:
          item.compareAtPrice === null ? null : Number(item.compareAtPrice),
        variants: item.variants ?? [],
        images: item.images ?? [],
      })),
    hasMore: page?.hasMore === true,
  };
}
