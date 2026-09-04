import { publicSupabase } from '../lib/supabase';

export type HomeStoreArtwork = {
  logoUrl: string;
  coverImageUrl: string;
  categorySlug: string;
};

type RawHomeStoreCatalog = {
  store?: {
    logo_url?: string | null;
    cover_image_url?: string | null;
    category_slug?: string | null;
  } | null;
};

/*
 * Several Home rails can ask for the same store artwork during the same render
 * window. Share only the in-flight request: this removes duplicate RPC traffic
 * without introducing a stale persistent cache or changing admin-update
 * freshness semantics.
 */
const inFlightRequests = new Map<
  string,
  Promise<HomeStoreArtwork>
>();

function emptyArtwork(): HomeStoreArtwork {
  return {
    logoUrl: '',
    coverImageUrl: '',
    categorySlug: '',
  };
}

export async function getHomeStoreArtwork(
  storeId: string,
): Promise<HomeStoreArtwork> {
  const normalizedStoreId = storeId.trim();

  if (!normalizedStoreId) {
    return emptyArtwork();
  }

  const existingRequest =
    inFlightRequests.get(
      normalizedStoreId,
    );

  if (existingRequest) {
    return existingRequest;
  }

  const request = (async () => {
    const { data, error } =
      await publicSupabase.rpc(
        'get_store_catalog',
        {
          p_store_id:
            normalizedStoreId,
        },
      );

    if (error) {
      throw error;
    }

    const rawCatalog =
      data as RawHomeStoreCatalog | null;

    return {
      logoUrl:
        rawCatalog?.store?.logo_url
          ?.trim() ?? '',
      coverImageUrl:
        rawCatalog?.store
          ?.cover_image_url
          ?.trim() ?? '',
      categorySlug:
        rawCatalog?.store
          ?.category_slug
          ?.trim() ?? '',
    };
  })();

  inFlightRequests.set(
    normalizedStoreId,
    request,
  );

  try {
    return await request;
  } finally {
    if (
      inFlightRequests.get(
        normalizedStoreId,
      ) === request
    ) {
      inFlightRequests.delete(
        normalizedStoreId,
      );
    }
  }
}
