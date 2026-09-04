import {
  findRequestAnythingStore,
  getLegacyRequestAnythingCartConfiguration,
  resolveRequestAnythingCartConfiguration,
  type RequestAnythingCartConfiguration,
} from '../domain/request-anything-cart-config';
import {
  getStoreCatalog,
  listStores,
} from './catalog-service';

/**
 * Resolve the internal Request Anything cart entities from the same public
 * Supabase catalog APIs used by the rest of the app.
 *
 * The legacy IDs and fee live only in the domain fallback so an older/mixed
 * backend deployment cannot make this entry point unusable. Remote data is
 * always preferred when a valid store + placeholder product can be resolved.
 */
export async function getRequestAnythingCartConfiguration(
  serviceAreaId?: string | null,
): Promise<RequestAnythingCartConfiguration> {
  try {
    const normalizedServiceAreaId =
      serviceAreaId?.trim() ||
      undefined;

    const stores =
      await listStores(
        normalizedServiceAreaId
          ? {
              serviceAreaId:
                normalizedServiceAreaId,
            }
          : {},
      );

    const requestAnythingStore =
      findRequestAnythingStore(
        stores,
      );

    if (!requestAnythingStore) {
      return getLegacyRequestAnythingCartConfiguration();
    }

    const catalog =
      await getStoreCatalog(
        requestAnythingStore.id,
        normalizedServiceAreaId,
      );

    return (
      resolveRequestAnythingCartConfiguration(
        [requestAnythingStore],
        catalog,
      ) ??
      getLegacyRequestAnythingCartConfiguration()
    );
  } catch {
    return getLegacyRequestAnythingCartConfiguration();
  }
}
