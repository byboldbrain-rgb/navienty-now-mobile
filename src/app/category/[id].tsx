import {
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import {
    useEffect,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import getAppBootstrap, {
    type AppBootstrap,
} from '../../services/bootstrap-service';
import {
    type StoreCategorySlug,
    type StoreSummary,
    listStores,
} from '../../services/catalog-service';

type BootstrapCategory =
  AppBootstrap['store_categories'][number] & {
    subtitle_ar?: string | null;
    subtitle_en?: string | null;
  };

export default function CategoryScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const rawId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [category, setCategory] =
    useState<BootstrapCategory | null>(
      null,
    );

  const [stores, setStores] =
    useState<StoreSummary[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

  async function loadCategoryData() {
    if (!rawId) {
      setCategory(null);
      setStores([]);
      setErrorMessage(
        'لم يتم تحديد القسم المطلوب.',
      );
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const [
        loadedBootstrap,
        loadedStores,
      ] = await Promise.all([
        getAppBootstrap(),

        listStores({
          categorySlug:
            rawId as StoreCategorySlug,
        }),
      ]);

      const loadedCategories =
        loadedBootstrap
          .store_categories as
          BootstrapCategory[];

      const loadedCategory =
        loadedCategories.find(
          (currentCategory) =>
            currentCategory.slug ===
            rawId,
        ) ?? null;

      if (!loadedCategory) {
        setCategory(null);
        setStores([]);
        setErrorMessage(
          'القسم غير موجود أو غير مفعّل.',
        );
        return;
      }

      setCategory(loadedCategory);
      setStores(loadedStores);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحميل القسم من Supabase.';

      setCategory(null);
      setStores([]);
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCategoryData();
  }, [rawId]);

  if (isLoading) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator
          size="large"
          color="#6d56df"
        />

        <Text style={styles.stateTitle}>
          جاري تحميل المتاجر
        </Text>

        <Text
          style={styles.stateDescription}
        >
          يتم تحميل القسم والمتاجر
          المتاحة من Supabase.
        </Text>
      </View>
    );
  }

  if (!category || errorMessage) {
    return (
      <View style={styles.stateScreen}>
        <Text style={styles.stateIcon}>
          📦
        </Text>

        <Text style={styles.stateTitle}>
          القسم غير متاح
        </Text>

        <Text
          style={styles.stateDescription}
        >
          {errorMessage ??
            'لم نتمكن من العثور على القسم.'}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed &&
              styles.buttonPressed,
          ]}
          onPress={() => {
            void loadCategoryData();
          }}
        >
          <Text
            style={styles.retryButtonText}
          >
            إعادة المحاولة
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.backHomeButton,
            pressed &&
              styles.buttonPressed,
          ]}
          onPress={() =>
            router.replace('/')
          }
        >
          <Text
            style={
              styles.backHomeButtonText
            }
          >
            العودة للرئيسية
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.pageContent
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed &&
                styles.buttonPressed,
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.backIcon}>
              ›
            </Text>
          </Pressable>

          <View
            style={styles.headerContent}
          >
            <Text
              style={styles.categoryIcon}
            >
              {category.icon ?? '📦'}
            </Text>

            <Text style={styles.title}>
              {category.name_ar}
            </Text>

            <Text style={styles.subtitle}>
              {category.subtitle_ar ??
                'اختر المتجر الذي تريد الطلب منه'}
            </Text>
          </View>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            المتاجر والأسعار المعروضة
            تُحمّل مباشرة من Supabase
          </Text>
        </View>

        <View
          style={styles.sectionHeader}
        >
          <Text style={styles.storeCount}>
            {stores.length} متاجر
          </Text>

          <Text style={styles.sectionTitle}>
            المتاجر المتاحة
          </Text>
        </View>

        {stores.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text
              style={styles.emptyIcon}
            >
              🏪
            </Text>

            <Text
              style={styles.emptyTitle}
            >
              لا توجد متاجر متاحة
            </Text>

            <Text
              style={
                styles.emptyDescription
              }
            >
              لا توجد متاجر مفعّلة لهذا
              القسم في منطقة التوصيل
              الحالية.
            </Text>
          </View>
        ) : (
          <View style={styles.stores}>
            {stores.map((store) => (
              <Pressable
                key={store.id}
                style={({ pressed }) => [
                  styles.storeCard,
                  pressed &&
                    styles.storeCardPressed,
                ]}
                onPress={() =>
                  router.push({
                    pathname:
                      '/store/[id]',
                    params: {
                      id: store.id,
                    },
                  })
                }
              >
                <View
                  style={
                    styles.storeIconContainer
                  }
                >
                  <Text
                    style={styles.storeIcon}
                  >
                    {store.icon}
                  </Text>
                </View>

                <View
                  style={
                    styles.storeContent
                  }
                >
                  <View
                    style={
                      styles.storeTitleRow
                    }
                  >
                    {store.isFeatured && (
                      <Text
                        style={
                          styles.featuredBadge
                        }
                      >
                        مميز
                      </Text>
                    )}

                    <Text
                      style={
                        styles.storeName
                      }
                    >
                      {store.name}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.storeDescription
                    }
                  >
                    {store.description}
                  </Text>

                  <View
                    style={
                      styles.deliveryRow
                    }
                  >
                    <Text
                      style={
                        styles.deliveryTime
                      }
                    >
                      {store.deliveryTime ||
                        `${store.estimatedDeliveryMinutes ?? '-'} دقيقة`}
                    </Text>

                    <Text
                      style={
                        styles.deliveryLabel
                      }
                    >
                      وقت التوصيل
                    </Text>
                  </View>

                  <View
                    style={
                      styles.storeMetaRow
                    }
                  >
                    <Text
                      style={
                        styles.storeMetaValue
                      }
                    >
                      ⭐ {store.rating}
                    </Text>

                    <Text
                      style={
                        styles.storeMetaValue
                      }
                    >
                      توصيل{' '}
                      {store.deliveryFee}{' '}
                      ج.م
                    </Text>

                    <Text
                      style={
                        styles.storeMetaValue
                      }
                    >
                      حد أدنى{' '}
                      {store.minimumOrder}{' '}
                      ج.م
                    </Text>
                  </View>

                  {store.isManuallyClosed && (
                    <Text
                      style={
                        styles.closedMessage
                      }
                    >
                      {store.manualClosedNote ??
                        'المتجر مغلق مؤقتًا'}
                    </Text>
                  )}
                </View>

                <Text
                  style={styles.storeArrow}
                >
                  ‹
                </Text>
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
    flex: 1,
    backgroundColor: '#f7f7fa',
  },

  pageContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 42,
    paddingBottom: 40,
  },

  container: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },

  header: {
    backgroundColor: '#6d56df',
    borderRadius: 28,
    minHeight: 230,
    padding: 22,
  },

  backButton: {
    alignItems: 'center',
    backgroundColor:
      'rgba(255,255,255,0.18)',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },

  backIcon: {
    color: '#ffffff',
    fontSize: 33,
    lineHeight: 35,
  },

  headerContent: {
    alignItems: 'flex-end',
    marginTop: 10,
  },

  categoryIcon: {
    fontSize: 38,
    marginBottom: 10,
  },

  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'right',
  },

  subtitle: {
    color: '#edeaff',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'right',
  },

  notice: {
    backgroundColor: '#e9f7ee',
    borderRadius: 16,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },

  noticeText: {
    color: '#246343',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },

  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 28,
  },

  sectionTitle: {
    color: '#1d1d22',
    fontSize: 20,
    fontWeight: '800',
  },

  storeCount: {
    color: '#777781',
    fontSize: 13,
    fontWeight: '600',
  },

  stores: {
    gap: 13,
  },

  storeCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 21,
    flexDirection: 'row',
    minHeight: 112,
    padding: 16,
  },

  storeCardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  storeIconContainer: {
    alignItems: 'center',
    backgroundColor: '#f1efff',
    borderRadius: 18,
    height: 66,
    justifyContent: 'center',
    width: 66,
  },

  storeIcon: {
    fontSize: 31,
  },

  storeContent: {
    flex: 1,
    marginHorizontal: 14,
  },

  storeTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  featuredBadge: {
    backgroundColor: '#fff3d6',
    borderRadius: 9,
    color: '#9a6900',
    fontSize: 9,
    fontWeight: '900',
    marginRight: 7,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  storeName: {
    color: '#202025',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'right',
  },

  storeDescription: {
    color: '#777781',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 4,
    textAlign: 'right',
  },

  deliveryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },

  deliveryTime: {
    color: '#6d56df',
    fontSize: 11,
    fontWeight: '700',
  },

  deliveryLabel: {
    color: '#9999a2',
    fontSize: 11,
    marginLeft: 6,
  },

  storeMetaRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 8,
  },

  storeMetaValue: {
    color: '#777781',
    fontSize: 9,
    fontWeight: '700',
  },

  closedMessage: {
    color: '#a13333',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'right',
  },

  storeArrow: {
    color: '#6d56df',
    fontSize: 31,
  },

  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 25,
  },

  emptyIcon: {
    fontSize: 42,
  },

  emptyTitle: {
    color: '#222228',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
  },

  emptyDescription: {
    color: '#777781',
    fontSize: 12,
    lineHeight: 20,
    marginTop: 7,
    maxWidth: 330,
    textAlign: 'center',
  },

  stateScreen: {
    alignItems: 'center',
    backgroundColor: '#f7f7fa',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },

  stateIcon: {
    fontSize: 48,
  },

  stateTitle: {
    color: '#222228',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 16,
    textAlign: 'center',
  },

  stateDescription: {
    color: '#777781',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 350,
    textAlign: 'center',
  },

  retryButton: {
    backgroundColor: '#6d56df',
    borderRadius: 15,
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },

  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },

  backHomeButton: {
    backgroundColor: '#ffffff',
    borderColor: '#e8e8ed',
    borderRadius: 15,
    borderWidth: 1,
    marginTop: 11,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },

  backHomeButtonText: {
    color: '#5d47d2',
    fontSize: 14,
    fontWeight: '800',
  },

  buttonPressed: {
    opacity: 0.75,
  },
});
