import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image,
  KeyboardAvoidingView,
  StatusBar as NativeStatusBar,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import getAppBootstrap, {
  type AppBootstrap,
} from '../services/bootstrap-service';
import {
  type StoreSummary,
  listStores,
} from '../services/catalog-service';
import { useCustomerStore } from '../store/customer-store';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';

type SearchDataState =
  | {
      status: 'loading';
      bootstrap: null;
      stores: StoreSummary[];
      errorMessage: null;
    }
  | {
      status: 'ready';
      bootstrap: AppBootstrap;
      stores: StoreSummary[];
      errorMessage: null;
    }
  | {
      status: 'error';
      bootstrap: null;
      stores: StoreSummary[];
      errorMessage: string;
    };

function getDefaultServiceAreaId(
  bootstrap: AppBootstrap,
): string | undefined {
  const configuredAreaId =
    bootstrap.settings
      .default_service_area_id;

  if (configuredAreaId) {
    return configuredAreaId;
  }

  return bootstrap.cities[0]?.areas[0]?.id;
}

function normalizeSearchValue(
  value: string,
): string {
  return value
    .trim()
    .toLocaleLowerCase('ar-EG')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

function SearchGlyph() {
  return (
    <View style={styles.searchGlyph}>
      <View style={styles.searchGlyphCircle} />
      <View style={styles.searchGlyphHandle} />
    </View>
  );
}

function StoreSearchArtwork({
  store,
}: {
  store: StoreSummary;
}) {
  const [imageFailed, setImageFailed] =
    useState(false);

  const imageUrl =
    store.logoUrl ?? store.coverImageUrl;

  if (imageUrl && !imageFailed) {
    return (
      <View style={styles.storeArtwork}>
        <Image
          accessibilityLabel={
            `صورة ${store.name}`
          }
          resizeMode={
            store.logoUrl ? 'contain' : 'cover'
          }
          source={{ uri: imageUrl }}
          style={styles.storeImage}
          onError={() => {
            setImageFailed(true);
          }}
        />

        {store.isManuallyClosed && (
          <View style={styles.closedOverlay}>
            <Text
              style={styles.closedOverlayText}
            >
              مغلق
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.storeArtwork}>
      <Text style={styles.storeFallbackIcon}>
        {store.icon || '🏪'}
      </Text>

      {store.isManuallyClosed && (
        <View style={styles.closedOverlay}>
          <Text
            style={styles.closedOverlayText}
          >
            مغلق
          </Text>
        </View>
      )}
    </View>
  );
}

function SearchResultCard({
  store,
  onPress,
}: {
  store: StoreSummary;
  onPress: () => void;
}) {
  const deliveryLabel =
    store.deliveryTime ||
    (store.estimatedDeliveryMinutes
      ? `${store.estimatedDeliveryMinutes} دقيقة تقريبًا`
      : 'تفاصيل التوصيل داخل المتجر');

  return (
    <Pressable
      accessibilityLabel={
        `فتح ${store.name}. ${store.categoryName}. ${deliveryLabel}.`
      }
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.resultCard,
        pressed && styles.resultCardPressed,
      ]}
      onPress={onPress}
    >
      <StoreSearchArtwork store={store} />

      <View style={styles.resultCopy}>
        <View style={styles.resultTitleRow}>
          {store.isFeatured && (
            <View style={styles.featuredBadge}>
              <Text
                style={styles.featuredBadgeText}
              >
                مميز
              </Text>
            </View>
          )}

          <Text
            numberOfLines={1}
            style={styles.resultTitle}
          >
            {store.name}
          </Text>
        </View>

        <Text
          numberOfLines={1}
          style={styles.resultCategory}
        >
          {store.categoryName}
        </Text>

        <View style={styles.resultMetaRow}>
          <Text
            style={[
              styles.resultStatus,
              store.isManuallyClosed &&
                styles.resultStatusClosed,
            ]}
          >
            {store.isManuallyClosed
              ? store.manualClosedNote ||
                'مغلق مؤقتًا'
              : 'متاح للطلب'}
          </Text>

          <Text style={styles.resultDelivery}>
            {deliveryLabel}
          </Text>
        </View>
      </View>

      <Text style={styles.resultArrow}>‹</Text>
    </Pressable>
  );
}

function SearchSkeleton() {
  return (
    <View style={styles.skeletonList}>
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          style={styles.skeletonCard}
        >
          <View style={styles.skeletonArtwork} />
          <View style={styles.skeletonCopy}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonMeta} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput | null>(null);
  const isMountedRef = useRef(true);

  const savedServiceAreaId =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaId,
    );

  const [query, setQuery] = useState('');
  const [dataState, setDataState] =
    useState<SearchDataState>({
      status: 'loading',
      bootstrap: null,
      stores: [],
      errorMessage: null,
    });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function loadSearchData() {
    try {
      setDataState({
        status: 'loading',
        bootstrap: null,
        stores: [],
        errorMessage: null,
      });

      const bootstrap =
        await getAppBootstrap();

      const stores = await listStores({
        serviceAreaId:
          savedServiceAreaId ??
          getDefaultServiceAreaId(
            bootstrap,
          ),
      });

      if (!isMountedRef.current) {
        return;
      }

      setDataState({
        status: 'ready',
        bootstrap,
        stores,
        errorMessage: null,
      });
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setDataState({
        status: 'error',
        bootstrap: null,
        stores: [],
        errorMessage:
          error instanceof Error
            ? error.message
            : 'تعذر تحميل البحث.',
      });
    }
  }

  useEffect(() => {
    void loadSearchData();

    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 250);

    return () => {
      clearTimeout(focusTimer);
    };
  }, [savedServiceAreaId]);

  const filteredStores = useMemo(() => {
    if (dataState.status !== 'ready') {
      return [];
    }

    const normalizedQuery =
      normalizeSearchValue(query);

    if (!normalizedQuery) {
      return dataState.stores;
    }

    return dataState.stores.filter(
      (store) => {
        const searchableText =
          normalizeSearchValue(
            [
              store.name,
              store.description,
              store.categoryName,
              store.categorySubtitle,
            ].join(' '),
          );

        return searchableText.includes(
          normalizedQuery,
        );
      },
    );
  }, [dataState, query]);

  const topInset =
    Platform.OS === 'android'
      ? (NativeStatusBar.currentHeight ?? 0)
      : Platform.OS === 'ios'
        ? 18
        : 12;

  function openStore(storeId: string) {
    router.push({
      pathname: '/store/[id]',
      params: {
        id: storeId,
      },
    });
  }

  return (
    <KeyboardAvoidingView
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
      style={styles.screen}
    >
      <StatusBar style="light" />

      <View
        style={[
          styles.header,
          {
            paddingTop: topInset + 12,
          },
        ]}
      >
        <View style={styles.headerInner}>
          <View style={styles.topRow}>
            <Pressable
              accessibilityLabel="العودة"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => router.back()}
            >
              <Text style={styles.backIcon}>›</Text>
            </Pressable>

            <View style={styles.titleCopy}>
              <Text style={styles.pageTitle}>
                البحث
              </Text>
              <Text style={styles.pageSubtitle}>
                ابحث داخل الأماكن المتاحة في منطقتك
              </Text>
            </View>
          </View>

          <View style={styles.searchField}>
            <SearchGlyph />

            <TextInput
              ref={inputRef}
              accessibilityLabel="اكتب اسم المكان أو القسم"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              placeholder="ابحث عن مطعم، سوبرماركت أو صيدلية"
              placeholderTextColor={
                NAVIENTY_NOW_COLORS.textMuted
              }
              returnKeyType="search"
              selectionColor={
                NAVIENTY_NOW_COLORS.primary
              }
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
            />

            {query.length > 0 &&
              Platform.OS !== 'ios' && (
                <Pressable
                  accessibilityLabel="مسح البحث"
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.clearButton,
                    pressed &&
                      styles.buttonPressed,
                  ]}
                  onPress={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                >
                  <Text
                    style={styles.clearButtonText}
                  >
                    ×
                  </Text>
                </Pressable>
              )}
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.pageContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          {dataState.status === 'loading' ? (
            <SearchSkeleton />
          ) : dataState.status === 'error' ? (
            <View style={styles.errorCard}>
              <View style={styles.errorIcon}>
                <Text style={styles.errorIconText}>
                  !
                </Text>
              </View>

              <Text style={styles.errorTitle}>
                تعذر تحميل الأماكن
              </Text>

              <Text style={styles.errorDescription}>
                {dataState.errorMessage}
              </Text>

              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed &&
                    styles.retryButtonPressed,
                ]}
                onPress={() => {
                  void loadSearchData();
                }}
              >
                <Text
                  style={styles.retryButtonText}
                >
                  إعادة المحاولة
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.resultsHeader}>
                <Text
                  style={styles.resultsCount}
                >
                  {filteredStores.length} مكان
                </Text>

                <Text style={styles.resultsTitle}>
                  {query.trim()
                    ? 'نتائج البحث'
                    : 'كل الأماكن المتاحة'}
                </Text>
              </View>

              {filteredStores.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>
                    ⌕
                  </Text>
                  <Text style={styles.emptyTitle}>
                    لا توجد نتائج مطابقة
                  </Text>
                  <Text
                    style={styles.emptyDescription}
                  >
                    جرّب كتابة اسم أقصر أو ابحث باسم القسم.
                  </Text>
                </View>
              ) : (
                <View style={styles.resultsList}>
                  {filteredStores.map((store) => (
                    <SearchResultCard
                      key={store.id}
                      store={store}
                      onPress={() => {
                        openStore(store.id);
                      }}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,
    flex: 1,
  },

  header: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    paddingBottom: 20,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
  },

  headerInner: {
    alignSelf: 'center',
    maxWidth:
      NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    width: '100%',
  },

  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 57,
  },

  backButton: {
    alignItems: 'center',
    backgroundColor:
      'rgba(255,255,255,0.16)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    marginRight: 12,
    width: 40,
  },

  backIcon: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 31,
    lineHeight: 32,
  },

  buttonPressed: {
    opacity: 0.62,
  },

  titleCopy: {
    alignItems: 'flex-end',
    flex: 1,
  },

  pageTitle: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  pageSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  searchField: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderRadius: 26,
    flexDirection: 'row-reverse',
    marginTop: 10,
    minHeight: 55,
    paddingHorizontal: 17,
  },

  searchGlyph: {
    height: 22,
    position: 'relative',
    width: 22,
  },

  searchGlyphCircle: {
    borderColor:
      NAVIENTY_NOW_COLORS.textMuted,
    borderRadius: 8,
    borderWidth: 2,
    height: 15,
    left: 1,
    position: 'absolute',
    top: 1,
    width: 15,
  },

  searchGlyphHandle: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.textMuted,
    borderRadius: 2,
    height: 2,
    left: 14,
    position: 'absolute',
    top: 15,
    transform: [{ rotate: '45deg' }],
    width: 7,
  },

  searchInput: {
    color: NAVIENTY_NOW_COLORS.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
    minHeight: 52,
    paddingVertical: 0,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  clearButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    marginLeft: 6,
    width: 28,
  },

  clearButtonText: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 20,
    lineHeight: 22,
  },

  pageContent: {
    paddingBottom: 42,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
  },

  contentContainer: {
    alignSelf: 'center',
    maxWidth:
      NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    paddingTop: 24,
    width: '100%',
  },

  resultsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  resultsTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  resultsCount: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },

  resultsList: {
    gap: 12,
  },

  resultCard: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    minHeight: 112,
    overflow: 'hidden',
    padding: 10,
  },

  resultCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.992 }],
  },

  storeArtwork: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderRadius: 15,
    height: 90,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 90,
  },

  storeImage: {
    height: '100%',
    width: '100%',
  },

  storeFallbackIcon: {
    fontSize: 34,
  },

  closedOverlay: {
    alignItems: 'center',
    backgroundColor:
      'rgba(20,20,20,0.54)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  closedOverlayText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 12,
    fontWeight: '900',
  },

  resultCopy: {
    alignItems: 'flex-end',
    flex: 1,
    marginHorizontal: 13,
  },

  resultTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    maxWidth: '100%',
  },

  featuredBadge: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 7,
    marginRight: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  featuredBadgeText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 9,
    fontWeight: '900',
  },

  resultTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  resultCategory: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
    marginTop: 5,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  resultMetaRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    marginTop: 10,
  },

  resultStatus: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '800',
  },

  resultStatusClosed: {
    color: NAVIENTY_NOW_COLORS.error,
  },

  resultDelivery: {
    color: NAVIENTY_NOW_COLORS.textMuted,
    fontSize: 9,
    marginRight: 9,
  },

  resultArrow: {
    color: NAVIENTY_NOW_COLORS.textMuted,
    fontSize: 29,
    lineHeight: 30,
  },

  emptyCard: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.majorRadius,
    padding: 32,
  },

  emptyIcon: {
    color:
      NAVIENTY_NOW_COLORS.primary,
    fontSize: 44,
    fontWeight: '500',
  },

  emptyTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 10,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  emptyDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  errorCard: {
    alignItems: 'center',
    backgroundColor: '#FFF8F8',
    borderColor: '#F1D7D7',
    borderRadius:
      NAVIENTY_NOW_LAYOUT.majorRadius,
    borderWidth: 1,
    padding: 28,
  },

  errorIcon: {
    alignItems: 'center',
    backgroundColor: '#FFEAEA',
    borderRadius: 29,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },

  errorIconText: {
    color: NAVIENTY_NOW_COLORS.error,
    fontSize: 28,
    fontWeight: '900',
  },

  errorTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 15,
    textAlign: 'center',
  },

  errorDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 7,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  retryButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 15,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 46,
    paddingHorizontal: 21,
  },

  retryButtonPressed: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPressed,
    transform: [{ scale: 0.985 }],
  },

  retryButtonText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 13,
    fontWeight: '900',
  },

  skeletonList: {
    gap: 12,
  },

  skeletonCard: {
    alignItems: 'center',
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    minHeight: 112,
    padding: 10,
  },

  skeletonArtwork: {
    backgroundColor: '#EEEEF0',
    borderRadius: 15,
    height: 90,
    width: 90,
  },

  skeletonCopy: {
    alignItems: 'flex-end',
    flex: 1,
    marginHorizontal: 14,
  },

  skeletonTitle: {
    backgroundColor: '#EEEEF0',
    borderRadius: 6,
    height: 17,
    width: '66%',
  },

  skeletonMeta: {
    backgroundColor: '#F2F2F4',
    borderRadius: 5,
    height: 11,
    marginTop: 11,
    width: '44%',
  },
});
