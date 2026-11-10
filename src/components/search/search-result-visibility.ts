import type { SearchScopeKey } from '../../config/search-scopes';
import type { GlobalSearchResult } from '../../services/global-search-service';

/**
 * Product results in the three shopping tabs are returned by a paged
 * Supabase RPC, not by the legacy global search index. Those RPCs already
 * verify active store, service area, availability and active category.
 *
 * The activeCategoryIdsByStore map belongs to the legacy global-index
 * discovery path; scoped shopping search deliberately does not download it.
 * Rejecting results against an empty map hides every real product.
 */
export function isSearchResultVisible(
  result: GlobalSearchResult,
  activeScope: SearchScopeKey,
  activeCategoryIdsByStore: ReadonlyMap<string, ReadonlySet<string>>,
  getScopeForCategorySlug: (slug: string | null | undefined) => SearchScopeKey | null,
): boolean {
  if (result.kind === 'service') return false;

  if (getScopeForCategorySlug(result.storeCategorySlug) !== activeScope) {
    return false;
  }

  if (result.kind === 'product' && (
    activeScope === 'supermarket' ||
    activeScope === 'bookstore' ||
    activeScope === 'personal-care'
  )) {
    // The product search RPCs check now.catalog_categories.is_active.
    return true;
  }

  if (result.kind === 'product' || result.kind === 'category') {
    return activeCategoryIdsByStore.get(result.storeId)?.has(result.sectionId) === true;
  }

  return true;
}
