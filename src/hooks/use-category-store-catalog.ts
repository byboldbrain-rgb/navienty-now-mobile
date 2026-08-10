import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import getAppBootstrap from '../services/bootstrap-service';
import {
  getStoreCatalog,
  listStores,
  type StoreCatalog,
  type StoreCategorySlug,
  type StoreSummary,
} from '../services/catalog-service';

type CategorySlugInput =
  | string
  | readonly string[];

type UseCategoryStoreCatalogResult = {
  catalog: StoreCatalog | null;
  stores: StoreSummary[];
  activeStoreId: string | null;
  activeCategorySlug: string | null;
  currencySymbol: string;
  isLoading: boolean;
  errorMessage: string | null;
  reload: () => Promise<void>;
  selectStore: (
    storeId: string,
  ) => Promise<void>;
};

function prioritizeStores(
  stores: StoreSummary[],
): StoreSummary[] {
  return [...stores].sort((first, second) => {
    if (
      first.isFeatured !== second.isFeatured
    ) {
      return first.isFeatured ? -1 : 1;
    }

    if (
      first.isManuallyClosed !==
      second.isManuallyClosed
    ) {
      return first.isManuallyClosed ? 1 : -1;
    }

    return first.name.localeCompare(
      second.name,
      'ar',
    );
  });
}

export function useCategoryStoreCatalog(
  categorySlugs: CategorySlugInput,
): UseCategoryStoreCatalogResult {
  const slugsKey =
    typeof categorySlugs === 'string'
      ? categorySlugs
      : categorySlugs.join('|');

  const normalizedSlugs = useMemo(
    () =>
      slugsKey
        .split('|')
        .map((slug) => slug.trim())
        .filter(Boolean),
    [slugsKey],
  );

  const requestIdRef = useRef(0);

  const [catalog, setCatalog] =
    useState<StoreCatalog | null>(null);
  const [stores, setStores] = useState<
    StoreSummary[]
  >([]);
  const [activeStoreId, setActiveStoreId] =
    useState<string | null>(null);
  const [activeCategorySlug, setActiveCategorySlug] =
    useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] =
    useState('ج.م');
  const [isLoading, setIsLoading] =
    useState(true);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const loadCatalog = useCallback(
    async (preferredStoreId?: string) => {
      const requestId = ++requestIdRef.current;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        if (normalizedSlugs.length === 0) {
          throw new Error(
            'لم يتم تحديد القسم المطلوب.',
          );
        }

        let resolvedCurrencySymbol = 'ج.م';

        try {
          const bootstrap =
            await getAppBootstrap();

          resolvedCurrencySymbol =
            bootstrap.settings.currency_symbol?.trim() ||
            'ج.م';
        } catch {
          // فشل bootstrap لا يجب أن يمنع عرض المنتجات.
        }

        let matchedStores: StoreSummary[] = [];
        let matchedSlug: string | null = null;

        for (const categorySlug of normalizedSlugs) {
          const loadedStores = await listStores({
            categorySlug:
              categorySlug as StoreCategorySlug,
          });

          if (loadedStores.length > 0) {
            matchedStores = prioritizeStores(
              loadedStores,
            );
            matchedSlug = categorySlug;
            break;
          }
        }

        if (matchedStores.length === 0) {
          throw new Error(
            'لا يوجد متجر مفعّل لهذا القسم حاليًا.',
          );
        }

        const selectedStore =
          matchedStores.find(
            (store) =>
              store.id === preferredStoreId,
          ) ?? matchedStores[0];

        const loadedCatalog =
          await getStoreCatalog(
            selectedStore.id,
          );

        if (
          requestId !== requestIdRef.current
        ) {
          return;
        }

        setCatalog(loadedCatalog);
        setStores(matchedStores);
        setActiveStoreId(selectedStore.id);
        setActiveCategorySlug(matchedSlug);
        setCurrencySymbol(
          resolvedCurrencySymbol,
        );
      } catch (error) {
        if (
          requestId !== requestIdRef.current
        ) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'تعذر تحميل بيانات القسم.';

        setCatalog(null);
        setStores([]);
        setActiveStoreId(null);
        setActiveCategorySlug(null);
        setErrorMessage(message);
      } finally {
        if (
          requestId === requestIdRef.current
        ) {
          setIsLoading(false);
        }
      }
    },
    [normalizedSlugs],
  );

  useEffect(() => {
    void loadCatalog();

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadCatalog]);

  const reload = useCallback(async () => {
    await loadCatalog(
      activeStoreId ?? undefined,
    );
  }, [activeStoreId, loadCatalog]);

  const selectStore = useCallback(
    async (storeId: string) => {
      if (
        !storeId ||
        storeId === activeStoreId
      ) {
        return;
      }

      await loadCatalog(storeId);
    },
    [activeStoreId, loadCatalog],
  );

  return {
    catalog,
    stores,
    activeStoreId,
    activeCategorySlug,
    currencySymbol,
    isLoading,
    errorMessage,
    reload,
    selectStore,
  };
}

export default useCategoryStoreCatalog;
