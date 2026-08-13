import { useRouter } from 'expo-router';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  type ImageSourcePropType,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import getAppBootstrap, {
  type AppBootstrap,
} from '../../services/bootstrap-service';
import {
  listStores,
  type StoreSummary,
} from '../../services/catalog-service';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../../theme/navienty-now-theme';

type BootstrapCategory =
  AppBootstrap['store_categories'][number] & {
    subtitle_ar?: string | null;
  };

type CuisineItem = {
  key: string;
  label: string;
  image: ImageSourcePropType;
  keywords: string[];
};

/**
 * يدعم أسماء الحقول المختلفة التي قد تأتي
 * من catalog-service أو قاعدة البيانات.
 */
type StoreRatingFields = {
  averageRating?: number | null;
  average_rating?: number | null;

  ratingCount?: number | null;
  ratingsCount?: number | null;
  reviewCount?: number | null;
  reviewsCount?: number | null;
  totalRatings?: number | null;
  totalReviews?: number | null;

  rating_count?: number | null;
  ratings_count?: number | null;
  review_count?: number | null;
  reviews_count?: number | null;
  total_ratings?: number | null;
  total_reviews?: number | null;

  hasRatings?: boolean | null;
  hasReviews?: boolean | null;
  has_ratings?: boolean | null;
  has_reviews?: boolean | null;
};

type StoreVisualFields = {
  logoUrl?: string | null;
  logo_url?: string | null;
  coverImageUrl?: string | null;
  cover_image_url?: string | null;
};

type StoreRatingInfo = {
  hasRatings: boolean;
  rating: number | null;
};

const RESTAURANTS_SLUG = 'restaurants';

const CUISINES: CuisineItem[] = [
  {
    key: 'arabic',
    label: 'أكل عربي',
    image: require('../../assets/cuisines/arabic.png'),
    keywords: [
      'عربي',
      'شامي',
      'سوري',
      'لبناني',
    ],
  },
  {
    key: 'arabic-sweets',
    label: 'حلويات شرقية',
    image: require('../../assets/cuisines/arabic-sweets.png'),
    keywords: [
      'حلويات شرقية',
      'بقلاوة',
      'كنافة',
    ],
  },
  {
    key: 'bakery',
    label: 'مخبوزات',
    image: require('../../assets/cuisines/bakery.png'),
    keywords: [
      'مخبوزات',
      'مخبز',
      'باتيه',
      'كرواسون',
    ],
  },
  {
    key: 'beverages',
    label: 'مشروبات',
    image: require('../../assets/cuisines/beverages.png'),
    keywords: [
      'مشروبات',
      'عصير',
      'كوكتيل',
    ],
  },
  {
    key: 'breakfast',
    label: 'فطار',
    image: require('../../assets/cuisines/breakfast.png'),
    keywords: [
      'فطار',
      'إفطار',
      'بيض',
    ],
  },
  {
    key: 'burgers',
    label: 'برجر',
    image: require('../../assets/cuisines/burgers.png'),
    keywords: [
      'برجر',
      'burger',
    ],
  },
  {
    key: 'cakes',
    label: 'كيك',
    image: require('../../assets/cuisines/cakes.png'),
    keywords: [
      'كيك',
      'تورتة',
      'cake',
    ],
  },
  {
    key: 'chicken',
    label: 'فراخ',
    image: require('../../assets/cuisines/chicken.png'),
    keywords: [
      'فراخ',
      'دجاج',
      'chicken',
    ],
  },
  {
    key: 'chocolate',
    label: 'شوكولاتة',
    image: require('../../assets/cuisines/chocolate.png'),
    keywords: [
      'شوكولاتة',
      'chocolate',
    ],
  },
  {
    key: 'coffee',
    label: 'قهوة وشاي',
    image: require('../../assets/cuisines/coffee.png'),
    keywords: [
      'قهوة',
      'شاي',
      'كافيه',
      'coffee',
    ],
  },
  {
    key: 'crepes',
    label: 'كريب',
    image: require('../../assets/cuisines/crepes.png'),
    keywords: [
      'كريب',
      'crepe',
    ],
  },
  {
    key: 'desserts',
    label: 'حلويات',
    image: require('../../assets/cuisines/desserts.png'),
    keywords: [
      'حلويات',
      'ديسرت',
      'dessert',
    ],
  },
  {
    key: 'egyptian',
    label: 'أكل مصري',
    image: require('../../assets/cuisines/egyptian.png'),
    keywords: [
      'مصري',
      'طواجن',
      'محشي',
    ],
  },
  {
    key: 'fast-food',
    label: 'وجبات سريعة',
    image: require('../../assets/cuisines/fast-food.png'),
    keywords: [
      'وجبات سريعة',
      'fast food',
    ],
  },
  {
    key: 'foul-falafel',
    label: 'فول وطعمية',
    image: require('../../assets/cuisines/foul-falafel.png'),
    keywords: [
      'فول',
      'طعمية',
      'فلافل',
    ],
  },
  {
    key: 'fried-chicken',
    label: 'فراخ مقلية',
    image: require('../../assets/cuisines/fried-chicken.png'),
    keywords: [
      'فراخ مقلية',
      'بروست',
      'fried chicken',
    ],
  },
  {
    key: 'grills',
    label: 'مشويات',
    image: require('../../assets/cuisines/grills.png'),
    keywords: [
      'مشويات',
      'كباب',
      'كفتة',
      'grill',
    ],
  },
  {
    key: 'healthy',
    label: 'أكل صحي',
    image: require('../../assets/cuisines/healthy.png'),
    keywords: [
      'صحي',
      'دايت',
      'سلطة',
      'healthy',
    ],
  },
  {
    key: 'koshary',
    label: 'كشري',
    image: require('../../assets/cuisines/koshary.png'),
    keywords: [
      'كشري',
      'koshary',
    ],
  },
  {
    key: 'pasta',
    label: 'مكرونة',
    image: require('../../assets/cuisines/pasta.png'),
    keywords: [
      'مكرونة',
      'باستا',
      'pasta',
    ],
  },
  {
    key: 'pies',
    label: 'فطير',
    image: require('../../assets/cuisines/pies.png'),
    keywords: [
      'فطير',
      'فطائر',
      'pie',
    ],
  },
  {
    key: 'pizza',
    label: 'بيتزا',
    image: require('../../assets/cuisines/pizza.png'),
    keywords: [
      'بيتزا',
      'pizza',
    ],
  },
  {
    key: 'sandwiches',
    label: 'ساندوتشات',
    image: require('../../assets/cuisines/sandwiches.png'),
    keywords: [
      'ساندوتش',
      'سندوتش',
      'sandwich',
    ],
  },
  {
    key: 'seafood',
    label: 'مأكولات بحرية',
    image: require('../../assets/cuisines/seafood.png'),
    keywords: [
      'سمك',
      'سي فود',
      'مأكولات بحرية',
      'seafood',
    ],
  },
  {
    key: 'shawarma',
    label: 'شاورما',
    image: require('../../assets/cuisines/shawarma.png'),
    keywords: [
      'شاورما',
      'shawarma',
    ],
  },
];

const PREVIEW_CUISINE_KEYS = [
  'grills',
  'desserts',
  'sandwiches',
  'crepes',
  'pizza',
];

function getStoreSearchText(
  store: StoreSummary,
): string {
  return [
    store.name,
    store.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('ar');
}

function getFirstValidNumber(
  values: Array<
    number | null | undefined
  >,
): number | null {
  for (const value of values) {
    if (
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return null;
}

function getStoreRatingInfo(
  store: StoreSummary,
): StoreRatingInfo {
  const ratingStore =
    store as StoreSummary &
      StoreRatingFields;

  const ratingCount =
    getFirstValidNumber([
      ratingStore.ratingCount,
      ratingStore.ratingsCount,
      ratingStore.reviewCount,
      ratingStore.reviewsCount,
      ratingStore.totalRatings,
      ratingStore.totalReviews,

      ratingStore.rating_count,
      ratingStore.ratings_count,
      ratingStore.review_count,
      ratingStore.reviews_count,
      ratingStore.total_ratings,
      ratingStore.total_reviews,
    ]);

  const rating =
    getFirstValidNumber([
      ratingStore.averageRating,
      ratingStore.average_rating,
      store.rating,
    ]);

  const hasExplicitRatingsFlag =
    ratingStore.hasRatings === true ||
    ratingStore.hasReviews === true ||
    ratingStore.has_ratings === true ||
    ratingStore.has_reviews === true;

  const hasRealRating =
    rating !== null &&
    rating > 0 &&
    rating <= 5 &&
    (
      hasExplicitRatingsFlag ||
      (
        ratingCount !== null &&
        ratingCount > 0
      )
    );

  if (!hasRealRating) {
    return {
      hasRatings: false,
      rating: null,
    };
  }

  return {
    hasRatings: true,
    rating,
  };
}

function getStoreLogoUrl(
  store: StoreSummary,
): string | null {
  const storeVisual =
    store as StoreSummary &
      StoreVisualFields;

  return (
    storeVisual.logoUrl ??
    storeVisual.logo_url ??
    null
  );
}

function getStoreCoverUrl(
  store: StoreSummary,
): string | null {
  const storeVisual =
    store as StoreSummary &
      StoreVisualFields;

  return (
    storeVisual.coverImageUrl ??
    storeVisual.cover_image_url ??
    null
  );
}

function getStoreInitial(
  store: StoreSummary,
): string {
  const source =
    (store.name || '').trim();

  if (!source) {
    return '•';
  }

  return source.charAt(0);
}

function StoreArtwork({
  store,
}: {
  store: StoreSummary;
}) {
  const [
    coverFailed,
    setCoverFailed,
  ] = useState(false);

  const [
    logoFailed,
    setLogoFailed,
  ] = useState(false);

  const coverUrl =
    getStoreCoverUrl(store);

  const logoUrl =
    getStoreLogoUrl(store);

  const canShowCover =
    Boolean(coverUrl) &&
    !coverFailed;

  const canShowLogo =
    Boolean(logoUrl) &&
    !logoFailed;

  return (
    <View style={styles.storeArtwork}>
      {canShowCover ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={`صورة الغلاف الخاصة بـ ${store.name}`}
          resizeMode="cover"
          source={{
            uri: coverUrl ?? '',
          }}
          style={
            styles.storeCoverImage
          }
          onError={() => {
            setCoverFailed(true);
          }}
        />
      ) : (
        <View
          style={
            styles.storeCoverFallback
          }
        >
          <Text
            style={
              styles.storeCoverFallbackText
            }
          >
            {getStoreInitial(store)}
          </Text>
        </View>
      )}

      <View
        style={
          styles.storeArtworkGradient
        }
      />


      <View style={styles.logoBadge}>
        {canShowLogo ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={`لوجو ${store.name}`}
            resizeMode="cover"
            source={{
              uri: logoUrl ?? '',
            }}
            style={styles.logoImage}
            onError={() => {
              setLogoFailed(true);
            }}
          />
        ) : (
          <View
            style={styles.logoFallback}
          >
            <Text
              style={
                styles.logoFallbackText
              }
            >
              {getStoreInitial(store)}
            </Text>
          </View>
        )}
      </View>

      {store.isManuallyClosed && (
        <View
          style={styles.closedOverlay}
        >
          <Text
            style={
              styles.closedOverlayText
            }
          >
            مغلق
          </Text>
        </View>
      )}
    </View>
  );
}

function BackArrowIcon() {
  return (
    <View style={styles.backArrowCanvas}>
      <View style={styles.backArrowStem} />

      <View
        style={[
          styles.backArrowDiagonal,
          styles.backArrowTop,
        ]}
      />

      <View
        style={[
          styles.backArrowDiagonal,
          styles.backArrowBottom,
        ]}
      />
    </View>
  );
}

export default function RestaurantsScreen() {
  const router = useRouter();

  const [, setCategory] =
    useState<BootstrapCategory | null>(
      null,
    );

  const [stores, setStores] =
    useState<StoreSummary[]>([]);

  const [
    selectedCuisineKeys,
    setSelectedCuisineKeys,
  ] = useState<string[]>([]);

  const [
    draftCuisineKeys,
    setDraftCuisineKeys,
  ] = useState<string[]>([]);

  const [
    isCuisinesModalVisible,
    setIsCuisinesModalVisible,
  ] = useState(false);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

  async function loadRestaurants() {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const [
        bootstrap,
        loadedStores,
      ] = await Promise.all([
        getAppBootstrap(),
        listStores({
          categorySlug:
            RESTAURANTS_SLUG,
        }),
      ]);

      const loadedCategory =
        (
          bootstrap.store_categories as
            BootstrapCategory[]
        ).find(
          (item) =>
            item.slug ===
            RESTAURANTS_SLUG,
        ) ?? null;

      setCategory(loadedCategory);
      setStores(loadedStores);
    } catch (error) {
      setCategory(null);
      setStores([]);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل المطاعم.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRestaurants();
  }, []);

  const previewCuisines =
    useMemo(
      () =>
        PREVIEW_CUISINE_KEYS.map(
          (key) =>
            CUISINES.find(
              (cuisine) =>
                cuisine.key === key,
            ),
        ).filter(
          (
            cuisine,
          ): cuisine is CuisineItem =>
            Boolean(cuisine),
        ),
      [],
    );

  const visibleStores =
    useMemo(() => {
      const selectedCuisines =
        CUISINES.filter(
          (cuisine) =>
            selectedCuisineKeys.includes(
              cuisine.key,
            ),
        );

      const filtered =
        stores.filter(
          (store) => {
            if (
              selectedCuisines.length >
              0
            ) {
              const storeSearchText =
                getStoreSearchText(
                  store,
                );

              const matchesCuisine =
                selectedCuisines.some(
                  (cuisine) =>
                    cuisine.keywords.some(
                      (keyword) =>
                        storeSearchText.includes(
                          keyword.toLocaleLowerCase(
                            'ar',
                          ),
                        ),
                    ),
                );

              if (!matchesCuisine) {
                return false;
              }
            }

            return true;
          },
        );

      return [...filtered].sort(
        (first, second) => {
          if (
            first.isManuallyClosed !==
            second.isManuallyClosed
          ) {
            return first.isManuallyClosed
              ? 1
              : -1;
          }

          if (
            first.isFeatured !==
            second.isFeatured
          ) {
            return first.isFeatured
              ? -1
              : 1;
          }

          return first.name.localeCompare(
            second.name,
            'ar',
          );
        },
      );
    }, [
      selectedCuisineKeys,
      stores,
    ]);

  function toggleSelectedCuisine(
    cuisineKey: string,
  ) {
    setSelectedCuisineKeys(
      (currentCuisineKeys) => {
        const isAlreadySelected =
          currentCuisineKeys.includes(
            cuisineKey,
          );

        if (isAlreadySelected) {
          return [];
        }

        return [cuisineKey];
      },
    );
  }

  function openCuisinesModal() {
    setDraftCuisineKeys(
      selectedCuisineKeys,
    );

    setIsCuisinesModalVisible(
      true,
    );
  }

  function closeCuisinesModal() {
    setIsCuisinesModalVisible(
      false,
    );
  }

  function toggleDraftCuisine(
    cuisineKey: string,
  ) {
    setDraftCuisineKeys(
      (currentCuisineKeys) => {
        const isAlreadySelected =
          currentCuisineKeys.includes(
            cuisineKey,
          );

        if (isAlreadySelected) {
          return [];
        }

        return [cuisineKey];
      },
    );
  }

  function applyCuisineFilters() {
    setSelectedCuisineKeys(
      draftCuisineKeys,
    );

    setIsCuisinesModalVisible(
      false,
    );
  }

  function resetCuisineFilters() {
    setDraftCuisineKeys([]);
  }

  function resetAllFilters() {
    setSelectedCuisineKeys([]);
  }

  const hasActiveFilters =
    selectedCuisineKeys.length >
    0;

  if (isLoading) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator
          size="large"
          color={
            NAVIENTY_NOW_COLORS.primary
          }
        />

        <Text style={styles.stateTitle}>
          جاري تحميل المطاعم
        </Text>

        <Text
          style={
            styles.stateDescription
          }
        >
          يتم تجهيز المطاعم المتاحة
          للطلب.
        </Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.stateScreen}>
        <Text style={styles.stateIcon}>
          🍽️
        </Text>

        <Text style={styles.stateTitle}>
          تعذر فتح المطاعم
        </Text>

        <Text
          style={
            styles.stateDescription
          }
        >
          {errorMessage}
        </Text>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.retryButton,
            pressed &&
              styles.pressed,
          ]}
          onPress={() => {
            void loadRestaurants();
          }}
        >
          <Text
            style={
              styles.retryButtonText
            }
          >
            إعادة المحاولة
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topHeader}>
        <Pressable
          accessibilityLabel="العودة"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.backButton,
            pressed &&
              styles.headerButtonPressed,
          ]}
          onPress={() =>
            router.back()
          }
        >
          <BackArrowIcon />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.pageContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View style={styles.container}>
          <ScrollView
            horizontal
            contentContainerStyle={
              styles.cuisinesPreviewContent
            }
            showsHorizontalScrollIndicator={
              false
            }
            style={
              styles.cuisinesPreview
            }
          >
            {previewCuisines.map(
              (cuisine) => (
                <CuisinePreviewItem
                  key={cuisine.key}
                  active={selectedCuisineKeys.includes(
                    cuisine.key,
                  )}
                  cuisine={cuisine}
                  onPress={() =>
                    toggleSelectedCuisine(
                      cuisine.key,
                    )
                  }
                />
              ),
            )}

            <CuisinePreviewItem
              active={
                selectedCuisineKeys.length >
                0
              }
              cuisine={{
                key: 'view-all',
                label: 'عرض الكل',
                image: require('../../assets/cuisines/view-all.png'),
                keywords: [],
              }}
              onPress={
                openCuisinesModal
              }
            />
          </ScrollView>

          {hasActiveFilters && (
            <View
              style={
                styles.clearFiltersRow
              }
            >
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.clearFiltersButton,
                  pressed &&
                    styles.pressed,
                ]}
                onPress={
                  resetAllFilters
                }
              >
                <Text
                  style={
                    styles.clearFiltersText
                  }
                >
                  مسح الفلاتر
                </Text>
              </Pressable>
            </View>
          )}

          {visibleStores.length ===
          0 ? (
            <View
              style={styles.emptyCard}
            >
              <Text
                style={
                  styles.emptyIcon
                }
              >
                🔎
              </Text>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                لا توجد نتائج
              </Text>

              <Text
                style={
                  styles.emptyDescription
                }
              >
                جرّب اختيار مطبخ مختلف أو
                إزالة بعض الفلاتر.
              </Text>

              {hasActiveFilters && (
                <Pressable
                  accessibilityRole="button"
                  style={({
                    pressed,
                  }) => [
                    styles.emptyResetButton,
                    pressed &&
                      styles.pressed,
                  ]}
                  onPress={
                    resetAllFilters
                  }
                >
                  <Text
                    style={
                      styles.emptyResetButtonText
                    }
                  >
                    عرض كل المطاعم
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View
              style={
                styles.storesList
              }
            >
              {visibleStores.map(
                (store) => {
                  const ratingInfo =
                    getStoreRatingInfo(
                      store,
                    );

                  return (
                    <Pressable
                      key={store.id}
                      accessibilityLabel={`فتح ${store.name}`}
                      accessibilityRole="button"
                      style={({
                        pressed,
                      }) => [
                        styles.storeRow,
                        pressed &&
                          styles.storeRowPressed,
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
                      <StoreArtwork
                        store={store}
                      />

                      <View
                        style={
                          styles.storeBody
                        }
                      >
                        <View
                          style={
                            styles.storeNameRow
                          }
                        >
                          {store.isFeatured && (
                            <View
                              style={
                                styles.proBadge
                              }
                            >
                              <Text
                                style={
                                  styles.proBadgeText
                                }
                              >
                                pro
                              </Text>
                            </View>
                          )}

                          <Text
                            numberOfLines={
                              1
                            }
                            style={
                              styles.storeName
                            }
                          >
                            {store.name}
                          </Text>
                        </View>

                        <View
                          style={
                            styles.storeMetaRow
                          }
                        >
                          {ratingInfo.hasRatings &&
                          ratingInfo.rating !==
                            null ? (
                            <>
                              <Text
                                style={
                                  styles.ratingStar
                                }
                              >
                                ★
                              </Text>

                              <Text
                                style={
                                  styles.ratingText
                                }
                              >
                                {ratingInfo.rating.toFixed(
                                  1,
                                )}
                              </Text>
                            </>
                          ) : (
                            <Text
                              style={
                                styles.newStoreText
                              }
                            >
                              New
                            </Text>
                          )}
                        </View>

                        {store.isManuallyClosed && (
                          <Text
                            numberOfLines={
                              1
                            }
                            style={
                              styles.closedMessage
                            }
                          >
                            {store.manualClosedNote ||
                              'المطعم مغلق مؤقتًا'}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                },
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <CuisinesModal
        draftCuisineKeys={
          draftCuisineKeys
        }
        visible={
          isCuisinesModalVisible
        }
        onApply={
          applyCuisineFilters
        }
        onClose={
          closeCuisinesModal
        }
        onReset={
          resetCuisineFilters
        }
        onToggleCuisine={
          toggleDraftCuisine
        }
      />
    </View>
  );
}

function CuisinePreviewItem({
  active,
  cuisine,
  onPress,
}: {
  active: boolean;
  cuisine: CuisineItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.cuisinePreviewItem,
        pressed &&
          styles.pressed,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.cuisinePreviewImage,
          active &&
            styles.cuisinePreviewImageActive,
        ]}
      >
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={`صورة ${cuisine.label}`}
          resizeMode="cover"
          source={cuisine.image}
          style={
            styles.cuisinePreviewPhoto
          }
        />
      </View>

      <Text
        numberOfLines={1}
        style={[
          styles.cuisinePreviewLabel,
          active &&
            styles.cuisinePreviewLabelActive,
        ]}
      >
        {cuisine.label}
      </Text>
    </Pressable>
  );
}

function CuisinesModal({
  draftCuisineKeys,
  onApply,
  onClose,
  onReset,
  onToggleCuisine,
  visible,
}: {
  draftCuisineKeys: string[];
  onApply: () => void;
  onClose: () => void;
  onReset: () => void;
  onToggleCuisine: (
    cuisineKey: string,
  ) => void;
  visible: boolean;
}) {
  const { height: windowHeight } =
    useWindowDimensions();

  const sheetTranslateY =
    useRef(
      new Animated.Value(
        windowHeight,
      ),
    ).current;

  const isClosingRef =
    useRef(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    isClosingRef.current = false;

    sheetTranslateY.stopAnimation();

    sheetTranslateY.setValue(
      windowHeight,
    );

    Animated.spring(
      sheetTranslateY,
      {
        toValue: 0,
        useNativeDriver: true,
        damping: 24,
        stiffness: 240,
        mass: 0.85,
      },
    ).start();
  }, [
    sheetTranslateY,
    visible,
    windowHeight,
  ]);

  function animateSheetBack() {
    Animated.spring(
      sheetTranslateY,
      {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 260,
        mass: 0.8,
      },
    ).start();
  }

  function requestClose() {
    if (isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;

    sheetTranslateY.stopAnimation();

    Animated.timing(
      sheetTranslateY,
      {
        toValue: windowHeight,
        duration: 220,
        useNativeDriver: true,
      },
    ).start(() => {
      isClosingRef.current = false;
      onClose();
    });
  }

  function requestApply() {
    if (isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;

    sheetTranslateY.stopAnimation();

    Animated.timing(
      sheetTranslateY,
      {
        toValue: windowHeight,
        duration: 220,
        useNativeDriver: true,
      },
    ).start(() => {
      isClosingRef.current = false;
      onApply();
    });
  }

  const panResponder =
    useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder:
            () => false,

          onMoveShouldSetPanResponder:
            (
              _event,
              gestureState,
            ) => {
              const isMovingDown =
                gestureState.dy > 4;

              const isMostlyVertical =
                Math.abs(
                  gestureState.dy,
                ) >
                Math.abs(
                  gestureState.dx,
                );

              return (
                isMovingDown &&
                isMostlyVertical
              );
            },

          onPanResponderGrant: () => {
            sheetTranslateY.stopAnimation();
          },

          onPanResponderMove: (
            _event,
            gestureState,
          ) => {
            const nextTranslateY =
              Math.max(
                0,
                gestureState.dy,
              );

            sheetTranslateY.setValue(
              nextTranslateY,
            );
          },

          onPanResponderRelease: (
            _event,
            gestureState,
          ) => {
            const draggedFarEnough =
              gestureState.dy > 120;

            const flickedDownFast =
              gestureState.dy > 30 &&
              gestureState.vy > 1.1;

            if (
              draggedFarEnough ||
              flickedDownFast
            ) {
              requestClose();
              return;
            }

            animateSheetBack();
          },

          onPanResponderTerminate:
            () => {
              animateSheetBack();
            },
        }),
      [
        sheetTranslateY,
        windowHeight,
      ],
    );

  return (
    <Modal
      animationType="none"
      statusBarTranslucent
      transparent
      visible={visible}
      onRequestClose={
        requestClose
      }
    >
      <View
        style={
          styles.modalBackdrop
        }
      >
        <Pressable
          accessibilityLabel="إغلاق قائمة المطابخ"
          style={
            styles.modalBackdropPressable
          }
          onPress={
            requestClose
          }
        />

        <Animated.View
          style={[
            styles.cuisinesSheet,
            {
              transform: [
                {
                  translateY:
                    sheetTranslateY,
                },
              ],
            },
          ]}
        >
          <View
            style={
              styles.sheetDragArea
            }
            {...panResponder.panHandlers}
          >
            <View
              style={
                styles.sheetHandleTouchArea
              }
            >
              <View
                style={
                  styles.sheetHandle
                }
              />
            </View>

            <View
              style={
                styles.sheetHeader
              }
            >
              <Pressable
                accessibilityLabel="إغلاق"
                accessibilityRole="button"
                hitSlop={8}
                style={({
                  pressed,
                }) => [
                  styles.sheetCircleButton,
                  pressed &&
                    styles.pressed,
                ]}
                onPress={
                  requestClose
                }
              >
                <Text
                  style={
                    styles.sheetCloseIcon
                  }
                >
                  ×
                </Text>
              </Pressable>

              <Text
                style={
                  styles.sheetTitle
                }
              >
                المطابخ
              </Text>

              <Pressable
                accessibilityRole="button"
                style={({
                  pressed,
                }) => [
                  styles.resetCuisineButton,
                  pressed &&
                    styles.pressed,
                ]}
                onPress={onReset}
              >
                <Text
                  style={
                    styles.resetCuisineButtonText
                  }
                >
                  إعادة
                </Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={
              styles.cuisinesGrid
            }
            showsVerticalScrollIndicator={
              false
            }
            bounces
            overScrollMode="never"
          >
            {CUISINES.map(
              (cuisine) => {
                const active =
                  draftCuisineKeys.includes(
                    cuisine.key,
                  );

                return (
                  <Pressable
                    key={
                      cuisine.key
                    }
                    accessibilityRole="button"
                    style={({
                      pressed,
                    }) => [
                      styles.cuisineGridItem,
                      pressed &&
                        styles.pressed,
                    ]}
                    onPress={() =>
                      onToggleCuisine(
                        cuisine.key,
                      )
                    }
                  >
                    <View
                      style={[
                        styles.cuisineGridImage,
                        active &&
                          styles.cuisineGridImageActive,
                      ]}
                    >
                      <Image
                        accessibilityIgnoresInvertColors
                        accessibilityLabel={`صورة ${cuisine.label}`}
                        resizeMode="cover"
                        source={
                          cuisine.image
                        }
                        style={
                          styles.cuisineGridPhoto
                        }
                      />

                      {active && (
                        <View
                          style={
                            styles.cuisineSelectedBadge
                          }
                        >
                          <Text
                            style={
                              styles.cuisineSelectedBadgeText
                            }
                          >
                            ✓
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text
                      numberOfLines={
                        1
                      }
                      style={[
                        styles.cuisineGridLabel,
                        active &&
                          styles.cuisineGridLabelActive,
                      ]}
                    >
                      {cuisine.label}
                    </Text>
                  </Pressable>
                );
              },
            )}
          </ScrollView>

          <View
            style={
              styles.sheetFooter
            }
          >
            <Pressable
              accessibilityRole="button"
              style={({
                pressed,
              }) => [
                styles.viewResultsButton,
                pressed &&
                  styles.pressed,
              ]}
              onPress={
                requestApply
              }
            >
              <Text
                style={
                  styles.viewResultsButtonText
                }
              >
                عرض النتائج
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },

  topHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#ECECEF',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 100,
    paddingBottom: 14,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    paddingTop: 34,
    shadowColor: '#000000',
    shadowOffset: {
      height: 2,
      width: 0,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    zIndex: 10,
  },

  backButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E1E1',
    borderRadius: 24,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },

  headerButtonPressed: {
    backgroundColor: '#F7F7F7',
    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  backArrowCanvas: {
    height: 23,
    position: 'relative',
    width: 24,
  },

  backArrowStem: {
    backgroundColor: '#242424',
    borderRadius: 2,
    height: 2.2,
    left: 3,
    position: 'absolute',
    top: 10.3,
    width: 19,
  },

  backArrowDiagonal: {
    backgroundColor: '#242424',
    borderRadius: 2,
    height: 2.2,
    left: 2,
    position: 'absolute',
    width: 10,
  },

  backArrowTop: {
    top: 7,
    transform: [
      {
        rotate: '-42deg',
      },
    ],
  },

  backArrowBottom: {
    top: 14,
    transform: [
      {
        rotate: '42deg',
      },
    ],
  },

  pageContent: {
    flexGrow: 1,
    paddingBottom: 42,
  },

  container: {
    alignSelf: 'center',
    maxWidth:
      NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    width: '100%',
  },

  cuisinesPreview: {
    backgroundColor: '#FFFFFF',
  },

  cuisinesPreviewContent: {
    gap: 16,
    paddingBottom: 13,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    paddingTop: 18,
  },

  cuisinePreviewItem: {
    alignItems: 'center',
    width: 84,
  },

  cuisinePreviewImage: {
    alignItems: 'center',
    backgroundColor: '#F6F4F1',
    borderColor: '#F1F1F2',
    borderRadius: 39,
    borderWidth: 1,
    height: 78,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#111111',
    shadowOffset: {
      height: 2,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    width: 78,
  },

  cuisinePreviewImageActive: {
    backgroundColor: '#EAF8F0',
    borderColor:
      NAVIENTY_NOW_COLORS.primary,
    borderWidth: 2,
  },

  cuisinePreviewPhoto: {
    borderRadius: 39,
    height: '100%',
    width: '100%',
  },

  cuisinePreviewLabel: {
    color: '#6B6B70',
    fontSize: 12,
    marginTop: 8,
    maxWidth: 84,
    textAlign: 'center',
  },

  cuisinePreviewLabelActive: {
    color:
      NAVIENTY_NOW_COLORS.primary,
    fontWeight: '900',
  },

  clearFiltersRow: {
    alignItems: 'flex-start',
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    paddingTop: 18,
  },

  clearFiltersButton: {
    justifyContent: 'center',
    minHeight: 36,
  },

  clearFiltersText: {
    color:
      NAVIENTY_NOW_COLORS.primary,
    fontSize: 12,
    fontWeight: '900',
  },

  storesList: {
    paddingBottom: 8,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    paddingTop: 12,
  },

  storeRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    direction: 'ltr',
    flexDirection: 'row',
    gap: 12,
    minHeight: 132,
    paddingVertical: 8,
    width: '100%',
  },

  storeRowPressed: {
    opacity: 0.76,
  },

  storeArtwork: {
    backgroundColor: '#EFEFEF',
    borderRadius: 22,
    flexShrink: 0,
    height: 118,
    overflow: 'hidden',
    position: 'relative',
    width: 138,
  },

  storeCoverImage: {
    height: '100%',
    width: '100%',
  },

  storeCoverFallback: {
    alignItems: 'center',
    backgroundColor: '#ECECEC',
    flex: 1,
    justifyContent: 'center',
  },

  storeCoverFallbackText: {
    color: '#8B8B92',
    fontSize: 34,
    fontWeight: '900',
  },

  storeArtworkGradient: {
    backgroundColor:
      'rgba(0,0,0,0.08)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  logoBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor:
      'rgba(0,0,0,0.06)',
    borderRadius: 18,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    left: 8,
    overflow: 'hidden',
    position: 'absolute',
    top: 8,
    width: 52,
    zIndex: 4,
  },

  logoImage: {
    height: '100%',
    width: '100%',
  },

  logoFallback: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },

  logoFallbackText: {
    color: '#66666C',
    fontSize: 22,
    fontWeight: '900',
  },


  closedOverlay: {
    alignItems: 'center',
    backgroundColor:
      'rgba(23,23,26,0.58)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 6,
  },

  closedOverlayText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  storeBody: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 108,
    overflow: 'hidden',
    paddingRight: 2,
  },

  storeNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    width: '100%',
  },

  storeName: {
    color: '#202024',
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.25,
    lineHeight: 23,
    textAlign: 'left',
    writingDirection: 'auto',
  },

  proBadge: {
    alignItems: 'center',
    backgroundColor: '#8A23CF',
    borderRadius: 2,
    flexShrink: 0,
    height: 17,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  proBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },

  storeMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 7,
    minHeight: 22,
    width: '100%',
  },

  ratingStar: {
    color: '#F4AF00',
    flexShrink: 0,
    fontSize: 18,
    lineHeight: 20,
    marginRight: 5,
  },

  ratingText: {
    color: '#45454B',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'left',
  },

  newStoreText: {
    color: '#77777D',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'left',
  },

  closedMessage: {
    color: '#C23D3D',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 5,
    textAlign: 'left',
  },

  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FAFAFB',
    borderColor: '#ECECEF',
    borderRadius: 22,
    borderWidth: 1,
    marginHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    marginTop: 20,
    padding: 28,
  },

  emptyIcon: {
    fontSize: 42,
  },

  emptyTitle: {
    color: '#202024',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 12,
  },

  emptyDescription: {
    color: '#7A7A81',
    fontSize: 12,
    lineHeight: 20,
    marginTop: 7,
    textAlign: 'center',
  },

  emptyResetButton: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 999,
    marginTop: 18,
    paddingHorizontal: 19,
    paddingVertical: 11,
  },

  emptyResetButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  modalBackdrop: {
    backgroundColor:
      'rgba(18,18,20,0.34)',
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalBackdropPressable: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  cuisinesSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '90%',
    overflow: 'hidden',
    paddingTop: 0,
  },

  /*
   * الجزء ده كله قابل للسحب لأسفل:
   * الـ handle + العنوان + أزرار الهيدر.
   */
  sheetDragArea: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },

  /*
   * زودنا مساحة اللمس حول الـ handle
   * علشان السحب يبقى أسهل.
   */
  sheetHandleTouchArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
    paddingTop: 7,
  },

  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#E4E4E7',
    borderRadius: 999,
    height: 5,
    width: 74,
  },

  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent:
      'space-between',
    paddingBottom: 8,
    paddingHorizontal: 24,
    paddingTop: 3,
  },

  sheetCircleButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E3E6',
    borderRadius: 27,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },

  sheetCloseIcon: {
    color: '#151518',
    fontSize: 34,
    fontWeight: '300',
    lineHeight: 35,
  },

  sheetTitle: {
    color: '#18181B',
    fontSize: 22,
    fontWeight: '900',
  },

  resetCuisineButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E3E6',
    borderRadius: 27,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  resetCuisineButtonText: {
    color: '#1C1C1F',
    fontSize: 13,
    fontWeight: '800',
  },

  cuisinesGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    paddingBottom: 130,
    paddingHorizontal: 14,
    paddingTop: 15,
  },

  cuisineGridItem: {
    alignItems: 'center',
    marginBottom: 22,
    width: '25%',
  },

  cuisineGridImage: {
    alignItems: 'center',
    backgroundColor: '#F4F2EF',
    borderColor: '#EEEEF0',
    borderRadius: 41,
    borderWidth: 1,
    height: 82,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#111111',
    shadowOffset: {
      height: 2,
      width: 0,
    },
    shadowOpacity: 0.09,
    shadowRadius: 5,
    width: 82,
  },

  cuisineGridImageActive: {
    backgroundColor: '#EAF8F0',
    borderColor:
      NAVIENTY_NOW_COLORS.primary,
    borderWidth: 2,
  },

  cuisineGridPhoto: {
    borderRadius: 41,
    height: '100%',
    width: '100%',
  },

  cuisineSelectedBadge: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderColor: '#FFFFFF',
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    top: -2,
    width: 22,
  },

  cuisineSelectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  cuisineGridLabel: {
    color: '#6B6B70',
    fontSize: 11,
    marginTop: 8,
    maxWidth: 88,
    textAlign: 'center',
  },

  cuisineGridLabelActive: {
    color:
      NAVIENTY_NOW_COLORS.primary,
    fontWeight: '900',
  },

  sheetFooter: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#EEEEF0',
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingBottom: 30,
    paddingHorizontal: 25,
    paddingTop: 20,
    position: 'absolute',
    right: 0,
  },

  viewResultsButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 62,
  },

  viewResultsButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  stateScreen: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  stateIcon: {
    fontSize: 52,
  },

  stateTitle: {
    color: '#17171A',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 17,
    textAlign: 'center',
  },

  stateDescription: {
    color: '#73737A',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },

  retryButton: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
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

  pressed: {
    opacity: 0.76,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },
});