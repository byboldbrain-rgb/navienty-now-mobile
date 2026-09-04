import {
  useFocusEffect,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';

import AppBottomNavigation from '../category/app-bottom-navigation';
import DynamicCampaignPopup from '../components/dynamic-campaign-popup';
import {
  CategoryStrip,
  ForYouRail,
  HomeDiscoveryRail,
  HomeFatalError,
  HomeGlobalSearchEntry,
  HomeHeader,
  HomeLoadingSkeleton,
  RecentOrdersRail,
  RecentlyViewedRail,
} from '../features/home/home-components';
import { showClosedStoreAlert } from '../features/home/home-feedback';
import {
  type BootstrapCategory,
  type HomeDiscoveryItem,
  type RecentlyViewedItem,
  buildHomeCategories,
  getCairoHour,
  getHomeDiscoveryContext,
} from '../features/home/home-model';
import { ActiveOrderTrackingCard } from '../features/home/home-order-components';
import {
  getRecentlyViewedItems,
  subscribeRecentlyViewed,
  trackBehaviorEvent,
} from '../features/home/home-personalization-compat';
import { styles } from '../features/home/home-screen.styles';
import { useAuthSession } from '../hooks/use-auth-session';
import { useHomeCampaignPopup } from '../hooks/use-home-campaign-popup';
import { useHomeForYou } from '../hooks/use-home-for-you';
import { useHomeOrdersSync } from '../hooks/use-home-orders-sync';
import { useHomeScreenData } from '../hooks/use-home-screen-data';
import { useCustomerStore } from '../store/customer-store';
import {
  type Order,
  useOrdersStore,
} from '../store/orders-store';
import { NAVIENTY_NOW_LAYOUT } from '../theme/navienty-now-theme';

export default function HomeScreen() {
  const router = useRouter();
  const { width: windowWidth } =
    useWindowDimensions();
  const authState = useAuthSession();

  const [
    discoveryHour,
    setDiscoveryHour,
  ] = useState(() => getCairoHour());

  const [
    recentlyViewedItems,
    setRecentlyViewedItems,
  ] = useState<RecentlyViewedItem[]>(
    [],
  );

  const savedServiceAreaId =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaId,
    );

  const {
    bootstrap,
    homeCategoryTiles,
    isBootstrapLoading,
    bootstrapError,
    effectiveLocation,
    stores,
    homeSearchSuggestions,
    reloadBootstrap,
  } = useHomeScreenData(
    savedServiceAreaId,
  );

  const orders = useOrdersStore(
    (state) => state.orders,
  );

  const pendingOrder = useOrdersStore(
    (state) => state.pendingOrder,
  );

  const ordersHasHydrated =
    useOrdersStore(
      (state) => state.hasHydrated,
    );

  const currentUserId =
    authState.status === 'anonymous' ||
    authState.status === 'signedIn'
      ? authState.session.user.id
      : null;

  const activeOrders = useMemo(() => {
    const uniqueOrders =
      new Map<string, Order>();

    orders.forEach((order) => {
      uniqueOrders.set(
        order.id,
        order,
      );
    });

    if (pendingOrder) {
      uniqueOrders.set(
        pendingOrder.id,
        pendingOrder,
      );
    }

    return Array.from(
      uniqueOrders.values(),
    )
      .filter(
        (order) =>
          order.status !== 'delivered' &&
          order.status !== 'cancelled',
      )
      .sort(
        (firstOrder, secondOrder) =>
          new Date(
            secondOrder.createdAt,
          ).getTime() -
          new Date(
            firstOrder.createdAt,
          ).getTime(),
      );
  }, [orders, pendingOrder]);

  const recentDeliveredOrders =
    useMemo(
      () =>
        orders
          .filter(
            (order) =>
              order.status ===
              'delivered',
          )
          .sort(
            (
              firstOrder,
              secondOrder,
            ) => {
              const firstTimestamp =
                new Date(
                  firstOrder.deliveredAt ??
                    firstOrder.updatedAt ??
                    firstOrder.createdAt,
                ).getTime();

              const secondTimestamp =
                new Date(
                  secondOrder.deliveredAt ??
                    secondOrder.updatedAt ??
                    secondOrder.createdAt,
                ).getTime();

              return (
                secondTimestamp -
                firstTimestamp
              );
            },
          )
          .slice(0, 4),
      [orders],
    );

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

  useHomeOrdersSync({
    currentUserId,
    hasHydrated: ordersHasHydrated,
    hasActiveOrders:
      activeOrders.length > 0,
  });

  /*
   * Keep recently viewed stores synchronized while Home is visible. This is a
   * compatibility boundary in the current release workspace; failures are
   * still handled so restoring the real service cannot create unhandled
   * promise rejections in the route.
   */
  useFocusEffect(
    useCallback(() => {
      let active = true;

      const syncRecentlyViewed =
        async () => {
          try {
            const items =
              await getRecentlyViewedItems(
                6,
              );

            if (active) {
              setRecentlyViewedItems(
                items,
              );
            }
          } catch (error) {
            if (active) {
              setRecentlyViewedItems([]);
            }

            if (__DEV__) {
              console.warn(
                'Unable to load Home recently viewed items.',
                error,
              );
            }
          }
        };

      void syncRecentlyViewed();

      const unsubscribe =
        subscribeRecentlyViewed(
          (items) => {
            if (active) {
              setRecentlyViewedItems(
                items.slice(0, 6),
              );
            }
          },
        );

      return () => {
        active = false;
        unsubscribe();
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      const syncDiscoveryHour = () => {
        const nextHour =
          getCairoHour();

        setDiscoveryHour(
          (currentHour) =>
            currentHour === nextHour
              ? currentHour
              : nextHour,
        );
      };

      syncDiscoveryHour();

      const timer = setInterval(
        syncDiscoveryHour,
        60 * 1000,
      );

      return () => {
        clearInterval(timer);
      };
    }, []),
  );

  const isSignedIn =
    authState.status === 'signedIn';

  const categories = useMemo(
    () =>
      buildHomeCategories(
        (bootstrap?.store_categories ??
          []) as BootstrapCategory[],
        homeCategoryTiles,
      ),
    [bootstrap, homeCategoryTiles],
  );

  const discoveryContext = useMemo(
    () =>
      getHomeDiscoveryContext(
        discoveryHour,
      ),
    [discoveryHour],
  );

  const contentWidth = Math.min(
    windowWidth,
    NAVIENTY_NOW_LAYOUT.contentMaxWidth,
  );

  const bannerContentWidth = Math.max(
    1,
    contentWidth -
      NAVIENTY_NOW_LAYOUT.pageGutter * 2,
  );

  const activeOrderCardWidth = Math.min(
    420,
    Math.max(1, bannerContentWidth),
  );

  const compactCardWidth = Math.min(
    96,
    Math.max(
      80,
      Math.floor(
        (bannerContentWidth - 30) / 4,
      ),
    ),
  );

  const effectiveServiceAreaId =
    effectiveLocation?.areaId ??
    savedServiceAreaId ??
    null;

  const {
    recommendations: forYouRecommendations,
    addingRecommendationId:
      addingForYouRecommendationId,
    addRecommendationToCart,
  } = useHomeForYou({
    effectiveServiceAreaId,
    effectiveAreaId:
      effectiveLocation?.areaId ?? null,
    savedServiceAreaId,
    orders,
    stores,
  });

  const campaignAudience =
    isBootstrapLoading
      ? null
      : authState.status === 'signedIn'
        ? 'signed_in'
        : authState.status === 'anonymous'
          ? 'signed_out'
          : null;

  const {
    campaign: campaignPopup,
    visible: isCampaignPopupVisible,
    dismiss: dismissCampaignPopup,
    markPresented: markCampaignPopupPresented,
    runPrimaryAction:
      runCampaignPopupPrimaryAction,
  } = useHomeCampaignPopup({
    audience: campaignAudience,
    serviceAreaId:
      effectiveServiceAreaId,
  });

  function openCategory(
    categorySlug: string,
  ) {
    const normalizedSlug = categorySlug
      .trim()
      .toLowerCase()
      .replace(/_/g, '-');

    if (normalizedSlug === 'supermarket') {
      router.push('/category/supermarket');
      return;
    }

    if (
      normalizedSlug === 'bookstore' ||
      normalizedSlug === 'bookstores' ||
      normalizedSlug === 'book-store' ||
      normalizedSlug === 'library' ||
      normalizedSlug === 'books' ||
      normalizedSlug === 'stationery'
    ) {
      router.push('/category/bookstore');
      return;
    }

    if (
      normalizedSlug === 'personal-care' ||
      normalizedSlug === 'personalcare' ||
      normalizedSlug === 'beauty' ||
      normalizedSlug === 'beauty-care' ||
      normalizedSlug === 'health-beauty' ||
      normalizedSlug === 'care'
    ) {
      router.push('/category/personal-care');
      return;
    }

    if (
      normalizedSlug === 'laundry' ||
      normalizedSlug ===
        'laundry-ironing' ||
      normalizedSlug ===
        'wash-and-iron' ||
      normalizedSlug ===
        'washing-ironing'
    ) {
      router.push('/category/laundry');
      return;
    }

    if (
      normalizedSlug ===
        'request-anything' ||
      normalizedSlug === 'anything' ||
      normalizedSlug === 'other' ||
      normalizedSlug ===
        'special-request'
    ) {
      router.push(
        '/category/request-anything',
      );
      return;
    }

    router.push({
      pathname: '/category/[id]',
      params: {
        id: categorySlug,
      },
    });
  }

  function openDiscoveryItem(
    item: HomeDiscoveryItem,
  ) {
    const destination = item.destination;

    switch (destination.type) {
      case 'restaurant-cuisine': {
        router.push({
          pathname:
            '/category/restaurants',
          params: {
            cuisine:
              destination.cuisineKey,
          },
        });
        return;
      }

      case 'supermarket-category': {
        router.push({
          pathname:
            '/supermarket-category/[slug]',
          params: {
            slug: destination.slug,
            categoryKey:
              destination.slug,
            label: item.label,
          },
        });
        return;
      }

      case 'bookstore-category': {
        router.push({
          pathname:
            '/bookstore-category/[slug]',
          params: {
            slug: destination.slug,
            categoryKey:
              destination.slug,
            label: item.label,
          },
        });
        return;
      }

      case 'personal-care-category': {
        router.push({
          pathname:
            '/personal-care-category/[slug]',
          params: {
            slug: destination.slug,
            categoryKey:
              destination.slug,
            label: item.label,
          },
        });
        return;
      }
    }
  }

  function openStore(storeId: string) {
    router.push({
      pathname: '/store/[id]',
      params: {
        id: storeId,
      },
    });
  }

  function openRecentOrderStore(
    order: Order,
  ) {
    const orderStore =
      storesById.get(order.storeId) ??
      null;

    if (orderStore?.isManuallyClosed) {
      showClosedStoreAlert(
        orderStore.name ||
          order.storeName,
        orderStore.manualClosedNote,
      );
      return;
    }

    openStore(order.storeId);
  }

  function openActiveOrder(
    orderId: string,
  ) {
    router.push({
      pathname: '/order-success',
      params: {
        id: orderId,
      },
    });
  }

  function openRecentlyViewedItem(
    item: RecentlyViewedItem,
  ) {
    if (item.kind !== 'store') {
      return;
    }

    void trackBehaviorEvent({
      eventName:
        'recently_viewed_clicked',
      serviceAreaId:
        effectiveLocation?.areaId ??
        savedServiceAreaId ??
        null,
      properties: {
        item_id: item.id,
        item_type: item.kind,
        store_id: item.storeId,
        store_category_slug:
          item.storeCategorySlug,
      },
    });

    openStore(item.storeId);
  }

  function openSearch() {
    router.push('/search');
  }

  if (isBootstrapLoading) {
    return <HomeLoadingSkeleton />;
  }

  if (
    !bootstrap ||
    !effectiveLocation ||
    bootstrapError
  ) {
    return (
      <HomeFatalError
        message={
          bootstrapError ??
          'لم تصل بيانات التطبيق من Supabase.'
        }
        onRetry={() => {
          void reloadBootstrap();
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={
          styles.pageContent
        }
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader />

        <View
          style={[
            styles.contentShell,
            {
              maxWidth: contentWidth,
            },
          ]}
        >
          <HomeGlobalSearchEntry
            suggestions={
              homeSearchSuggestions
            }
            onPress={openSearch}
          />

          <CategoryStrip
            categories={categories}
            onPressCategory={openCategory}
          />

          {activeOrders.length > 0 ? (
            <ScrollView
              horizontal
              alwaysBounceHorizontal={false}
              bounces={false}
              contentContainerStyle={
                styles.activeOrdersRailContent
              }
              decelerationRate="fast"
              directionalLockEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={
                false
              }
              snapToAlignment="start"
              snapToInterval={
                activeOrderCardWidth + 12
              }
              style={styles.activeOrdersRail}
            >
              {activeOrders.map((order) => (
                <ActiveOrderTrackingCard
                  key={order.id}
                  cardWidth={
                    activeOrderCardWidth
                  }
                  order={order}
                  store={
                    storesById.get(
                      order.storeId,
                    ) ?? null
                  }
                  onPress={() => {
                    openActiveOrder(
                      order.id,
                    );
                  }}
                />
              ))}
            </ScrollView>
          ) : null}

          {recentDeliveredOrders.length >
          0 ? (
            <RecentOrdersRail
              cardWidth={compactCardWidth}
              orders={recentDeliveredOrders}
              stores={stores}
              onPressStore={
                openRecentOrderStore
              }
            />
          ) : null}

          <RecentlyViewedRail
            cardWidth={compactCardWidth}
            items={recentlyViewedItems}
            stores={stores}
            onPressItem={
              openRecentlyViewedItem
            }
          />

          <ForYouRail
            addingRecommendationId={
              addingForYouRecommendationId
            }
            cardWidth={compactCardWidth}
            items={forYouRecommendations}
            onPressItem={(item) => {
              void addRecommendationToCart(
                item,
              );
            }}
          />

          <HomeDiscoveryRail
            items={discoveryContext.items}
            onPressItem={openDiscoveryItem}
          />
        </View>
      </ScrollView>

      <AppBottomNavigation
        activeTab="home"
        isSignedIn={isSignedIn}
      />

      <DynamicCampaignPopup
        campaign={campaignPopup}
        visible={isCampaignPopupVisible}
        onDismiss={dismissCampaignPopup}
        onPresented={markCampaignPopupPresented}
        onPrimaryAction={
          runCampaignPopupPrimaryAction
        }
      />
    </View>
  );
}
