import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useEffect,
  useState,
} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { StoreListScreenSkeleton } from '../../components/ui/loading-skeleton';
import {
  isV1PublicCategorySlug,
  V1_UNAVAILABLE_CATEGORY_MESSAGE,
} from '../../config/v1-release-scope';
import getAppBootstrap, {
  type AppBootstrap,
} from '../../services/bootstrap-service';
import {
  listStores,
  type StoreCategorySlug,
  type StoreSummary,
} from '../../services/catalog-service';
import { useCustomerStore } from '../../store/customer-store';
import BookstoreScreen from './bookstore';
import LaundryScreen from './laundry';
import RestaurantsScreen from './restaurants';

type BootstrapCategory =
  AppBootstrap['store_categories'][number] & {
    subtitle_ar?: string | null;
  };

const BOOKSTORE_ALIASES = new Set([
  'bookstore',
  'library',
  'books',
  'stationery',
]);

const LAUNDRY_ALIASES = new Set([
  'laundry',
  'laundry-ironing',
  'wash-and-iron',
  'washing-ironing',
]);

export default function CategoryRouteScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const rawId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const normalizedId = (rawId ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');

  if (normalizedId === 'restaurants') {
    return <RestaurantsScreen />;
  }

  if (
    normalizedId &&
    BOOKSTORE_ALIASES.has(normalizedId)
  ) {
    return <BookstoreScreen />;
  }

  if (
    normalizedId &&
    LAUNDRY_ALIASES.has(normalizedId)
  ) {
    return <LaundryScreen />;
  }

  return (
    <GenericCategoryScreen
      categorySlug={rawId ?? ''}
    />
  );
}

function StoreArtwork({
  store,
}: {
  store: StoreSummary;
}) {
  const [imageFailed, setImageFailed] =
    useState(false);

  const imageUrl =
    store.logoUrl ?? store.coverImageUrl;
  const canShowImage =
    Boolean(imageUrl) && !imageFailed;

  return (
    <View style={styles.storeArtwork}>
      {canShowImage ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={`صورة ${store.name}`}
          resizeMode={
            store.logoUrl ? 'contain' : 'cover'
          }
          source={{ uri: imageUrl ?? '' }}
          style={styles.storeImage}
          onError={() => {
            setImageFailed(true);
          }}
        />
      ) : (
        <Text style={styles.storeIcon}>
          {store.icon || '🏪'}
        </Text>
      )}
    </View>
  );
}

function GenericCategoryScreen({
  categorySlug,
}: {
  categorySlug: string;
}) {
  const router = useRouter();

  const savedServiceAreaId =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaId,
    );

  const [category, setCategory] =
    useState<BootstrapCategory | null>(null);
  const [stores, setStores] = useState<
    StoreSummary[]
  >([]);
  const [isLoading, setIsLoading] =
    useState(true);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  async function loadCategoryData() {
    if (
      !categorySlug ||
      !isV1PublicCategorySlug(
        categorySlug,
      )
    ) {
      setCategory(null);
      setStores([]);
      setErrorMessage(
        categorySlug
          ? V1_UNAVAILABLE_CATEGORY_MESSAGE
          : 'لم يتم تحديد القسم المطلوب.',
      );
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const [bootstrap, loadedStores] =
        await Promise.all([
          getAppBootstrap(),
          listStores({
            categorySlug:
              categorySlug as StoreCategorySlug,
            serviceAreaId:
              savedServiceAreaId ?? undefined,
          }),
        ]);

      const loadedCategory =
        (
          bootstrap.store_categories as
            BootstrapCategory[]
        ).find(
          (item) => item.slug === categorySlug,
        ) ?? null;

      if (!loadedCategory) {
        throw new Error(
          'القسم غير موجود أو غير مفعّل.',
        );
      }

      setCategory(loadedCategory);
      setStores(loadedStores);
    } catch (error) {
      setCategory(null);
      setStores([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل القسم.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCategoryData();
  }, [
    categorySlug,
    savedServiceAreaId,
  ]);

  if (isLoading) {
    return <StoreListScreenSkeleton />;
  }

  if (!category || errorMessage) {
    return (
      <View style={styles.stateScreen}>
        <Text style={styles.stateIcon}>📦</Text>
        <Text style={styles.stateTitle}>
          القسم غير متاح
        </Text>
        <Text style={styles.stateDescription}>
          {errorMessage ??
            'لم نتمكن من العثور على القسم.'}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.pressed,
          ]}
          onPress={() => {
            void loadCategoryData();
          }}
        >
          <Text style={styles.retryButtonText}>
            إعادة المحاولة
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.homeButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.homeButtonText}>
            العودة للرئيسية
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="العودة"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.backIcon}>›</Text>
          </Pressable>

          <View style={styles.headerContent}>
            <Text style={styles.categoryIcon}>
              {category.icon ?? '📦'}
            </Text>
            <Text style={styles.title}>
              {category.name_ar}
            </Text>
            <Text style={styles.subtitle}>
              {category.subtitle_ar ??
                'اختر المكان الذي تريد الطلب منه.'}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.storeCount}>
            {stores.length} متاح
          </Text>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>
              الأماكن المتاحة
            </Text>
            <Text style={styles.sectionSubtitle}>
              اختر المكان المناسب لطلبك
            </Text>
          </View>
        </View>

        {stores.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏪</Text>
            <Text style={styles.emptyTitle}>
              لا توجد أماكن متاحة
            </Text>
            <Text style={styles.emptyDescription}>
              لا توجد أماكن مفعلة لهذا القسم في الوقت الحالي.
            </Text>
          </View>
        ) : (
          <View style={styles.storesList}>
            {stores.map((store) => (
              <Pressable
                key={store.id}
                accessibilityLabel={`فتح ${store.name}`}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.storeCard,
                  pressed && styles.storeCardPressed,
                ]}
                onPress={() =>
                  router.push({
                    pathname: '/store/[id]',
                    params: { id: store.id },
                  })
                }
              >
                <StoreArtwork store={store} />

                <View style={styles.storeContent}>
                  <View style={styles.storeTitleRow}>
                    {store.isFeatured && (
                      <Text style={styles.featuredBadge}>
                        مميز
                      </Text>
                    )}
                    <Text
                      numberOfLines={1}
                      style={styles.storeName}
                    >
                      {store.name}
                    </Text>
                  </View>

                  <Text
                    numberOfLines={2}
                    style={styles.storeDescription}
                  >
                    {store.description ||
                      'اضغط لعرض المنتجات المتاحة.'}
                  </Text>

                  <View style={styles.storeMetaRow}>
                    <Text style={styles.storeMetaText}>
                      ⭐ {store.rating.toFixed(1)}
                    </Text>
                    <Text style={styles.storeMetaText}>
                      {store.deliveryTime ||
                        `${store.estimatedDeliveryMinutes ?? '-'} دقيقة`}
                    </Text>
                    <Text style={styles.storeMetaText}>
                      توصيل {store.deliveryFee} ج.م
                    </Text>
                  </View>

                  {store.isManuallyClosed && (
                    <Text style={styles.closedMessage}>
                      {store.manualClosedNote ||
                        'المتجر مغلق مؤقتًا'}
                    </Text>
                  )}
                </View>

                <Text style={styles.storeArrow}>‹</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F7F7FA',
    flex: 1,
  },
  pageContent: {
    flexGrow: 1,
    paddingBottom: 42,
    paddingHorizontal: 18,
    paddingTop: 42,
  },
  container: {
    alignSelf: 'center',
    maxWidth: 560,
    width: '100%',
  },
  header: {
    backgroundColor: '#6D56DF',
    borderRadius: 28,
    minHeight: 220,
    padding: 21,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 34,
  },
  headerContent: {
    alignItems: 'flex-end',
    marginTop: 10,
  },
  categoryIcon: {
    fontSize: 38,
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '900',
    textAlign: 'right',
  },
  subtitle: {
    color: '#ECE9FF',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 7,
    textAlign: 'right',
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 28,
  },
  storeCount: {
    backgroundColor: '#EEEAFE',
    borderRadius: 999,
    color: '#5F49C6',
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sectionCopy: {
    alignItems: 'flex-end',
  },
  sectionTitle: {
    color: '#1D1D22',
    fontSize: 20,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: '#85858C',
    fontSize: 11,
    marginTop: 4,
  },
  storesList: {
    gap: 12,
  },
  storeCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E8EC',
    borderRadius: 21,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 112,
    padding: 12,
  },
  storeCardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.992 }],
  },
  storeArtwork: {
    alignItems: 'center',
    backgroundColor: '#F0EDFF',
    borderRadius: 17,
    height: 78,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 78,
  },
  storeImage: {
    height: '100%',
    width: '100%',
  },
  storeIcon: {
    fontSize: 36,
  },
  storeContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  storeTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'flex-end',
  },
  featuredBadge: {
    backgroundColor: '#FFF0CD',
    borderRadius: 999,
    color: '#8A5C08',
    fontSize: 8,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  storeName: {
    color: '#1E1E23',
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  storeDescription: {
    color: '#77777E',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
    textAlign: 'right',
  },
  storeMetaRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  storeMetaText: {
    color: '#5D5D64',
    fontSize: 9,
    fontWeight: '700',
  },
  closedMessage: {
    color: '#C43E3E',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 7,
    textAlign: 'right',
  },
  storeArrow: {
    color: '#6D56DF',
    fontSize: 27,
    lineHeight: 29,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E8EC',
    borderRadius: 22,
    borderWidth: 1,
    padding: 28,
  },
  emptyIcon: {
    fontSize: 42,
  },
  emptyTitle: {
    color: '#202024',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 11,
  },
  emptyDescription: {
    color: '#7C7C83',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center',
  },
  stateScreen: {
    alignItems: 'center',
    backgroundColor: '#F7F7FA',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  stateIcon: {
    fontSize: 50,
  },
  stateTitle: {
    color: '#1D1D22',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 17,
    textAlign: 'center',
  },
  stateDescription: {
    color: '#77777E',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#6D56DF',
    borderRadius: 15,
    marginTop: 22,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  homeButton: {
    borderColor: '#DCDCE2',
    borderRadius: 15,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  homeButtonText: {
    color: '#55555C',
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.985 }],
  },
});