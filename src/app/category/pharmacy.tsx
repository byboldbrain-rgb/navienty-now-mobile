import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CatalogHomeScreenSkeleton } from '../../components/ui/loading-skeleton';
import getAppBootstrap from '../../services/bootstrap-service';
import {
  type CatalogProduct,
  type CatalogSection,
  getCatalogSectionProducts,
  getStoreCatalog,
  listStores,
  type StoreBusinessHour,
  type StoreCatalog,
} from '../../services/catalog-service';
import {
  listPharmacyPromotionBanners,
  type PharmacyPromotionBanner,
} from '../../services/pharmacy-banner-service';
import { useCartStore } from '../../store/cart-store';
import { useCustomerStore } from '../../store/customer-store';
import { NAVIENTY_NOW_COLORS } from '../../theme/navienty-now-theme';

const CATEGORY_ROWS = 3;

const CATEGORY_INDICATOR_TRACK_WIDTH = 84;
const CATEGORY_INDICATOR_THUMB_WIDTH = 30;

/**
 * Local pharmacy category artwork.
 *
 * Images must exist inside:
 *
 * assets/images/pharmacy-categories/
 *
 * Hair care is displayed with a local asset.
 * Daily needs and personal care remain hidden
 * from the Pharmacy home screen.
 */
const PHARMACY_CATEGORY_IMAGES: Partial<
  Record<string, ImageSourcePropType>
> = {
  'medicines-treatments': require(
    '../../../assets/images/pharmacy-categories/medicines-treatments.webp',
  ),

  'cold-flu-allergy': require(
    '../../../assets/images/pharmacy-categories/cold-flu-allergy.webp',
  ),

  'headache-pain-fever': require(
    '../../../assets/images/pharmacy-categories/headache-pain-fever.webp',
  ),

  'stomach-digestive': require(
    '../../../assets/images/pharmacy-categories/stomach-digestive.webp',
  ),

  'first-aid-wounds': require(
    '../../../assets/images/pharmacy-categories/first-aid-wounds.webp',
  ),

  skincare: require(
    '../../../assets/images/pharmacy-categories/skincare.webp',
  ),

  'hair-scalp-care': require(
    '../../../assets/images/pharmacy-categories/hair-scalp-care.webp',
  ),

  'oral-dental-care': require(
    '../../../assets/images/pharmacy-categories/oral-dental-care.webp',
  ),

  'vitamins-supplements': require(
    '../../../assets/images/pharmacy-categories/vitamins-supplements.webp',
  ),

  'women-care': require(
    '../../../assets/images/pharmacy-categories/women-care.webp',
  ),

  'men-care': require(
    '../../../assets/images/pharmacy-categories/men-care.webp',
  ),

  'eyes-lenses': require(
    '../../../assets/images/pharmacy-categories/eyes-lenses.webp',
  ),

  cosmetics: require(
    '../../../assets/images/pharmacy-categories/cosmetics.webp',
  ),

  'sun-insect-protection': require(
    '../../../assets/images/pharmacy-categories/sun-insect-protection.webp',
  ),

  'sanitization-disinfection': require(
    '../../../assets/images/pharmacy-categories/sanitization-disinfection.webp',
  ),
};

/**
 * Categories that should not appear
 * in the Pharmacy home screen.
 *
 * We match by slug and by displayed Arabic / English names
 * so these categories stay hidden even if Supabase uses
 * a slightly different slug.
 */
const HIDDEN_PHARMACY_CATEGORY_SLUGS =
  new Set<string>([
    'hair-care',
    'daily-needs',
    'daily-essentials',
    'personal-care-hygiene',
    'personal-care',
  ]);

/**
 * Hide only the old standalone Hair Care category.
 *
 * Exact matching is intentional here:
 * "العناية بالشعر" should be hidden,
 * while "العناية بالشعر وفروة الرأس"
 * must remain visible.
 */
const HIDDEN_PHARMACY_CATEGORY_EXACT_ARABIC_NAMES =
  new Set<string>([
    'العناية بالشعر',
  ]);

const HIDDEN_PHARMACY_CATEGORY_EXACT_ENGLISH_NAMES =
  new Set<string>([
    'hair care',
  ]);

const HIDDEN_PHARMACY_CATEGORY_ARABIC_KEYWORDS = [
  'الاحتياجات اليومية',
  'العناية الشخصية',
];

const HIDDEN_PHARMACY_CATEGORY_ENGLISH_KEYWORDS = [
  'daily needs',
  'daily essentials',
  'personal care',
];

function shouldHidePharmacyCategory(
  section: CatalogSection,
) {
  const normalizedSlug =
    section.slug.trim().toLowerCase();

  const normalizedArabicName =
    section.name.trim();

  const normalizedEnglishName =
    (section.nameEn ?? '')
      .trim()
      .toLowerCase();

  if (
    HIDDEN_PHARMACY_CATEGORY_SLUGS.has(
      normalizedSlug,
    )
  ) {
    return true;
  }

  if (
    HIDDEN_PHARMACY_CATEGORY_EXACT_ARABIC_NAMES.has(
      normalizedArabicName,
    ) ||
    HIDDEN_PHARMACY_CATEGORY_EXACT_ENGLISH_NAMES.has(
      normalizedEnglishName,
    )
  ) {
    return true;
  }

  if (
    HIDDEN_PHARMACY_CATEGORY_ARABIC_KEYWORDS.some(
      (keyword) =>
        normalizedArabicName.includes(keyword),
    )
  ) {
    return true;
  }

  return HIDDEN_PHARMACY_CATEGORY_ENGLISH_KEYWORDS.some(
    (keyword) =>
      normalizedEnglishName.includes(keyword),
  );
}

type CategoryDisplayItem = {
  key: string;
  label: string;
  imageSource:
    | ImageSourcePropType
    | null;
  section: CatalogSection;
};

type ResolvedPromotionBanner =
  PharmacyPromotionBanner & {
    products: CatalogProduct[];
  };

type FeaturedProductCardProps = {
  product: CatalogProduct;
  currencyCode: string;
  cardWidth: number;
  quantity: number;
  isStoreClosed: boolean;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
};

function getProductImage(
  product: CatalogProduct,
): string | null {
  if (product.imageUrl) {
    return product.imageUrl;
  }

  const coverImage =
    product.images.find(
      (image) =>
        image.isCover,
    );

  if (coverImage) {
    return coverImage.imageUrl;
  }

  return (
    product.images[0]
      ?.imageUrl ?? null
  );
}

function getDiscountPercent(
  product: CatalogProduct,
): number | null {
  const compareAtPrice =
    product.compareAtPrice;

  if (
    compareAtPrice === null ||
    compareAtPrice <=
      product.price ||
    compareAtPrice <= 0
  ) {
    return null;
  }

  return Math.round(
    ((compareAtPrice -
      product.price) /
      compareAtPrice) *
      100,
  );
}

function formatMoney(
  amount: number,
  currencyCode: string,
) {
  return `${getArabicCurrencyLabel(
    currencyCode,
  )} ${amount.toFixed(
    2,
  )}`;
}

function getArabicCurrencyLabel(
  currencyCode: string,
) {
  if (
    currencyCode
      .trim()
      .toUpperCase() ===
    'EGP'
  ) {
    return 'ج.م';
  }

  return currencyCode;
}

function formatCartMoney(
  amount: number,
  currencyCode: string,
) {
  return `${getArabicCurrencyLabel(
    currencyCode,
  )} ${amount.toFixed(2)}`;
}

function makeCategoryColumns(
  categories: CategoryDisplayItem[],
) {
  const columns:
    CategoryDisplayItem[][] = [];

  for (
    let index = 0;
    index < categories.length;
    index += CATEGORY_ROWS
  ) {
    columns.push(
      categories.slice(
        index,
        index + CATEGORY_ROWS,
      ),
    );
  }

  return columns;
}

function getPharmacyCategoryFallbackIcon(
  section: CatalogSection,
) {
  const searchableValue = [
    section.slug,
    section.name,
    section.nameEn ?? '',
  ]
    .join(' ')
    .toLowerCase();

  const rules: Array<
    [string[], string]
  > = [
    [
      [
        'baby',
        'babies',
        'infant',
        'child',
        'mother',
        'طفل',
        'اطفال',
        'أطفال',
        'ام',
        'أم',
      ],
      '🍼',
    ],

    [
      [
        'first-aid',
        'first aid',
        'wound',
        'wounds',
        'bandage',
        'اسعاف',
        'إسعاف',
        'جروح',
      ],
      '🩹',
    ],

    [
      [
        'oral',
        'dental',
        'teeth',
        'tooth',
        'mouth',
        'اسنان',
        'أسنان',
        'فم',
      ],
      '🪥',
    ],

    [
      [
        'skin',
        'skincare',
        'derma',
        'بشرة',
        'جلد',
      ],
      '🧴',
    ],

    [
      [
        'hair',
        'haircare',
        'scalp',
        'شعر',
        'فروة',
      ],
      '🧴',
    ],

    [
      [
        'eye',
        'eyes',
        'optic',
        'lens',
        'lenses',
        'عين',
        'عيون',
        'عدسات',
      ],
      '👁️',
    ],

    [
      [
        'cold',
        'flu',
        'cough',
        'allergy',
        'برد',
        'انفلونزا',
        'كحة',
        'حساسية',
      ],
      '🤧',
    ],

    [
      [
        'headache',
        'pain',
        'fever',
        'صداع',
        'الم',
        'ألم',
        'حرارة',
      ],
      '🌡️',
    ],

    [
      [
        'stomach',
        'digestive',
        'digestion',
        'معدة',
        'هضم',
        'قولون',
      ],
      '💊',
    ],

    [
      [
        'women',
        'woman',
        'female',
        'نسائي',
        'نساء',
        'مرأة',
      ],
      '🌸',
    ],

    [
      [
        'men',
        'man',
        'male',
        'رجال',
        'رجل',
      ],
      '🧔',
    ],

    [
      [
        'vitamin',
        'vitamins',
        'supplement',
        'supplements',
        'فيتامين',
        'مكمل',
      ],
      '💊',
    ],

    [
      [
        'cosmetic',
        'cosmetics',
        'makeup',
        'تجميل',
        'مكياج',
      ],
      '💄',
    ],

    [
      [
        'sun',
        'sunscreen',
        'insect',
        'mosquito',
        'شمس',
        'حشرات',
        'ناموس',
      ],
      '☀️',
    ],

    [
      [
        'sanitization',
        'disinfection',
        'sanitizer',
        'hygiene',
        'تعقيم',
        'تطهير',
      ],
      '🧴',
    ],
  ];

  for (
    const [
      keywords,
      icon,
    ] of rules
  ) {
    if (
      keywords.some(
        (keyword) =>
          searchableValue.includes(
            keyword,
          ),
      )
    ) {
      return icon;
    }
  }

  return '💊';
}

function BackArrowIcon() {
  return (
    <View
      style={styles.backArrowCanvas}
    >
      <View
        style={styles.backArrowStem}
      />

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


const ARABIC_WEEK_DAYS = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

function parseBusinessTime(
  value: string | null,
): {
  hours: number;
  minutes: number;
} | null {
  if (!value) {
    return null;
  }

  const parts =
    value.split(':');

  const hours =
    Number(parts[0]);

  const minutes =
    Number(parts[1] ?? 0);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return {
    hours,
    minutes,
  };
}

function getBusinessMinutes(
  value: string | null,
): number | null {
  const parsed =
    parseBusinessTime(value);

  if (!parsed) {
    return null;
  }

  return (
    parsed.hours * 60 +
    parsed.minutes
  );
}

function formatBusinessTime(
  value: string | null,
): string | null {
  const parsed =
    parseBusinessTime(value);

  if (!parsed) {
    return null;
  }

  const period =
    parsed.hours >= 12
      ? 'م'
      : 'ص';

  let displayHours =
    parsed.hours % 12;

  if (
    displayHours === 0
  ) {
    displayHours = 12;
  }

  return `${displayHours}:${String(
    parsed.minutes,
  ).padStart(2, '0')} ${period}`;
}

function isStoreOpenByBusinessHours(
  businessHours:
    StoreBusinessHour[],
  now = new Date(),
): boolean {
  /*
   * لو مفيش مواعيد مسجلة نحافظ
   * على السلوك الحالي ولا نقفل
   * الصيدلية تلقائيًا.
   */
  if (
    businessHours.length === 0
  ) {
    return true;
  }

  const currentDay =
    now.getDay();

  const previousDay =
    (currentDay + 6) % 7;

  const currentMinutes =
    now.getHours() * 60 +
    now.getMinutes();

  const todayHours =
    businessHours.find(
      (item) =>
        item.dayOfWeek ===
        currentDay,
    );

  if (
    todayHours?.isOpen
  ) {
    const openMinutes =
      getBusinessMinutes(
        todayHours.openTime,
      );

    const closeMinutes =
      getBusinessMinutes(
        todayHours.closeTime,
      );

    if (
      openMinutes !== null &&
      closeMinutes !== null
    ) {
      if (
        closeMinutes >
        openMinutes
      ) {
        if (
          currentMinutes >=
            openMinutes &&
          currentMinutes <
            closeMinutes
        ) {
          return true;
        }
      } else if (
        closeMinutes <
        openMinutes
      ) {
        /*
         * مثال:
         * 20:00 → 02:00
         */
        if (
          currentMinutes >=
          openMinutes
        ) {
          return true;
        }
      } else {
        /*
         * نفس وقت الفتح والإغلاق
         * نعتبره 24 ساعة.
         */
        return true;
      }
    }
  }

  /*
   * دعم المواعيد الممتدة
   * بعد منتصف الليل.
   */
  const previousHours =
    businessHours.find(
      (item) =>
        item.dayOfWeek ===
        previousDay,
    );

  if (
    previousHours?.isOpen
  ) {
    const previousOpenMinutes =
      getBusinessMinutes(
        previousHours.openTime,
      );

    const previousCloseMinutes =
      getBusinessMinutes(
        previousHours.closeTime,
      );

    if (
      previousOpenMinutes !== null &&
      previousCloseMinutes !== null &&
      previousCloseMinutes <
        previousOpenMinutes &&
      currentMinutes <
        previousCloseMinutes
    ) {
      return true;
    }
  }

  return false;
}

function getNextOpeningLabel(
  businessHours:
    StoreBusinessHour[],
  now = new Date(),
): string | null {
  if (
    businessHours.length === 0
  ) {
    return null;
  }

  const currentDay =
    now.getDay();

  for (
    let dayOffset = 0;
    dayOffset <= 7;
    dayOffset += 1
  ) {
    const targetDay =
      (currentDay +
        dayOffset) %
      7;

    const schedule =
      businessHours.find(
        (item) =>
          item.dayOfWeek ===
            targetDay &&
          item.isOpen,
      );

    if (
      !schedule ||
      !schedule.openTime
    ) {
      continue;
    }

    const parsedOpenTime =
      parseBusinessTime(
        schedule.openTime,
      );

    const displayTime =
      formatBusinessTime(
        schedule.openTime,
      );

    if (
      !parsedOpenTime ||
      !displayTime
    ) {
      continue;
    }

    const openingDate =
      new Date(now);

    openingDate.setDate(
      now.getDate() +
        dayOffset,
    );

    openingDate.setHours(
      parsedOpenTime.hours,
      parsedOpenTime.minutes,
      0,
      0,
    );

    if (
      openingDate.getTime() <=
      now.getTime()
    ) {
      continue;
    }

    if (
      dayOffset === 0
    ) {
      return `تفتح اليوم الساعة ${displayTime}`;
    }

    if (
      dayOffset === 1
    ) {
      return `تفتح بكرة الساعة ${displayTime}`;
    }

    return `تفتح يوم ${ARABIC_WEEK_DAYS[targetDay]} الساعة ${displayTime}`;
  }

  return null;
}

function ClosedPharmacyBackArrowIcon() {
  return (
    <View
      style={
        styles.closedPharmacyBackArrowCanvas
      }
    >
      <View
        style={
          styles.closedPharmacyBackArrowStem
        }
      />

      <View
        style={[
          styles.closedPharmacyBackArrowDiagonal,
          styles.closedPharmacyBackArrowTop,
        ]}
      />

      <View
        style={[
          styles.closedPharmacyBackArrowDiagonal,
          styles.closedPharmacyBackArrowBottom,
        ]}
      />
    </View>
  );
}

function ClosedPharmacyExperience({
  nextOpeningLabel,
}: {
  nextOpeningLabel: string | null;
}) {
  const floatY =
    useRef(
      new Animated.Value(0),
    ).current;

  const pulse =
    useRef(
      new Animated.Value(0),
    ).current;

  const capsuleX =
    useRef(
      new Animated.Value(0),
    ).current;

  useEffect(() => {
    const floatAnimation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            floatY,
            {
              toValue: -5,
              duration: 1550,
              useNativeDriver: true,
            },
          ),

          Animated.timing(
            floatY,
            {
              toValue: 0,
              duration: 1550,
              useNativeDriver: true,
            },
          ),
        ]),
      );

    const pulseAnimation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            pulse,
            {
              toValue: 1,
              duration: 1700,
              useNativeDriver: true,
            },
          ),

          Animated.timing(
            pulse,
            {
              toValue: 0,
              duration: 1700,
              useNativeDriver: true,
            },
          ),
        ]),
      );

    const capsuleAnimation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            capsuleX,
            {
              toValue: 8,
              duration: 1800,
              useNativeDriver: true,
            },
          ),

          Animated.timing(
            capsuleX,
            {
              toValue: 0,
              duration: 1800,
              useNativeDriver: true,
            },
          ),
        ]),
      );

    floatAnimation.start();
    pulseAnimation.start();
    capsuleAnimation.start();

    return () => {
      floatAnimation.stop();
      pulseAnimation.stop();
      capsuleAnimation.stop();
    };
  }, [
    capsuleX,
    floatY,
    pulse,
  ]);

  const glowOpacity =
    pulse.interpolate({
      inputRange: [
        0,
        1,
      ],

      outputRange: [
        0.12,
        0.27,
      ],
    });

  const crossOpacity =
    pulse.interpolate({
      inputRange: [
        0,
        1,
      ],

      outputRange: [
        0.58,
        1,
      ],
    });

  return (
    <View
      style={
        styles.closedPharmacyExperience
      }
    >
      <Animated.View
        style={[
          styles.closedPharmacyGlow,

          {
            opacity:
              glowOpacity,
          },
        ]}
      />

      <View
        style={
          styles.closedPharmacyMoon
        }
      >
        <View
          style={
            styles.closedPharmacyMoonCutout
          }
        />
      </View>

      <View
        style={[
          styles.closedPharmacyStar,
          styles.closedPharmacyStarOne,
        ]}
      />

      <View
        style={[
          styles.closedPharmacyStar,
          styles.closedPharmacyStarTwo,
        ]}
      />

      <View
        style={[
          styles.closedPharmacyStar,
          styles.closedPharmacyStarThree,
        ]}
      />

      <Animated.View
        style={[
          styles.closedPharmacyCrossSign,

          {
            opacity:
              crossOpacity,
          },
        ]}
      >
        <View
          style={
            styles.closedPharmacyCrossVertical
          }
        />

        <View
          style={
            styles.closedPharmacyCrossHorizontal
          }
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.closedPharmacyStore,

          {
            transform: [
              {
                translateY:
                  floatY,
              },
            ],
          },
        ]}
      >
        <View
          style={
            styles.closedPharmacyRoof
          }
        />

        <View
          style={
            styles.closedPharmacyAwning
          }
        >
          {[
            '#FFFFFF',
            '#BFECD0',
            '#FFFFFF',
            '#BFECD0',
            '#FFFFFF',
          ].map(
            (
              color,
              index,
            ) => (
              <View
                key={`closed-pharmacy-awning-${index}`}
                style={[
                  styles.closedPharmacyAwningStripe,

                  {
                    backgroundColor:
                      color,
                  },
                ]}
              />
            ),
          )}
        </View>

        <View
          style={
            styles.closedPharmacyBuilding
          }
        >
          <View
            style={
              styles.closedPharmacyWindow
            }
          >
            <View
              style={
                styles.closedPharmacyShelfTop
              }
            >
              <View
                style={[
                  styles.closedPharmacyMedicineBox,
                  styles.closedPharmacyMedicineGreen,
                ]}
              />

              <View
                style={[
                  styles.closedPharmacyMedicineBox,
                  styles.closedPharmacyMedicineWhite,
                ]}
              />

              <View
                style={[
                  styles.closedPharmacyBottle,
                  styles.closedPharmacyMedicineMint,
                ]}
              />

              <View
                style={[
                  styles.closedPharmacyMedicineBoxSmall,
                  styles.closedPharmacyMedicineWarm,
                ]}
              />
            </View>

            <View
              style={
                styles.closedPharmacyShelfBottom
              }
            >
              <View
                style={[
                  styles.closedPharmacyMedicineBoxSmall,
                  styles.closedPharmacyMedicineWhite,
                ]}
              />

              <View
                style={[
                  styles.closedPharmacyBottleSmall,
                  styles.closedPharmacyMedicineGreen,
                ]}
              />

              <View
                style={[
                  styles.closedPharmacyMedicineBoxSmall,
                  styles.closedPharmacyMedicineMint,
                ]}
              />

              <View
                style={[
                  styles.closedPharmacyBottleSmall,
                  styles.closedPharmacyMedicineWhite,
                ]}
              />
            </View>

            <View
              style={
                styles.closedPharmacyShutter
              }
            >
              {Array.from({
                length: 8,
              }).map(
                (
                  _,
                  index,
                ) => (
                  <View
                    key={`closed-pharmacy-shutter-${index}`}
                    style={
                      styles.closedPharmacyShutterLine
                    }
                  />
                ),
              )}
            </View>
          </View>

          <View
            style={
              styles.closedPharmacyDoorBase
            }
          >
            <View
              style={
                styles.closedPharmacyLock
              }
            >
              <View
                style={
                  styles.closedPharmacyLockDot
                }
              />
            </View>
          </View>
        </View>

        <View
          style={
            styles.closedPharmacyGroundShadow
          }
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.closedPharmacyCapsule,

          {
            transform: [
              {
                translateX:
                  capsuleX,
              },

              {
                rotate:
                  '-24deg',
              },
            ],
          },
        ]}
      >
        <View
          style={
            styles.closedPharmacyCapsuleHalfGreen
          }
        />

        <View
          style={
            styles.closedPharmacyCapsuleHalfWhite
          }
        />
      </Animated.View>

      <View
        style={
          styles.closedPharmacyBottleHero
        }
      >
        <View
          style={
            styles.closedPharmacyBottleCap
          }
        />

        <View
          style={
            styles.closedPharmacyBottleLabel
          }
        >
          <View
            style={
              styles.closedPharmacyBottleLabelCrossVertical
            }
          />

          <View
            style={
              styles.closedPharmacyBottleLabelCrossHorizontal
            }
          />
        </View>
      </View>

      <View
        style={
          styles.closedPharmacyCopy
        }
      >
        <Text
          style={
            styles.closedPharmacyTitle
          }
        >
          الصيدلية مغلقة
        </Text>

        {nextOpeningLabel ? (
          <View
            style={
              styles.closedPharmacyOpeningPill
            }
          >
            <Text
              style={
                styles.closedPharmacyOpeningText
              }
            >
              {nextOpeningLabel}
            </Text>
          </View>
        ) : (
          <Text
            style={
              styles.closedPharmacyOpeningFallback
            }
          >
            هنرجع نستقبل طلباتك قريب
          </Text>
        )}
      </View>
    </View>
  );
}

function CategoryVisual({
  item,
}: {
  item: CategoryDisplayItem;
}) {
  return (
    <View
      style={styles.categoryImageBox}
    >
      {item.imageSource ? (
        <Image
          source={item.imageSource}
          style={styles.categoryImage}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={
            styles.categoryFallbackIcon
          }
        >
          {getPharmacyCategoryFallbackIcon(
            item.section,
          )}
        </Text>
      )}
    </View>
  );
}

function FeaturedProductCard({
  product,
  currencyCode,
  cardWidth,
  quantity,
  isStoreClosed,
  onAdd,
  onIncrease,
  onDecrease,
}: FeaturedProductCardProps) {
  const imageUrl =
    getProductImage(product);

  const discount =
    getDiscountPercent(product);

  return (
    <View
      style={[
        styles.featuredProductCard,
        {
          width: cardWidth,
        },
      ]}
    >
      <View
        style={[
          styles.featuredProductImageBox,
          {
            width: cardWidth,
            height: cardWidth,
          },
        ]}
      >
        {imageUrl ? (
          <Image
            source={{
              uri: imageUrl,
            }}
            style={
              styles.featuredProductImage
            }
            resizeMode="cover"
          />
        ) : (
          <Text
            style={
              styles.featuredProductFallback
            }
          >
            {product.icon ||
              '💊'}
          </Text>
        )}

        {discount !== null && (
          <View
            style={
              styles.featuredDiscountBadge
            }
          >
            <Text
              style={
                styles.featuredDiscountText
              }
              numberOfLines={1}
            >
              وفر {discount}%
            </Text>
          </View>
        )}

        {quantity === 0 ? (
          <Pressable
            disabled={
              isStoreClosed
            }
            hitSlop={5}
            style={({
              pressed,
            }) => [
              styles.featuredAddButton,

              isStoreClosed &&
                styles.featuredAddButtonDisabled,

              pressed &&
                !isStoreClosed &&
                styles.featuredAddButtonPressed,
            ]}
            onPress={onAdd}
          >
            <Text
              style={
                styles.featuredAddButtonText
              }
            >
              +
            </Text>
          </Pressable>
        ) : (
          <View
            style={
              styles.featuredQuantityPill
            }
          >
            <Pressable
              hitSlop={4}
              style={
                styles.featuredQuantityButton
              }
              onPress={
                onDecrease
              }
            >
              <Text
                style={
                  styles.featuredQuantityButtonText
                }
              >
                −
              </Text>
            </Pressable>

            <Text
              style={
                styles.featuredQuantityValue
              }
            >
              {quantity}
            </Text>

            <Pressable
              disabled={
                isStoreClosed
              }
              hitSlop={4}
              style={
                styles.featuredQuantityButton
              }
              onPress={
                onIncrease
              }
            >
              <Text
                style={
                  styles.featuredQuantityButtonText
                }
              >
                +
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text
        style={
          styles.featuredProductName
        }
        numberOfLines={2}
      >
        {product.nameEn?.trim() ||
          product.name}
      </Text>

      <View
        style={
          styles.featuredCurrentPriceWrap
        }
      >
        <Text
          style={
            styles.featuredCurrentPrice
          }
          numberOfLines={1}
        >
          {formatMoney(
            product.price,
            currencyCode,
          )}
        </Text>
      </View>

      {product.compareAtPrice !==
        null &&
        product.compareAtPrice >
          product.price && (
          <Text
            style={
              styles.featuredOldPrice
            }
            numberOfLines={1}
          >
            {formatMoney(
              product.compareAtPrice,
              currencyCode,
            )}
          </Text>
        )}
    </View>
  );
}

export default function PharmacyScreen() {
  const router = useRouter();

  const {
    width: windowWidth,
  } = useWindowDimensions();

  const categoryScrollX =
    useRef(
      new Animated.Value(0),
    ).current;

  const [
    categoryViewportWidth,
    setCategoryViewportWidth,
  ] = useState(0);

  const [
    categoryContentWidth,
    setCategoryContentWidth,
  ] = useState(0);

  const [
    catalog,
    setCatalog,
  ] =
    useState<StoreCatalog | null>(
      null,
    );

  const [
    promotionBanners,
    setPromotionBanners,
  ] = useState<
    PharmacyPromotionBanner[]
  >([]);

  const [
    currencyCode,
    setCurrencyCode,
  ] = useState('EGP');

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<
    string | null
  >(null);

  const savedServiceAreaId =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaId,
    );

  const carts =
    useCartStore(
      (state) =>
        state.carts,
    );

  const addItem =
    useCartStore(
      (state) =>
        state.addItem,
    );

  const increaseStoreItem =
    useCartStore(
      (state) =>
        state.increaseStoreItem,
    );

  const decreaseStoreItem =
    useCartStore(
      (state) =>
        state.decreaseStoreItem,
    );

  const setActiveCart =
    useCartStore(
      (state) =>
        state.setActiveCart,
    );

  async function loadPharmacy() {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const bootstrap =
        await getAppBootstrap();

      const defaultServiceAreaId =
        savedServiceAreaId ??
        bootstrap.settings
          .default_service_area_id ??
        undefined;

      const pharmacyStores =
        await listStores({
          categorySlug:
            'pharmacy',

          serviceAreaId:
            defaultServiceAreaId,
        });

      if (
        pharmacyStores.length ===
        0
      ) {
        throw new Error(
          'لا توجد صيدلية متاحة حاليًا.',
        );
      }

      const pharmacy =
        pharmacyStores.find(
          (store) =>
            store.isFeatured &&
            !store.isManuallyClosed,
        ) ??
        pharmacyStores.find(
          (store) =>
            !store.isManuallyClosed,
        ) ??
        pharmacyStores[0];

      const [
        loadedCatalog,
        loadedPromotionBanners,
      ] = await Promise.all([
        getStoreCatalog(
          pharmacy.id,
          defaultServiceAreaId,
        ),

        listPharmacyPromotionBanners({
          storeId:
            pharmacy.id,
        }).catch(
          (bannerError) => {
            console.warn(
              'Unable to load pharmacy banners:',
              bannerError,
            );

            return [];
          },
        ),
      ]);

      setCatalog(
        loadedCatalog,
      );

      setPromotionBanners(
        loadedPromotionBanners,
      );

      setCurrencyCode(
        bootstrap.settings
          .currency_code ||
          'EGP',
      );
    } catch (error) {
      setCatalog(null);

      setPromotionBanners(
        [],
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل الصيدلية.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPharmacy();
  }, [
    savedServiceAreaId,
  ]);

  const categories = useMemo<
    CategoryDisplayItem[]
  >(() => {
    if (!catalog) {
      return [];
    }

    const rootSections =
      catalog.categoryTree
        .length > 0
        ? catalog.categoryTree
        : catalog.sections.filter(
            (section) =>
              section.parentId ===
              null,
          );

    return [
      ...rootSections,
    ]
      .filter(
        (section) =>
          !shouldHidePharmacyCategory(
            section,
          ),
      )

      .sort(
        (
          first,
          second,
        ) => {
          if (
            first.sortOrder !==
            second.sortOrder
          ) {
            return (
              first.sortOrder -
              second.sortOrder
            );
          }

          return first.name.localeCompare(
            second.name,
            'ar',
          );
        },
      )

      .map(
        (section) => ({
          key:
            section.id,

          label:
            section.name,

          imageSource:
            PHARMACY_CATEGORY_IMAGES[
              section.slug
            ] ?? null,

          section,
        }),
      );
  }, [
    catalog,
  ]);

  const categoryColumns =
    useMemo(
      () =>
        makeCategoryColumns(
          categories,
        ),
      [
        categories,
      ],
    );

  const categoryMaxScroll =
    Math.max(
      categoryContentWidth -
        categoryViewportWidth,
      1,
    );

  const categoryIndicatorTravel =
    CATEGORY_INDICATOR_TRACK_WIDTH -
    CATEGORY_INDICATOR_THUMB_WIDTH;

  const categoryIndicatorTranslateX =
    categoryScrollX.interpolate({
      inputRange: [
        0,
        categoryMaxScroll,
      ],

      outputRange: [
        0,
        categoryIndicatorTravel,
      ],

      extrapolate:
        'clamp',
    });

  const catalogProductsById =
    useMemo(() => {
      const productsById =
        new Map<
          string,
          CatalogProduct
        >();

      for (
        const section of
        catalog?.sections ??
        []
      ) {
        const sectionProducts =
          getCatalogSectionProducts(
            section,
            true,
          );

        for (
          const product of
          sectionProducts
        ) {
          productsById.set(
            product.id,
            product,
          );
        }

        for (
          const product of
          section.products
        ) {
          productsById.set(
            product.id,
            product,
          );
        }
      }

      return productsById;
    }, [
      catalog,
    ]);

  const resolvedPromotionBanners =
    useMemo<
      ResolvedPromotionBanner[]
    >(() => {
      return promotionBanners
        .map(
          (banner) => ({
            ...banner,

            products:
              banner.productIds
                .map(
                  (
                    productId,
                  ) =>
                    catalogProductsById.get(
                      productId,
                    ),
                )
                .filter(
                  (
                    product,
                  ): product is CatalogProduct =>
                    Boolean(
                      product,
                    ),
                ),
          }),
        )

        .filter(
          (banner) =>
            Boolean(
              banner.imageUrl.trim(),
            ),
        );
    }, [
      catalogProductsById,
      promotionBanners,
    ]);

  const pageWidth =
    Math.min(
      windowWidth,
      560,
    );

  const featuredCardWidth =
    Math.min(
      116,
      Math.max(
        92,
        pageWidth * 0.3,
      ),
    );

  const promotionBannerWidth =
    Math.max(
      pageWidth,
      1,
    );

  const promotionBannerHeight =
    Math.round(
      promotionBannerWidth *
        0.64,
    );

  const promotionProductsOverlap =
    Math.round(
      promotionBannerHeight *
        0.49,
    );

  if (isLoading) {
    return (
      <CatalogHomeScreenSkeleton />
    );
  }

  if (
    !catalog ||
    errorMessage
  ) {
    return (
      <SafeAreaView
        style={
          styles.stateScreen
        }
      >
        <StatusBar
          style="dark"
        />

        <Text
          style={
            styles.stateEmoji
          }
        >
          💊
        </Text>

        <Text
          style={
            styles.stateTitle
          }
        >
          الصيدلية غير متاحة
        </Text>

        <Text
          style={
            styles.stateDescription
          }
        >
          {errorMessage ??
            'تعذر تحميل الصيدلية.'}
        </Text>

        <Pressable
          style={({
            pressed,
          }) => [
            styles.retryButton,

            pressed &&
              styles.generalPressed,
          ]}
          onPress={() => {
            void loadPharmacy();
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

        <Pressable
          style={({
            pressed,
          }) => [
            styles.errorBackButton,

            pressed &&
              styles.generalPressed,
          ]}
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.errorBackButtonText
            }
          >
            رجوع
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const currentStore =
    catalog.store;

  const delivery =
    catalog.delivery;

  const currentCart =
    carts[
      currentStore.id
    ] ?? null;

  const cartItems =
    currentCart?.items ??
    [];

  const isStoreClosed =
    currentStore.isManuallyClosed ||
    !isStoreOpenByBusinessHours(
      catalog.businessHours,
    );

  const nextOpeningLabel =
    getNextOpeningLabel(
      catalog.businessHours,
    );

  const currentStoreItemCount =
    cartItems.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.quantity,
      0,
    );

  const currentStoreSubtotal =
    cartItems.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.price *
          item.quantity,
      0,
    );

  const shouldShowCartBar =
    currentStoreItemCount >
    0;

  function openCategory(
    item: CategoryDisplayItem,
  ) {
    router.push({
      pathname:
        '/pharmacy-category/[slug]',

      params: {
        slug:
          item.section.slug,

        storeId:
          currentStore.id,

        categoryKey:
          item.key,

        label:
          item.label,
      },
    });
  }

  function addFeaturedProduct(
    product: CatalogProduct,
  ) {
    if (
      isStoreClosed
    ) {
      return;
    }

    addItem(
      {
        id:
          currentStore.id,

        name:
          currentStore.name,

        icon:
          currentStore.icon,

        categorySlug:
          currentStore
            .categorySlug,

        deliveryFee:
          delivery
            .deliveryFee,

        minimumOrder:
          delivery
            .minimumOrder,
      },

      {
        id:
          product.id,

        name:
          product.name,

        description:
          product.description,

        price:
          product.price,

        icon:
          product.icon,

        variantId:
          null,

        variantName:
          null,
      },
    );
  }

  function increaseFeaturedProduct(
    product: CatalogProduct,
  ) {
    if (
      isStoreClosed
    ) {
      return;
    }

    const existingItem =
      cartItems.find(
        (item) =>
          item.id ===
            product.id &&
          item.variantId ===
            null,
      );

    if (
      existingItem
    ) {
      increaseStoreItem(
        currentStore.id,
        product.id,
        null,
      );

      return;
    }

    addFeaturedProduct(
      product,
    );
  }

  function decreaseFeaturedProduct(
    productId: string,
  ) {
    const existingItem =
      cartItems.find(
        (item) =>
          item.id ===
            productId &&
          item.variantId ===
            null,
      );

    if (
      !existingItem
    ) {
      return;
    }

    decreaseStoreItem(
      currentStore.id,
      productId,
      null,
    );
  }

  function getProductQuantity(
    productId: string,
  ) {
    return (
      cartItems.find(
        (item) =>
          item.id ===
            productId &&
          item.variantId ===
            null,
      )?.quantity ??
      0
    );
  }

  function openCart() {
    setActiveCart(
      currentStore.id,
    );

    router.push({
      pathname:
        '/cart',

      params: {
        storeId:
          currentStore.id,
      },
    });
  }

  if (isStoreClosed) {
    return (
      <SafeAreaView
        style={
          styles.closedPharmacyStateScreen
        }
        edges={[
          'top',
          'bottom',
        ]}
      >
        <StatusBar
          style="light"
        />

        <View
          style={
            styles.closedPharmacyStateHeader
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            style={({
              pressed,
            }) => [
              styles.closedPharmacyBackButton,

              pressed &&
                styles.closedPharmacyBackButtonPressed,
            ]}
            onPress={() =>
              router.back()
            }
          >
            <ClosedPharmacyBackArrowIcon />
          </Pressable>
        </View>

        <ClosedPharmacyExperience
          nextOpeningLabel={
            nextOpeningLabel
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={
        styles.screen
      }
      edges={[
        'top',
      ]}
    >
      <StatusBar
        style="dark"
      />

      <View
        style={
          styles.pageShell
        }
      >
        <View
          style={
            styles.header
          }
        >
          <Pressable
            style={({
              pressed,
            }) => [
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
          style={
            styles.mainScrollView
          }
          contentContainerStyle={[
            styles.mainContent,

            shouldShowCartBar &&
              styles.mainContentWithCart,
          ]}
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={
              styles.categoriesSection
            }
          >
            <Text
              style={
                styles.categoriesTitle
              }
            >
              تسوق حسب الفئة
            </Text>

            {categoryColumns.length >
            0 ? (
              <>
                <Animated.ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={
                    false
                  }
                  scrollEventThrottle={
                    16
                  }
                  contentContainerStyle={
                    styles.categoriesRail
                  }
                  onLayout={(
                    event,
                  ) => {
                    setCategoryViewportWidth(
                      event
                        .nativeEvent
                        .layout
                        .width,
                    );
                  }}
                  onContentSizeChange={(
                    width,
                  ) => {
                    setCategoryContentWidth(
                      width,
                    );
                  }}
                  onScroll={
                    Animated.event(
                      [
                        {
                          nativeEvent:
                            {
                              contentOffset:
                                {
                                  x: categoryScrollX,
                                },
                            },
                        },
                      ],

                      {
                        useNativeDriver:
                          true,
                      },
                    )
                  }
                >
                  {categoryColumns.map(
                    (
                      column,
                      columnIndex,
                    ) => (
                      <View
                        key={`pharmacy-category-column-${columnIndex}`}
                        style={
                          styles.categoryColumn
                        }
                      >
                        {column.map(
                          (
                            item,
                          ) => (
                            <Pressable
                              key={
                                item.key
                              }
                              style={({
                                pressed,
                              }) => [
                                styles.categoryItem,

                                pressed &&
                                  styles.categoryItemPressed,
                              ]}
                              onPress={() =>
                                openCategory(
                                  item,
                                )
                              }
                            >
                              <CategoryVisual
                                item={
                                  item
                                }
                              />

                              <Text
                                style={
                                  styles.categoryLabel
                                }
                                numberOfLines={
                                  2
                                }
                              >
                                {
                                  item.label
                                }
                              </Text>
                            </Pressable>
                          ),
                        )}
                      </View>
                    ),
                  )}
                </Animated.ScrollView>

                <View
                  style={
                    styles.categoryPagination
                  }
                >
                  <Animated.View
                    style={[
                      styles.categoryPaginationActive,

                      {
                        transform:
                          [
                            {
                              translateX:
                                categoryIndicatorTranslateX,
                            },
                          ],
                      },
                    ]}
                  />
                </View>
              </>
            ) : (
              <View
                style={
                  styles.emptyCategories
                }
              >
                <Text
                  style={
                    styles.emptyCategoriesIcon
                  }
                >
                  💊
                </Text>

                <Text
                  style={
                    styles.emptyCategoriesTitle
                  }
                >
                  لا توجد فئات متاحة حاليًا
                </Text>
              </View>
            )}
          </View>

          {resolvedPromotionBanners.map(
            (
              banner,
              bannerIndex,
            ) => (
              <View
                key={
                  banner.id
                }
                style={[
                  styles.promotionSection,

                  bannerIndex ===
                    resolvedPromotionBanners.length -
                      1 &&
                    styles.promotionSectionLast,
                ]}
              >
                <View
                  style={
                    styles.promotionBannerFrame
                  }
                >
                  <Image
                    source={{
                      uri:
                        banner.imageUrl,
                    }}
                    style={[
                      styles.promotionBanner,

                      {
                        height:
                          promotionBannerHeight,
                      },
                    ]}
                    resizeMode="cover"
                    accessibilityLabel={
                      banner.altTextAr ??
                      banner.adminLabel
                    }
                  />
                </View>

                {banner.products
                  .length >
                  0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={
                      false
                    }
                    directionalLockEnabled
                    contentContainerStyle={
                      styles.promotionProductsRail
                    }
                    style={[
                      styles.promotionProductsScroll,

                      {
                        marginTop:
                          -promotionProductsOverlap,
                      },
                    ]}
                  >
                    {banner.products.map(
                      (
                        product,
                      ) => (
                        <FeaturedProductCard
                          key={`${banner.id}-${product.id}`}
                          product={
                            product
                          }
                          currencyCode={
                            currencyCode
                          }
                          cardWidth={
                            featuredCardWidth
                          }
                          quantity={getProductQuantity(
                            product.id,
                          )}
                          isStoreClosed={
                            isStoreClosed
                          }
                          onAdd={() =>
                            addFeaturedProduct(
                              product,
                            )
                          }
                          onIncrease={() =>
                            increaseFeaturedProduct(
                              product,
                            )
                          }
                          onDecrease={() =>
                            decreaseFeaturedProduct(
                              product.id,
                            )
                          }
                        />
                      ),
                    )}
                  </ScrollView>
                )}
              </View>
            ),
          )}
        </ScrollView>

        {shouldShowCartBar && (
          <View
            pointerEvents="box-none"
            style={
              styles.cartBarFloatingWrapper
            }
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`عرض السلة، ${currentStoreItemCount} منتجات، الإجمالي ${formatCartMoney(
                currentStoreSubtotal,
                currencyCode,
              )}`}
              style={({
                pressed,
              }) => [
                styles.cartBar,

                pressed &&
                  styles.cartBarPressed,
              ]}
              onPress={
                openCart
              }
            >
              <View
                style={
                  styles.cartCountBadge
                }
              >
                <Text
                  style={
                    styles.cartCountText
                  }
                >
                  {
                    currentStoreItemCount
                  }
                </Text>
              </View>

              <View
                style={
                  styles.cartBarRight
                }
              >
                <Text
                  style={
                    styles.cartBarText
                  }
                  numberOfLines={
                    1
                  }
                >
                  {formatCartMoney(
                    currentStoreSubtotal,
                    currencyCode,
                  )}{' '}
                  عرض السلة
                </Text>
              </View>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      backgroundColor:
        '#FFFFFF',

      flex: 1,
    },

    pageShell: {
      alignSelf:
        'center',

      backgroundColor:
        '#FFFFFF',

      flex: 1,

      maxWidth:
        560,

      position:
        'relative',

      width:
        '100%',
    },

    header: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      flexDirection:
        'row',

      paddingBottom:
        12,

      paddingHorizontal:
        16,

      paddingTop:
        10,

      zIndex:
        10,
    },

    backButton: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E1E1E1',

      borderRadius:
        24,

      borderWidth:
        1,

      height:
        46,

      justifyContent:
        'center',

      width:
        46,
    },

    headerButtonPressed: {
      backgroundColor:
        '#F7F7F7',

      transform: [
        {
          scale:
            0.97,
        },
      ],
    },

    backArrowCanvas: {
      height:
        23,

      position:
        'relative',

      width:
        24,
    },

    backArrowStem: {
      backgroundColor:
        '#242424',

      borderRadius:
        2,

      height:
        2.2,

      left:
        3,

      position:
        'absolute',

      top:
        10.3,

      width:
        19,
    },

    backArrowDiagonal: {
      backgroundColor:
        '#242424',

      borderRadius:
        2,

      height:
        2.2,

      left:
        2,

      position:
        'absolute',

      width:
        10,
    },

    backArrowTop: {
      top:
        7,

      transform: [
        {
          rotate:
            '-42deg',
        },
      ],
    },

    backArrowBottom: {
      top:
        14,

      transform: [
        {
          rotate:
            '42deg',
        },
      ],
    },

    mainScrollView: {
      flex:
        1,
    },

    mainContent: {
      backgroundColor:
        '#FFFFFF',

      paddingBottom:
        30,
    },

    mainContentWithCart: {
      paddingBottom:
        115,
    },

    categoriesSection: {
      backgroundColor:
        '#FFFFFF',

      paddingTop:
        1,
    },

    categoriesTitle: {
      color:
        '#202020',

      fontSize:
        21,

      fontWeight:
        '800',

      letterSpacing:
        -0.45,

      marginBottom:
        14,

      paddingHorizontal:
        16,
    },

    categoriesRail: {
      gap:
        7,

      paddingHorizontal:
        16,
    },

    categoryColumn: {
      gap:
        15,

      width:
        85,
    },

    categoryItem: {
      alignItems:
        'center',

      width:
        85,
    },

    categoryItemPressed: {
      opacity:
        0.68,

      transform: [
        {
          scale:
            0.97,
        },
      ],
    },

    categoryImageBox: {
      alignItems:
        'center',

      backgroundColor:
        '#F5F5F5',

      borderRadius:
        13,

      height:
        80,

      justifyContent:
        'center',

      overflow:
        'hidden',

      width:
        80,
    },

    categoryImage: {
      height:
        '100%',

      width:
        '100%',
    },

    categoryFallbackIcon: {
      fontSize:
        39,
    },

    categoryLabel: {
      color:
        '#202020',

      fontSize:
        13.5,

      fontWeight:
        '400',

      letterSpacing:
        -0.2,

      lineHeight:
        18,

      marginTop:
        8,

      minHeight:
        36,

      textAlign:
        'center',

      writingDirection:
        'rtl',

      width:
        85,
    },

    categoryPagination: {
      alignSelf:
        'center',

      backgroundColor:
        '#E6E6E6',

      borderRadius:
        3,

      height:
        5,

      marginBottom:
        22,

      marginTop:
        18,

      overflow:
        'hidden',

      position:
        'relative',

      width:
        CATEGORY_INDICATOR_TRACK_WIDTH,
    },

    categoryPaginationActive: {
      backgroundColor:
        '#151515',

      borderRadius:
        3,

      height:
        5,

      left:
        0,

      position:
        'absolute',

      top:
        0,

      width:
        CATEGORY_INDICATOR_THUMB_WIDTH,
    },

    emptyCategories: {
      alignItems:
        'center',

      paddingHorizontal:
        28,

      paddingVertical:
        28,
    },

    emptyCategoriesIcon: {
      fontSize:
        42,
    },

    emptyCategoriesTitle: {
      color:
        '#202020',

      fontSize:
        15,

      fontWeight:
        '700',

      marginTop:
        10,

      textAlign:
        'center',
    },

    promotionSection: {
      backgroundColor:
        '#FFFFFF',

      marginBottom:
        22,

      overflow:
        'visible',

      width:
        '100%',
    },

    promotionSectionLast: {
      marginBottom:
        0,
    },

    promotionBannerFrame: {
      marginHorizontal:
        0,

      overflow:
        'hidden',

      width:
        '100%',
    },

    promotionBanner: {
      backgroundColor:
        '#F4F4F4',

      width:
        '100%',
    },

    promotionProductsScroll: {
      overflow:
        'visible',
    },

    promotionProductsRail: {
      alignItems:
        'flex-start',

      gap:
        7,

      paddingBottom:
        7,

      paddingHorizontal:
        21,

      paddingTop:
        0,
    },

    featuredProductCard: {
      backgroundColor:
        'transparent',

      overflow:
        'visible',
    },

    featuredProductImageBox: {
      alignItems:
        'center',

      backgroundColor:
        '#F4F4F4',

      borderColor:
        '#E8E8E8',

      borderRadius:
        12,

      borderWidth:
        1,

      justifyContent:
        'center',

      overflow:
        'hidden',

      position:
        'relative',
    },

    featuredProductImage: {
      height:
        '100%',

      width:
        '100%',
    },

    featuredProductFallback: {
      fontSize:
        34,
    },

    featuredDiscountBadge: {
      alignItems:
        'center',

      backgroundColor:
        '#BFFF00',

      borderRadius:
        3,

      justifyContent:
        'center',

      left:
        6,

      minHeight:
        17,

      paddingHorizontal:
        4,

      paddingVertical:
        2,

      position:
        'absolute',

      top:
        6,

      zIndex:
        5,
    },

    featuredDiscountText: {
      color:
        '#111111',

      fontSize:
        8.5,

      fontWeight:
        '500',

      lineHeight:
        11,
    },

    featuredAddButton: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E7E7E7',

      borderRadius:
        18,

      borderWidth:
        1,

      bottom:
        6,

      elevation:
        2,

      height:
        34,

      justifyContent:
        'center',

      position:
        'absolute',

      right:
        6,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          1,
      },

      shadowOpacity:
        0.08,

      shadowRadius:
        2,

      width:
        34,

      zIndex:
        8,
    },

    featuredAddButtonPressed: {
      backgroundColor:
        '#F8F8F8',

      transform: [
        {
          scale:
            0.94,
        },
      ],
    },

    featuredAddButtonDisabled: {
      opacity:
        0.45,
    },

    featuredAddButtonText: {
      color:
        NAVIENTY_NOW_COLORS.primary,

      fontSize:
        25,

      fontWeight:
        '300',

      lineHeight:
        27,

      marginTop:
        -2,
    },

    featuredQuantityPill: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderColor:
        '#E7E7E7',

      borderRadius:
        18,

      borderWidth:
        1,

      bottom:
        6,

      elevation:
        2,

      flexDirection:
        'row',

      height:
        34,

      position:
        'absolute',

      right:
        6,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          1,
      },

      shadowOpacity:
        0.08,

      shadowRadius:
        2,

      zIndex:
        8,
    },

    featuredQuantityButton: {
      alignItems:
        'center',

      height:
        32,

      justifyContent:
        'center',

      width:
        25,
    },

    featuredQuantityButtonText: {
      color:
        NAVIENTY_NOW_COLORS.primary,

      fontSize:
        18,

      fontWeight:
        '500',

      lineHeight:
        20,
    },

    featuredQuantityValue: {
      color:
        '#202020',

      fontSize:
        10,

      fontWeight:
        '700',

      minWidth:
        14,

      textAlign:
        'center',
    },

    featuredProductName: {
      color:
        '#202020',

      fontSize:
        10.5,

      fontWeight:
        '400',

      letterSpacing:
        -0.15,

      lineHeight:
        12.5,

      marginTop:
        7,

      minHeight:
        25,

      textAlign:
        'left',

      writingDirection:
        'ltr',
    },

    featuredCurrentPriceWrap: {
      alignSelf:
        'flex-start',

      borderBottomColor:
        '#BFFF00',

      borderBottomWidth:
        2,

      marginTop:
        3,
    },

    featuredCurrentPrice: {
      color:
        '#202020',

      fontSize:
        10.5,

      fontWeight:
        '500',

      lineHeight:
        13,

      textAlign:
        'left',

      writingDirection:
        'ltr',
    },

    featuredOldPrice: {
      alignSelf:
        'flex-start',

      color:
        '#858585',

      fontSize:
        9,

      lineHeight:
        11,

      marginTop:
        1,

      textAlign:
        'left',

      textDecorationLine:
        'line-through',

      writingDirection:
        'ltr',
    },

    cartBarFloatingWrapper: {
      bottom:
        12,

      left:
        18,

      position:
        'absolute',

      right:
        18,

      zIndex:
        999,
    },

    cartBar: {
      alignItems:
        'center',

      backgroundColor:
        '#00B956',

      borderRadius:
        34,

      elevation:
        20,

      flexDirection:
        'row',

      height:
        64,

      justifyContent:
        'space-between',

      paddingHorizontal:
        9,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          3,
      },

      shadowOpacity:
        0.16,

      shadowRadius:
        8,

      width:
        '100%',
    },

    cartBarPressed: {
      opacity:
        0.92,

      transform: [
        {
          scale:
            0.985,
        },
      ],
    },

    cartCountBadge: {
      alignItems:
        'center',

      backgroundColor:
        '#009D49',

      borderRadius:
        24,

      height:
        48,

      justifyContent:
        'center',

      width:
        48,
    },

    cartCountText: {
      color:
        '#FFFFFF',

      fontSize:
        17,

      fontWeight:
        '800',

      textAlign:
        'center',
    },

    cartBarRight: {
      alignItems:
        'flex-end',

      flex:
        1,

      justifyContent:
        'center',

      paddingHorizontal:
        16,
    },

    cartBarText: {
      color:
        '#FFFFFF',

      fontSize:
        15.5,

      fontWeight:
        '800',

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    /* ========================================================
     * CLOSED PHARMACY — FULL SCREEN EXPERIENCE
     * ========================================================
     */

    closedPharmacyStateScreen: {
      backgroundColor:
        '#0D211A',

      flex:
        1,
    },

    closedPharmacyStateHeader: {
      alignItems:
        'flex-start',

      height:
        62,

      justifyContent:
        'center',

      paddingHorizontal:
        16,

      zIndex:
        20,
    },

    closedPharmacyBackButton: {
      alignItems:
        'center',

      backgroundColor:
        'rgba(255, 255, 255, 0.09)',

      borderColor:
        'rgba(255, 255, 255, 0.16)',

      borderRadius:
        24,

      borderWidth:
        1,

      height:
        46,

      justifyContent:
        'center',

      width:
        46,
    },

    closedPharmacyBackButtonPressed: {
      backgroundColor:
        'rgba(255, 255, 255, 0.15)',

      transform: [
        {
          scale:
            0.97,
        },
      ],
    },

    closedPharmacyBackArrowCanvas: {
      height:
        23,

      position:
        'relative',

      width:
        24,
    },

    closedPharmacyBackArrowStem: {
      backgroundColor:
        '#FFFFFF',

      borderRadius:
        2,

      height:
        2.2,

      left:
        3,

      position:
        'absolute',

      top:
        10.3,

      width:
        19,
    },

    closedPharmacyBackArrowDiagonal: {
      backgroundColor:
        '#FFFFFF',

      borderRadius:
        2,

      height:
        2.2,

      left:
        2,

      position:
        'absolute',

      width:
        10,
    },

    closedPharmacyBackArrowTop: {
      top:
        7,

      transform: [
        {
          rotate:
            '-42deg',
        },
      ],
    },

    closedPharmacyBackArrowBottom: {
      top:
        14,

      transform: [
        {
          rotate:
            '42deg',
        },
      ],
    },

    closedPharmacyExperience: {
      alignItems:
        'center',

      flex:
        1,

      justifyContent:
        'center',

      overflow:
        'hidden',

      paddingBottom:
        44,

      position:
        'relative',

      width:
        '100%',
    },

    closedPharmacyGlow: {
      backgroundColor:
        '#35D57A',

      borderRadius:
        999,

      height:
        430,

      position:
        'absolute',

      top:
        28,

      width:
        430,
    },

    closedPharmacyMoon: {
      backgroundColor:
        '#DFF9E8',

      borderRadius:
        999,

      height:
        50,

      position:
        'absolute',

      right:
        34,

      top:
        36,

      width:
        50,
    },

    closedPharmacyMoonCutout: {
      backgroundColor:
        '#0D211A',

      borderRadius:
        999,

      height:
        46,

      left:
        17,

      position:
        'absolute',

      top:
        -3,

      width:
        46,
    },

    closedPharmacyStar: {
      backgroundColor:
        '#DFF9E8',

      borderRadius:
        999,

      height:
        4,

      position:
        'absolute',

      width:
        4,
    },

    closedPharmacyStarOne: {
      right:
        102,

      top:
        66,
    },

    closedPharmacyStarTwo: {
      height:
        3,

      right:
        77,

      top:
        112,

      width:
        3,
    },

    closedPharmacyStarThree: {
      height:
        3,

      left:
        46,

      top:
        118,

      width:
        3,
    },

    closedPharmacyCrossSign: {
      alignItems:
        'center',

      backgroundColor:
        'rgba(53, 213, 122, 0.10)',

      borderColor:
        'rgba(135, 255, 184, 0.38)',

      borderRadius:
        24,

      borderWidth:
        1,

      height:
        72,

      justifyContent:
        'center',

      position:
        'absolute',

      right:
        23,

      top:
        145,

      transform: [
        {
          rotate:
            '8deg',
        },
      ],

      width:
        72,
    },

    closedPharmacyCrossVertical: {
      backgroundColor:
        '#82F1AE',

      borderRadius:
        4,

      height:
        36,

      position:
        'absolute',

      width:
        12,
    },

    closedPharmacyCrossHorizontal: {
      backgroundColor:
        '#82F1AE',

      borderRadius:
        4,

      height:
        12,

      position:
        'absolute',

      width:
        36,
    },

    closedPharmacyStore: {
      height:
        260,

      marginTop:
        -60,

      position:
        'relative',

      width:
        270,
    },

    closedPharmacyRoof: {
      backgroundColor:
        '#F4F7F4',

      borderRadius:
        18,

      height:
        34,

      left:
        22,

      position:
        'absolute',

      right:
        22,

      top:
        7,
    },

    closedPharmacyAwning: {
      borderBottomLeftRadius:
        18,

      borderBottomRightRadius:
        18,

      flexDirection:
        'row',

      height:
        54,

      left:
        8,

      overflow:
        'hidden',

      position:
        'absolute',

      right:
        8,

      top:
        31,
    },

    closedPharmacyAwningStripe: {
      flex:
        1,
    },

    closedPharmacyBuilding: {
      backgroundColor:
        '#F4F7F4',

      borderBottomLeftRadius:
        28,

      borderBottomRightRadius:
        28,

      bottom:
        24,

      left:
        19,

      overflow:
        'hidden',

      position:
        'absolute',

      right:
        19,

      top:
        75,
    },

    closedPharmacyWindow: {
      backgroundColor:
        '#172B22',

      borderRadius:
        16,

      height:
        102,

      left:
        23,

      overflow:
        'hidden',

      position:
        'absolute',

      right:
        23,

      top:
        22,
    },

    closedPharmacyShelfTop: {
      alignItems:
        'flex-end',

      bottom:
        53,

      flexDirection:
        'row',

      gap:
        8,

      left:
        14,

      position:
        'absolute',

      right:
        14,
    },

    closedPharmacyShelfBottom: {
      alignItems:
        'flex-end',

      bottom:
        14,

      flexDirection:
        'row',

      gap:
        8,

      left:
        14,

      position:
        'absolute',

      right:
        14,
    },

    closedPharmacyMedicineBox: {
      borderRadius:
        4,

      height:
        23,

      width:
        29,
    },

    closedPharmacyMedicineBoxSmall: {
      borderRadius:
        4,

      height:
        17,

      width:
        22,
    },

    closedPharmacyBottle: {
      borderRadius:
        6,

      height:
        27,

      width:
        20,
    },

    closedPharmacyBottleSmall: {
      borderRadius:
        5,

      height:
        20,

      width:
        16,
    },

    closedPharmacyMedicineGreen: {
      backgroundColor:
        '#70D89C',
    },

    closedPharmacyMedicineMint: {
      backgroundColor:
        '#BDEFD0',
    },

    closedPharmacyMedicineWhite: {
      backgroundColor:
        '#EEF6F0',
    },

    closedPharmacyMedicineWarm: {
      backgroundColor:
        '#F2BA7E',
    },

    closedPharmacyShutter: {
      backgroundColor:
        '#AEB6B1',

      bottom:
        0,

      left:
        0,

      position:
        'absolute',

      right:
        0,

      top:
        17,

      zIndex:
        5,
    },

    closedPharmacyShutterLine: {
      backgroundColor:
        'rgba(255, 255, 255, 0.42)',

      height:
        2,

      marginTop:
        10,
    },

    closedPharmacyDoorBase: {
      alignItems:
        'center',

      bottom:
        7,

      height:
        28,

      justifyContent:
        'center',

      left:
        0,

      position:
        'absolute',

      right:
        0,
    },

    closedPharmacyLock: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,

      borderRadius:
        12,

      height:
        25,

      justifyContent:
        'center',

      width:
        25,
    },

    closedPharmacyLockDot: {
      backgroundColor:
        '#FFFFFF',

      borderRadius:
        999,

      height:
        5,

      width:
        5,
    },

    closedPharmacyGroundShadow: {
      backgroundColor:
        'rgba(0, 0, 0, 0.22)',

      borderRadius:
        999,

      bottom:
        3,

      height:
        18,

      left:
        34,

      position:
        'absolute',

      right:
        34,

      transform: [
        {
          scaleX:
            0.88,
        },
      ],
    },

    closedPharmacyCapsule: {
      bottom:
        '31%',

      flexDirection:
        'row',

      height:
        36,

      left:
        28,

      overflow:
        'hidden',

      position:
        'absolute',

      width:
        76,
    },

    closedPharmacyCapsuleHalfGreen: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,

      borderBottomLeftRadius:
        18,

      borderTopLeftRadius:
        18,

      flex:
        1,
    },

    closedPharmacyCapsuleHalfWhite: {
      backgroundColor:
        '#F0F6F2',

      borderBottomRightRadius:
        18,

      borderTopRightRadius:
        18,

      flex:
        1,
    },

    closedPharmacyBottleHero: {
      backgroundColor:
        '#EAF4EC',

      borderRadius:
        17,

      bottom:
        '29%',

      height:
        83,

      position:
        'absolute',

      right:
        22,

      transform: [
        {
          rotate:
            '8deg',
        },
      ],

      width:
        56,
    },

    closedPharmacyBottleCap: {
      backgroundColor:
        '#99A49E',

      borderRadius:
        5,

      height:
        13,

      left:
        10,

      position:
        'absolute',

      right:
        10,

      top:
        -9,
    },

    closedPharmacyBottleLabel: {
      alignItems:
        'center',

      backgroundColor:
        '#BFECD0',

      borderRadius:
        9,

      bottom:
        10,

      justifyContent:
        'center',

      left:
        7,

      position:
        'absolute',

      right:
        7,

      top:
        21,
    },

    closedPharmacyBottleLabelCrossVertical: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,

      borderRadius:
        2,

      height:
        22,

      position:
        'absolute',

      width:
        7,
    },

    closedPharmacyBottleLabelCrossHorizontal: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,

      borderRadius:
        2,

      height:
        7,

      position:
        'absolute',

      width:
        22,
    },

    closedPharmacyCopy: {
      alignItems:
        'center',

      marginTop:
        18,

      paddingHorizontal:
        28,

      width:
        '100%',
    },

    closedPharmacyTitle: {
      color:
        '#FFFFFF',

      fontSize:
        28,

      fontWeight:
        '900',

      lineHeight:
        38,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    closedPharmacyOpeningPill: {
      alignItems:
        'center',

      backgroundColor:
        'rgba(255, 255, 255, 0.10)',

      borderColor:
        'rgba(255, 255, 255, 0.15)',

      borderRadius:
        999,

      borderWidth:
        1,

      marginTop:
        18,

      minHeight:
        46,

      paddingHorizontal:
        18,

      paddingVertical:
        10,
    },

    closedPharmacyOpeningText: {
      color:
        '#FFFFFF',

      fontSize:
        14,

      fontWeight:
        '800',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    closedPharmacyOpeningFallback: {
      color:
        '#DFF9E8',

      fontSize:
        13,

      fontWeight:
        '700',

      marginTop:
        17,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    stateScreen: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      flex:
        1,

      justifyContent:
        'center',

      paddingHorizontal:
        28,
    },

    stateEmoji: {
      fontSize:
        50,
    },

    stateTitle: {
      color:
        '#202020',

      fontSize:
        21,

      fontWeight:
        '800',

      marginTop:
        15,

      textAlign:
        'center',
    },

    stateDescription: {
      color:
        '#777777',

      fontSize:
        13,

      lineHeight:
        20,

      marginTop:
        8,

      maxWidth:
        330,

      textAlign:
        'center',
    },

    retryButton: {
      backgroundColor:
        '#222222',

      borderRadius:
        14,

      marginTop:
        22,

      minWidth:
        150,

      paddingHorizontal:
        20,

      paddingVertical:
        13,
    },

    retryButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        14,

      fontWeight:
        '700',

      textAlign:
        'center',
    },

    errorBackButton: {
      borderColor:
        '#E0E0E0',

      borderRadius:
        14,

      borderWidth:
        1,

      marginTop:
        10,

      minWidth:
        150,

      paddingHorizontal:
        20,

      paddingVertical:
        12,
    },

    errorBackButtonText: {
      color:
        '#222222',

      fontSize:
        14,

      fontWeight:
        '600',

      textAlign:
        'center',
    },

    generalPressed: {
      opacity:
        0.72,

      transform: [
        {
          scale:
            0.98,
        },
      ],
    },
  });