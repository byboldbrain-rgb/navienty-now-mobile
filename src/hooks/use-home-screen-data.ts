import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import getAppBootstrap, {
  type AppBootstrap,
  type City,
  type ServiceArea,
} from '../services/bootstrap-service';
import {
  listStores,
  type StoreSummary,
} from '../services/catalog-service';
import {
  createHomeStoreIdsKey,
  readCachedHomeStores,
  readCachedHomeSuggestions,
  writeCachedHomeStores,
  writeCachedHomeSuggestions,
} from '../services/home-public-cache-service';
import { loadHomeSearchSuggestionNames } from '../services/home-search-suggestions-service';
import {
  listStorefrontCategoryTiles,
  type StorefrontCategoryTile,
} from '../services/storefront-category-service';

export type ResolvedHomeLocation = {
  areaId: string | null;
  cityId: string | null;
  cityName: string;
  areaName: string;
  fullName: string;
};

type StoresSnapshot = {
  locationKey: string;
  items: StoreSummary[];
};

type SuggestionsSnapshot = {
  locationKey: string;
  storeIdsKey: string;
  items: string[];
};

const EMPTY_STORES: StoreSummary[] = [];
const EMPTY_SUGGESTIONS: string[] = [];

type UseHomeScreenDataResult = {
  bootstrap: AppBootstrap | null;
  homeCategoryTiles:
    | StorefrontCategoryTile[]
    | null;
  isBootstrapLoading: boolean;
  bootstrapError: string | null;
  effectiveLocation:
    | ResolvedHomeLocation
    | null;
  stores: StoreSummary[];
  homeSearchSuggestions: string[];
  reloadBootstrap: () => Promise<void>;
};

function locationFromArea(
  city: City,
  area: ServiceArea,
): ResolvedHomeLocation {
  return {
    areaId: area.id,
    cityId: city.id,
    cityName: city.name_ar,
    areaName: area.name_ar,
    fullName:
      `${area.name_ar}، ${city.name_ar}`,
  };
}

function resolveDefaultLocation(
  bootstrap: AppBootstrap,
): ResolvedHomeLocation {
  const defaultAreaId =
    bootstrap.settings.default_service_area_id;

  for (const city of bootstrap.cities) {
    const area = city.areas.find(
      (currentArea) =>
        currentArea.id === defaultAreaId,
    );

    if (area) {
      return locationFromArea(city, area);
    }
  }

  const firstCity = bootstrap.cities[0];
  const firstArea = firstCity?.areas[0];

  if (firstCity && firstArea) {
    return locationFromArea(
      firstCity,
      firstArea,
    );
  }

  if (firstCity) {
    return {
      areaId: null,
      cityId: firstCity.id,
      cityName: firstCity.name_ar,
      areaName: firstCity.name_ar,
      fullName: firstCity.name_ar,
    };
  }

  return {
    areaId: null,
    cityId: null,
    cityName: '',
    areaName: 'منطقتك',
    fullName: 'منطقة التوصيل غير محددة',
  };
}

function resolveLocationByAreaId(
  bootstrap: AppBootstrap,
  areaId: string | null | undefined,
): ResolvedHomeLocation | null {
  if (!areaId) {
    return null;
  }

  for (const city of bootstrap.cities) {
    const area = city.areas.find(
      (currentArea) =>
        currentArea.id === areaId,
    );

    if (area) {
      return locationFromArea(city, area);
    }
  }

  return null;
}

function isLocationStillAvailable(
  bootstrap: AppBootstrap,
  location: ResolvedHomeLocation,
): boolean {
  if (!location.areaId) {
    return false;
  }

  return bootstrap.cities.some((city) =>
    city.areas.some(
      (area) => area.id === location.areaId,
    ),
  );
}

function resolvePreferredLocation(
  bootstrap: AppBootstrap,
  savedServiceAreaId: string | null | undefined,
  currentLocation: ResolvedHomeLocation | null,
): ResolvedHomeLocation {
  const savedLocation =
    resolveLocationByAreaId(
      bootstrap,
      savedServiceAreaId,
    );

  if (savedLocation) {
    return savedLocation;
  }

  if (
    currentLocation &&
    isLocationStillAvailable(
      bootstrap,
      currentLocation,
    )
  ) {
    return currentLocation;
  }

  return resolveDefaultLocation(bootstrap);
}

function getLocationKey(
  location: ResolvedHomeLocation,
): string {
  return [
    location.cityId ?? '',
    location.areaId ?? '',
  ].join(':');
}

export function useHomeScreenData(
  savedServiceAreaId:
    | string
    | null
    | undefined,
): UseHomeScreenDataResult {
  const isMountedRef = useRef(true);
  const bootstrapRequestIdRef = useRef(0);
  const categoryTilesRequestIdRef =
    useRef(0);
  const storesRequestIdRef = useRef(0);
  const suggestionsRequestIdRef =
    useRef(0);
  const activeStoreIdsKeyRef =
    useRef('');
  const savedServiceAreaIdRef =
    useRef(savedServiceAreaId);

  savedServiceAreaIdRef.current =
    savedServiceAreaId;

  const [bootstrap, setBootstrap] =
    useState<AppBootstrap | null>(null);
  const [
    homeCategoryTiles,
    setHomeCategoryTiles,
  ] = useState<
    StorefrontCategoryTile[] | null
  >(null);
  const [
    isBootstrapLoading,
    setIsBootstrapLoading,
  ] = useState(true);
  const [
    bootstrapError,
    setBootstrapError,
  ] = useState<string | null>(null);
  const [
    selectedLocation,
    setSelectedLocation,
  ] = useState<ResolvedHomeLocation | null>(
    null,
  );
  const [
    storesSnapshot,
    setStoresSnapshot,
  ] = useState<StoresSnapshot>({
    locationKey: '',
    items: [],
  });
  const [
    suggestionsSnapshot,
    setSuggestionsSnapshot,
  ] = useState<SuggestionsSnapshot>({
    locationKey: '',
    storeIdsKey: '',
    items: [],
  });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      bootstrapRequestIdRef.current += 1;
      categoryTilesRequestIdRef.current += 1;
      storesRequestIdRef.current += 1;
      suggestionsRequestIdRef.current += 1;
    };
  }, []);

  /*
   * Bootstrap is the only remote dependency that blocks the first usable Home
   * render. Category tiles are optional remote configuration and load on their
   * own path below, so a slow tile query cannot hold the entire screen behind
   * the loading skeleton.
   *
   * The launch gate evaluates maintenance/min-version separately before Home
   * mounts. The persistent cache below never stores or participates in those
   * gate decisions.
   */
  const reloadBootstrap = useCallback(
    async () => {
      const requestId =
        bootstrapRequestIdRef.current + 1;
      bootstrapRequestIdRef.current =
        requestId;

      if (isMountedRef.current) {
        setIsBootstrapLoading(true);
        setBootstrapError(null);
      }

      try {
        const loadedBootstrap =
          await getAppBootstrap();

        if (
          !isMountedRef.current ||
          bootstrapRequestIdRef.current !==
            requestId
        ) {
          return;
        }

        setBootstrap(loadedBootstrap);
        setSelectedLocation(
          (currentLocation) =>
            resolvePreferredLocation(
              loadedBootstrap,
              savedServiceAreaIdRef.current,
              currentLocation,
            ),
        );
      } catch (error) {
        if (
          !isMountedRef.current ||
          bootstrapRequestIdRef.current !==
            requestId
        ) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'تعذر تحميل بيانات التطبيق.';

        setBootstrap(null);
        setSelectedLocation(null);
        setBootstrapError(message);
      } finally {
        if (
          isMountedRef.current &&
          bootstrapRequestIdRef.current ===
            requestId
        ) {
          setIsBootstrapLoading(false);
        }
      }
    },
    [],
  );

  const loadHomeCategoryTiles =
    useCallback(async () => {
      const requestId =
        categoryTilesRequestIdRef.current + 1;
      categoryTilesRequestIdRef.current =
        requestId;

      try {
        const tiles =
          await listStorefrontCategoryTiles(
            'home',
          );

        if (
          !isMountedRef.current ||
          categoryTilesRequestIdRef.current !==
            requestId
        ) {
          return;
        }

        setHomeCategoryTiles(tiles);
      } catch (error) {
        if (
          !isMountedRef.current ||
          categoryTilesRequestIdRef.current !==
            requestId
        ) {
          return;
        }

        /*
         * null intentionally means "remote configuration unavailable". The
         * Home category builder then keeps using the bundled production-safe
         * definitions instead of blocking or showing a broken empty state.
         */
        setHomeCategoryTiles(null);

        if (__DEV__) {
          console.warn(
            'Unable to load dynamic Home categories. Falling back to bundled categories.',
            error,
          );
        }
      }
    }, []);

  useEffect(() => {
    void reloadBootstrap();
    void loadHomeCategoryTiles();
  }, [
    loadHomeCategoryTiles,
    reloadBootstrap,
  ]);

  /*
   * Location changes should not refetch bootstrap or Home tile configuration.
   * Re-resolve the selected area locally against the already loaded bootstrap.
   */
  useEffect(() => {
    if (!bootstrap) {
      return;
    }

    setSelectedLocation(
      (currentLocation) =>
        resolvePreferredLocation(
          bootstrap,
          savedServiceAreaId,
          currentLocation,
        ),
    );
  }, [bootstrap, savedServiceAreaId]);

  const effectiveLocation = useMemo(
    () =>
      selectedLocation ??
      (bootstrap
        ? resolveDefaultLocation(bootstrap)
        : null),
    [bootstrap, selectedLocation],
  );

  const locationKey =
    effectiveLocation
      ? getLocationKey(effectiveLocation)
      : '';

  const effectiveAreaId =
    effectiveLocation?.areaId ?? null;
  const effectiveCityId =
    effectiveLocation?.cityId ?? null;

  /*
   * Public Home data uses stale-while-revalidate semantics after the launch
   * gate has already allowed the app. A short-lived, location-scoped snapshot
   * can paint stores immediately after a process restart, then listStores()
   * always revalidates it from Supabase. Network errors keep a valid cached
   * snapshot instead of replacing it with an empty rail.
   */
  useEffect(() => {
    const requestId =
      storesRequestIdRef.current + 1;
    storesRequestIdRef.current =
      requestId;

    if (!locationKey) {
      activeStoreIdsKeyRef.current = '';

      setStoresSnapshot({
        locationKey: '',
        items: [],
      });
      setSuggestionsSnapshot({
        locationKey: '',
        storeIdsKey: '',
        items: [],
      });
      return;
    }

    let cancelled = false;

    async function loadHomeStores() {
      let hydratedFromCache = false;

      const cachedStores =
        await readCachedHomeStores(
          locationKey,
        );

      if (
        cachedStores &&
        !cancelled &&
        isMountedRef.current &&
        storesRequestIdRef.current ===
          requestId
      ) {
        const cachedStoreIdsKey =
          createHomeStoreIdsKey(
            cachedStores,
          );

        const cachedSuggestions =
          cachedStoreIdsKey
            ? await readCachedHomeSuggestions(
                locationKey,
                cachedStoreIdsKey,
              )
            : null;

        if (
          cancelled ||
          !isMountedRef.current ||
          storesRequestIdRef.current !==
            requestId
        ) {
          return;
        }

        hydratedFromCache = true;
        activeStoreIdsKeyRef.current =
          cachedStoreIdsKey;

        setStoresSnapshot({
          locationKey,
          items: cachedStores,
        });

        if (cachedSuggestions) {
          setSuggestionsSnapshot({
            locationKey,
            storeIdsKey:
              cachedStoreIdsKey,
            items: cachedSuggestions,
          });
        }
      }

      try {
        const loadedStores =
          await listStores({
            serviceAreaId:
              effectiveAreaId ?? undefined,
          });

        if (
          cancelled ||
          !isMountedRef.current ||
          storesRequestIdRef.current !==
            requestId
        ) {
          return;
        }

        const loadedStoreIdsKey =
          createHomeStoreIdsKey(
            loadedStores,
          );

        activeStoreIdsKeyRef.current =
          loadedStoreIdsKey;

        setStoresSnapshot({
          locationKey,
          items: loadedStores,
        });

        void writeCachedHomeStores(
          locationKey,
          loadedStores,
        );
      } catch (error) {
        if (
          cancelled ||
          !isMountedRef.current ||
          storesRequestIdRef.current !==
            requestId
        ) {
          return;
        }

        if (!hydratedFromCache) {
          activeStoreIdsKeyRef.current = '';

          setStoresSnapshot({
            locationKey,
            items: [],
          });
          setSuggestionsSnapshot({
            locationKey,
            storeIdsKey: '',
            items: [],
          });
        }

        console.warn(
          'Unable to load Home stores.',
          error,
        );
      }
    }

    void loadHomeStores();

    return () => {
      cancelled = true;
    };
  }, [
    effectiveAreaId,
    effectiveCityId,
    locationKey,
  ]);

  /*
   * Never expose stores from a previous area while a location switch is still
   * loading. This removes a real cross-location stale-data window.
   */
  const stores =
    storesSnapshot.locationKey ===
    locationKey
      ? storesSnapshot.items
      : EMPTY_STORES;

  const storeIdsKey =
    createHomeStoreIdsKey(stores);

  /*
   * Suggestions are keyed by the exact ordered store IDs. Hydrated suggestions
   * can paint immediately, while one revalidation runs for that store set.
   * A fresh StoreSummary array with the same IDs does not trigger a duplicate
   * catalog-category request.
   */
  useEffect(() => {
    const requestId =
      suggestionsRequestIdRef.current + 1;
    suggestionsRequestIdRef.current =
      requestId;

    if (!storeIdsKey) {
      setSuggestionsSnapshot({
        locationKey,
        storeIdsKey: '',
        items: [],
      });
      return;
    }

    let cancelled = false;

    async function loadSuggestions() {
      try {
        const suggestions =
          await loadHomeSearchSuggestionNames(
            storeIdsKey.split('|'),
          );

        if (
          cancelled ||
          !isMountedRef.current ||
          suggestionsRequestIdRef.current !==
            requestId
        ) {
          return;
        }

        setSuggestionsSnapshot({
          locationKey,
          storeIdsKey,
          items: suggestions,
        });

        void writeCachedHomeSuggestions(
          locationKey,
          storeIdsKey,
          suggestions,
        );
      } catch (error) {
        if (
          cancelled ||
          !isMountedRef.current ||
          suggestionsRequestIdRef.current !==
            requestId
        ) {
          return;
        }

        setSuggestionsSnapshot(
          (currentSnapshot) => {
            if (
              currentSnapshot.locationKey ===
                locationKey &&
              currentSnapshot.storeIdsKey ===
                storeIdsKey
            ) {
              return currentSnapshot;
            }

            return {
              locationKey,
              storeIdsKey,
              items: [],
            };
          },
        );

        if (__DEV__) {
          console.warn(
            'Unable to load Home search suggestions.',
            error,
          );
        }
      }
    }

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [locationKey, storeIdsKey]);

  const homeSearchSuggestions =
    suggestionsSnapshot.locationKey ===
      locationKey &&
    suggestionsSnapshot.storeIdsKey ===
      storeIdsKey
      ? suggestionsSnapshot.items
      : EMPTY_SUGGESTIONS;

  return {
    bootstrap,
    homeCategoryTiles,
    isBootstrapLoading,
    bootstrapError,
    effectiveLocation,
    stores,
    homeSearchSuggestions,
    reloadBootstrap,
  };
}
