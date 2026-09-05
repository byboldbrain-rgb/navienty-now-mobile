export * from './catalog-service-base';

import {
  getStoreCatalog as getBaseStoreCatalog,
  type CatalogSection,
  type StoreCatalog,
} from './catalog-service-base';
import {
  consumeNextGlobalCartCatalogRead,
} from './cart-catalog-read-context';
import {
  useCartStore as useGlobalCartStore,
} from '../store/global-cart-store';

function getCartStoreIds(
  primaryStoreId: string,
) {
  return Object.values(
    useGlobalCartStore.getState().carts,
  )
    .filter(
      (cart) =>
        cart.items.length > 0 &&
        cart.storeId !== primaryStoreId,
    )
    .map((cart) => cart.storeId);
}

function toArtworkOnlySection(
  section: CatalogSection,
): CatalogSection {
  return {
    ...section,

    /**
     * cart-details uses productType === 'service' to exclude a product from
     * the existing recommendation strip. Supplemental products are loaded
     * only so the unchanged Cart UI can resolve their image URLs, therefore
     * they must never leak into recommendations for the anchor store.
     */
    products: section.products.map(
      (product) => ({
        ...product,
        productType: 'service',
      }),
    ),

    // The unchanged Cart only needs the flat section product list for images.
    children: [],
  };
}

/**
 * Normal app behavior is identical to the original catalog service.
 *
 * Only the single catalog read explicitly marked by the Cart route is
 * augmented with artwork-only products from the other real stores currently
 * represented in the global Cart. Store metadata, delivery data, business
 * hours, category tree, recommendations, and every non-Cart catalog request
 * keep their original semantics.
 */
export async function getStoreCatalog(
  storeId: string,
  serviceAreaId?: string,
): Promise<StoreCatalog> {
  const shouldLoadGlobalCartArtwork =
    consumeNextGlobalCartCatalogRead();

  const primaryCatalog =
    await getBaseStoreCatalog(
      storeId,
      serviceAreaId,
    );

  if (!shouldLoadGlobalCartArtwork) {
    return primaryCatalog;
  }

  const supplementalStoreIds =
    getCartStoreIds(storeId);

  if (supplementalStoreIds.length === 0) {
    return primaryCatalog;
  }

  const supplementalCatalogs =
    await Promise.all(
      supplementalStoreIds.map(
        async (supplementalStoreId) => {
          try {
            return await getBaseStoreCatalog(
              supplementalStoreId,
              serviceAreaId,
            );
          } catch {
            /**
             * One unavailable catalog must not remove images that were
             * successfully resolved for the remaining stores.
             */
            return null;
          }
        },
      ),
    );

  const supplementalSections =
    supplementalCatalogs.flatMap(
      (catalog) =>
        catalog
          ? catalog.sections.map(
              toArtworkOnlySection,
            )
          : [],
    );

  if (supplementalSections.length === 0) {
    return primaryCatalog;
  }

  return {
    ...primaryCatalog,
    sections: [
      ...primaryCatalog.sections,
      ...supplementalSections,
    ],
  };
}
