import { Image as ExpoImage } from 'expo-image';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  listStores,
  type StoreSummary,
} from '../../services/catalog-service';
import {
  getStoreCoverUrl,
  getStoreLogoUrl,
  RESTAURANTS_SLUG,
} from './restaurants-domain';

type RestaurantsDataState = {
  stores: StoreSummary[];
  isLoading: boolean;
  errorMessage: string | null;
};

type UseRestaurantsDataResult = RestaurantsDataState & {
  reload: () => Promise<void>;
};

function prefetchRestaurantImages(stores: readonly StoreSummary[]) {
  const urls = Array.from(
    new Set(
      stores
        .slice(0, 6)
        .flatMap((store) => [
          getStoreCoverUrl(store),
          getStoreLogoUrl(store),
        ])
        .filter((url): url is string => Boolean(url)),
    ),
  );

  if (urls.length === 0) {
    return;
  }

  void ExpoImage.prefetch(urls, 'memory-disk').catch(() => {
    // Image prefetching is an optimization only. A failed prefetch must
    // never make the restaurants screen fail or produce an unhandled
    // rejection; ExpoImage will retry normally when the image mounts.
  });
}

export function useRestaurantsData(
  serviceAreaId: string | null | undefined,
): UseRestaurantsDataResult {
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const [state, setState] = useState<RestaurantsDataState>({
    stores: [],
    isLoading: true,
    errorMessage: null,
  });

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    setState((current) => ({
      ...current,
      isLoading: true,
      errorMessage: null,
    }));

    try {
      const loadedStores = await listStores({
        categorySlug: RESTAURANTS_SLUG,
        serviceAreaId: serviceAreaId ?? undefined,
      });

      if (
        !mountedRef.current ||
        requestId !== requestIdRef.current
      ) {
        return;
      }

      prefetchRestaurantImages(loadedStores);

      setState({
        stores: loadedStores,
        isLoading: false,
        errorMessage: null,
      });
    } catch (error) {
      if (
        !mountedRef.current ||
        requestId !== requestIdRef.current
      ) {
        return;
      }

      setState({
        stores: [],
        isLoading: false,
        errorMessage:
          error instanceof Error
            ? error.message
            : 'تعذر تحميل المطاعم.',
      });
    }
  }, [serviceAreaId]);

  useEffect(() => {
    void reload();

    return () => {
      // Invalidate any request started for the previous service area.
      requestIdRef.current += 1;
    };
  }, [reload]);

  return {
    ...state,
    reload,
  };
}
