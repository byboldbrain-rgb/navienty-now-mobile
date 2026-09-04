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

type CachedHomeStoreArtwork = {
  artwork: HomeStoreArtwork;
  expiresAt: number;
};

const HOME_STORE_ARTWORK_CACHE_TTL_MS =
  60_000;
const HOME_STORE_ARTWORK_CACHE_MAX_ENTRIES =
  100;

/*
 * Home can mount the same store artwork in multiple rails and remount those
 * rails during navigation/focus changes. Share in-flight work and keep a short
 * non-persistent cache for completed successful lookups so the heavy catalog
 * RPC is not repeated for the same store every time. Errors are never cached.
 */
const inFlightRequests = new Map<
  string,
  Promise<HomeStoreArtwork>
>();

const artworkCache = new Map<
  string,
  CachedHomeStoreArtwork
>();

function emptyArtwork(): HomeStoreArtwork {
  return {
    logoUrl: '',
    coverImageUrl: '',
    categorySlug: '',
  };
}

function getCachedArtwork(
  storeId: string,
): HomeStoreArtwork | null {
  const cached = artworkCache.get(storeId);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    artworkCache.delete(storeId);
    return null;
  }

  return cached.artwork;
}

function cacheArtwork(
  storeId: string,
  artwork: HomeStoreArtwork,
): void {
  const now = Date.now();

  artworkCache.forEach(
    (cached, cachedStoreId) => {
      if (cached.expiresAt <= now) {
        artworkCache.delete(cachedStoreId);
      }
    },
  );

  if (
    artworkCache.size >=
      HOME_STORE_ARTWORK_CACHE_MAX_ENTRIES &&
    !artworkCache.has(storeId)
  ) {
    const oldestStoreId =
      artworkCache.keys().next().value;

    if (oldestStoreId) {
      artworkCache.delete(oldestStoreId);
    }
  }

  artworkCache.delete(storeId);
  artworkCache.set(storeId, {
    artwork,
    expiresAt:
      now + HOME_STORE_ARTWORK_CACHE_TTL_MS,
  });
}

export async function getHomeStoreArtwork(
  storeId: string,
): Promise<HomeStoreArtwork> {
  const normalizedStoreId = storeId.trim();

  if (!normalizedStoreId) {
    return emptyArtwork();
  }

  const cachedArtwork =
    getCachedArtwork(normalizedStoreId);

  if (cachedArtwork) {
    return cachedArtwork;
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

    const artwork: HomeStoreArtwork = {
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

    cacheArtwork(
      normalizedStoreId,
      artwork,
    );

    return artwork;
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
