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
    bootstrap.settings
      .default_service_area_id;

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
      (area) =>
        area.id === location.areaId,
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
  const storesRequestIdRef = useRef(0);
  const suggestionsRequestIdRef =
    useRef(0);
  const savedServiceAreaIdRef =
    useRef(savedServiceAreaId);

  savedServiceAreaIdRef.current =
    savedServiceAreaId;

  const [bootstrap, setBootstrap] =
    useState<AppBootstrap | null>(null);
  const [homeCategoryTiles, setHomeCategoryTiles] =
    useState<
      StorefrontCategoryTile[] | null
    >(null);
  const [isBootstrapLoading, setIsBootstrapLoading] =
    useState(true);
  const [bootstrapError, setBootstrapError] =
    useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] =
    useState<ResolvedHomeLocation | null>(
      null,
    );
  const [storesSnapshot, setStoresSnapshot] =
    useState<StoresSnapshot>({
      locationKey: '',
      items: [],
    });
  const [suggestionsSnapshot, setSuggestionsSnapshot] =
    useState<SuggestionsSnapshot>({
      locationKey: '',
      items: [],
    });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      bootstrapRequestIdRef.current += 1;
      storesRequestIdRef.current += 1;
      suggestionsRequestIdRef.current += 1;
    };
  }, []);

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
        const [
          loadedBootstrap,
          homeTilesResult,
        ] = await Promise.all([
          getAppBootstrap(),
          listStorefrontCategoryTiles(
            'home',
          )
            .then((tiles) => ({
              ok: true as const,
              tiles,
            }))
            .catch((error) => {
              console.warn(
                'Unable to load dynamic Home categories. Falling back to bundled categories.',
                error,
              );

              return {
                ok: false as const,
                tiles: null,
              };
            }),
        ]);

        if (
          !isMountedRef.current ||
          bootstrapRequestIdRef.current !==
            requestId
        ) {
          return;
        }

        setBootstrap(loadedBootstrap);
        setHomeCategoryTiles(
          homeTilesResult.ok
            ? homeTilesResult.tiles
            : null,
        );
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
        setHomeCategoryTiles(null);
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

  useEffect(() => {
    void reloadBootstrap();
  }, [reloadBootstrap]);

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

  const effectiveLocation =
    useMemo(
      () =>
        selectedLocation ??
        (bootstrap
          ? resolveDefaultLocation(
              bootstrap,
            )
          : null),
      [bootstrap, selectedLocation],
    );

  const locationKey =
    effectiveLocation
      ? getLocationKey(
          effectiveLocation,
        )
      : '';

  const effectiveAreaId =
    effectiveLocation?.areaId ?? null;
  const effectiveCityId =
    effectiveLocation?.cityId ?? null;

  useEffect(() => {
    const requestId =
      storesRequestIdRef.current + 1;
    storesRequestIdRef.current =
      requestId;

    if (!locationKey) {
      setStoresSnapshot({
        locationKey: '',
        items: [],
      });
      return;
    }

    let cancelled = false;

    async function loadHomeStores() {
      try {
        const loadedStores =
          await listStores({
            serviceAreaId:
              effectiveAreaId ??
              undefined,
          });

        if (
          cancelled ||
          !isMountedRef.current ||
          storesRequestIdRef.current !==
            requestId
        ) {
          return;
        }

        setStoresSnapshot({
          locationKey,
          items: loadedStores,
        });
      } catch (error) {
        if (
          cancelled ||
          !isMountedRef.current ||
          storesRequestIdRef.current !==
            requestId
        ) {
          return;
        }

        setStoresSnapshot({
          locationKey,
          items: [],
        });

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

  useEffect(() => {
    const requestId =
      suggestionsRequestIdRef.current + 1;
    suggestionsRequestIdRef.current =
      requestId;

    if (stores.length === 0) {
      setSuggestionsSnapshot({
        locationKey,
        items: [],
      });
      return;
    }

    let cancelled = false;

    async function loadSuggestions() {
      try {
        const suggestions =
          await loadHomeSearchSuggestionNames(
            stores.map(
              (store) => store.id,
            ),
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
          items: suggestions,
        });
      } catch (error) {
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
          items: [],
        });

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
  }, [locationKey, stores]);

  const homeSearchSuggestions =
    suggestionsSnapshot.locationKey ===
    locationKey
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
