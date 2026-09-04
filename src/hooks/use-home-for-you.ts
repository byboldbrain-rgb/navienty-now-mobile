import {
    useFocusEffect,
    useRouter,
} from 'expo-router';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Alert } from 'react-native';

import { showClosedStoreAlert } from '../features/home/home-feedback';
import {
    FOR_YOU_PRODUCT_STORE_CATEGORIES,
    type ForYouRecommendation,
    getCatalogProductMap,
    isEligibleForYouProduct,
    normalizeForYouCategorySlug,
} from '../features/home/home-model';
import {
    clearSearchAttribution,
    getForYouRecommendations,
    trackBehaviorEvent,
} from '../features/home/home-personalization-compat';
import {
    getStoreCatalog,
    type StoreSummary,
} from '../services/catalog-service';
import { useCartStore } from '../store/cart-store';
import type { Order } from '../store/orders-store';

type UseHomeForYouInput = {
  effectiveServiceAreaId: string | null;
  effectiveAreaId: string | null;
  savedServiceAreaId:
    | string
    | null
    | undefined;
  orders: readonly Order[];
  stores: readonly StoreSummary[];
};

type UseHomeForYouResult = {
  recommendations: ForYouRecommendation[];
  addingRecommendationId: string | null;
  addRecommendationToCart: (
    recommendation: ForYouRecommendation,
  ) => Promise<void>;
};

export function useHomeForYou({
  effectiveServiceAreaId,
  effectiveAreaId,
  savedServiceAreaId,
  orders,
  stores,
}: UseHomeForYouInput): UseHomeForYouResult {
  const router = useRouter();
  const isMountedRef = useRef(true);
  const isFocusedRef = useRef(false);
  const actionInFlightRef = useRef(false);

  const [recommendations, setRecommendations] =
    useState<ForYouRecommendation[]>([]);
  const [addingRecommendationId, setAddingRecommendationId] =
    useState<string | null>(null);

  const storesById = useMemo(
    () =>
      new Map(
        stores.map(
          (store) => [
            store.id,
            store,
          ] as const,
        ),
      ),
    [stores],
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      actionInFlightRef.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      isFocusedRef.current = true;

      const loadForYou = async () => {
        try {
          const nextRecommendations =
            await getForYouRecommendations({
              serviceAreaId:
                effectiveServiceAreaId,
              orders,
            });

          if (active) {
            setRecommendations(
              nextRecommendations
                .filter(
                  isEligibleForYouProduct,
                )
                .slice(0, 12),
            );
          }
        } catch (error) {
          if (active) {
            setRecommendations([]);
          }

          console.warn(
            'Unable to load Home For You recommendations.',
            error,
          );
        }
      };

      void loadForYou();

      return () => {
        active = false;
        isFocusedRef.current = false;
      };
    }, [effectiveServiceAreaId, orders]),
  );

  const openStore = useCallback(
    (storeId: string) => {
      router.push({
        pathname: '/store/[id]',
        params: {
          id: storeId,
        },
      });
    },
    [router],
  );

  const addRecommendationToCart =
    useCallback(
      async (
        recommendation: ForYouRecommendation,
      ) => {
        /*
         * React state is not a synchronous lock. The ref prevents two taps in
         * the same commit window from loading/adding the product twice.
         */
        if (actionInFlightRef.current) {
          return;
        }

        const result = recommendation.result;

        if (
          result.kind !== 'product' ||
          !isEligibleForYouProduct(
            recommendation,
          )
        ) {
          return;
        }

        const recommendationStore =
          storesById.get(result.storeId) ??
          null;

        if (
          recommendationStore?.isManuallyClosed
        ) {
          showClosedStoreAlert(
            recommendationStore.name,
            recommendationStore.manualClosedNote,
            'product',
          );
          return;
        }

        actionInFlightRef.current = true;
        setAddingRecommendationId(
          recommendation.id,
        );

        try {
          void trackBehaviorEvent({
            eventName: 'for_you_clicked',
            serviceAreaId:
              effectiveAreaId ??
              savedServiceAreaId ??
              null,
            properties: {
              action: 'quick_add_to_cart',
              recommendation_id:
                recommendation.id,
              result_id: result.id,
              result_type: result.kind,
              reason: recommendation.reason,
              score: recommendation.score,
              store_id: result.storeId,
              product_id: result.productId,
              section_id: result.sectionId,
            },
          });

          /*
           * Always resolve the live catalog before Cart mutation. A cached
           * recommendation must never be trusted for current price,
           * availability, restrictions, variants or delivery rules.
           */
          const catalog =
            await getStoreCatalog(
              result.storeId,
              effectiveAreaId ?? undefined,
            );

          if (
            !isMountedRef.current ||
            !isFocusedRef.current
          ) {
            return;
          }

          if (
            !FOR_YOU_PRODUCT_STORE_CATEGORIES.has(
              normalizeForYouCategorySlug(
                catalog.store.categorySlug,
              ),
            )
          ) {
            return;
          }

          if (catalog.store.isManuallyClosed) {
            showClosedStoreAlert(
              catalog.store.name,
              catalog.store.manualClosedNote,
              'product',
            );
            return;
          }

          const product =
            getCatalogProductMap(catalog).get(
              result.productId,
            );

          if (!product) {
            Alert.alert(
              'المنتج مش متاح دلوقتي',
              'المنتج اتغير أو اتشال من المتجر. هنحدّث اختياراتك تلقائيًا المرة الجاية.',
            );
            return;
          }

          const variants =
            product.variants ?? [];

          if (variants.length > 1) {
            Alert.alert(
              'اختار النوع من المتجر',
              'المنتج ده له أكتر من اختيار. افتح المتجر وحدد النوع المناسب قبل إضافته للسلة.',
              [
                {
                  text: 'إلغاء',
                  style: 'cancel',
                },
                {
                  text: 'فتح المتجر',
                  onPress: () => {
                    openStore(result.storeId);
                  },
                },
              ],
            );
            return;
          }

          const onlyVariant =
            variants[0] ?? null;

          const currentPrice = Number(
            onlyVariant?.price ??
              product.price ??
              0,
          );

          const storeInformation = {
            id: catalog.store.id,
            name: catalog.store.name,
            icon:
              catalog.store.icon || '🏪',
            categorySlug:
              catalog.store.categorySlug,
            deliveryFee: Number(
              catalog.delivery.deliveryFee ??
                0,
            ),
            minimumOrder: Number(
              catalog.delivery.minimumOrder ??
                0,
            ),
          };

          const cartProduct = {
            id: product.id,
            name: product.name,
            description:
              product.description || '',
            price: currentPrice,
            icon: product.icon || '📦',
            variantId:
              onlyVariant?.id ?? null,
            variantName:
              onlyVariant?.name ?? null,
            requiresPrescription:
              'requiresPrescription' in
                product &&
              product.requiresPrescription ===
                true,
            isAgeRestricted:
              product.isAgeRestricted === true,
          };

          await clearSearchAttribution();

          if (
            !isMountedRef.current ||
            !isFocusedRef.current
          ) {
            return;
          }

          const addResult =
            useCartStore
              .getState()
              .addItem(
                storeInformation,
                cartProduct,
              );

          if (addResult !== 'added') {
            Alert.alert(
              'تعذر إضافة المنتج',
              'مقدرناش نضيف المنتج للسلة الحالية. جرّب فتح المتجر وإضافته من هناك.',
              [
                {
                  text: 'إلغاء',
                  style: 'cancel',
                },
                {
                  text: 'فتح المتجر',
                  onPress: () => {
                    openStore(result.storeId);
                  },
                },
              ],
            );
            return;
          }

          useCartStore
            .getState()
            .setActiveCart(
              catalog.store.id,
            );

          router.push({
            pathname: '/cart',
            params: {
              storeId: catalog.store.id,
            },
          });
        } catch (error) {
          console.warn(
            'Unable to quick-add For You product.',
            recommendation.id,
            error,
          );

          Alert.alert(
            'تعذر إضافة المنتج',
            'مقدرناش نراجع المنتج ونضيفه للسلة دلوقتي. جرّب مرة تانية.',
          );
        } finally {
          actionInFlightRef.current = false;

          if (isMountedRef.current) {
            setAddingRecommendationId(null);
          }
        }
      },
      [
        effectiveAreaId,
        openStore,
        router,
        savedServiceAreaId,
        storesById,
      ],
    );

  return {
    recommendations,
    addingRecommendationId,
    addRecommendationToCart,
  };
}
