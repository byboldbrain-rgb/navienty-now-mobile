import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PremiumPromoTemplate from '../../components/promo/premium-promo-template';
import getAppBootstrap, {
  type AppBootstrap,
} from '../../services/bootstrap-service';
import {
  getStoreCatalog,
  listStores,
  type CatalogProduct,
  type StoreCatalog,
  type StoreCategorySlug,
  type StoreSummary,
} from '../../services/catalog-service';
import {
  type HomeBanner,
  type HomeBannerImage,
} from '../../services/home-banners-service';
import { useCartStore } from '../../store/cart-store';
import { useCustomerStore } from '../../store/customer-store';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../../theme/navienty-now-theme';

type BootstrapCategory =
  AppBootstrap['store_categories'][number] & {
    subtitle_ar?: string | null;
  };

const LAUNDRY_CATEGORY_SLUG =
  'laundry';

const LAUNDRY_PRODUCT_SLUG =
  'wash-and-iron';

const LAUNDRY_CATEGORY_ALIASES =
  new Set([
    'laundry',
    'laundry-ironing',
    'wash-and-iron',
    'washing-ironing',
  ]);

/*
 * ============================================================
 * LAUNDRY CAMPAIGN LOCAL ASSETS
 * ============================================================
 *
 * Hero:
 * 1112 × 1280 px
 *
 * Detail images:
 * 1125 × 792 px
 *
 * Path:
 * src/assets/images/laundry/
 * ============================================================
 */

const LAUNDRY_HERO_IMAGE =
  Image.resolveAssetSource(
    require(
      '../../assets/images/laundry/laundry-hero.webp',
    ),
  ).uri;

const LAUNDRY_DETAIL_IMAGE_01 =
  Image.resolveAssetSource(
    require(
      '../../assets/images/laundry/laundry-detail-01.webp',
    ),
  ).uri;

const LAUNDRY_DETAIL_IMAGE_02 =
  Image.resolveAssetSource(
    require(
      '../../assets/images/laundry/laundry-detail-02.webp',
    ),
  ).uri;

const LAUNDRY_DETAIL_IMAGE_03 =
  Image.resolveAssetSource(
    require(
      '../../assets/images/laundry/laundry-detail-03.webp',
    ),
  ).uri;

function normalizeSlug(
  value:
    | string
    | null
    | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

function findLaundryProduct(
  catalog: StoreCatalog,
): CatalogProduct | null {
  const products =
    catalog.sections.flatMap(
      (section) =>
        section.products,
    );

  const exactProduct =
    products.find(
      (product) =>
        normalizeSlug(
          product.slug,
        ) ===
        LAUNDRY_PRODUCT_SLUG,
    );

  if (exactProduct) {
    return exactProduct;
  }

  const matchingProduct =
    products.find(
      (product) => {
        const productSlug =
          normalizeSlug(
            product.slug,
          );

        return (
          productSlug.includes(
            'wash',
          ) &&
          productSlug.includes(
            'iron',
          )
        );
      },
    );

  return (
    matchingProduct ??
    products[0] ??
    null
  );
}

export default function LaundryScreen() {
  const router =
    useRouter();

  const savedServiceAreaId =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaId,
    );

  const [
    category,
    setCategory,
  ] =
    useState<BootstrapCategory | null>(
      null,
    );

  const [
    stores,
    setStores,
  ] =
    useState<StoreSummary[]>(
      [],
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    isOpeningAction,
    setIsOpeningAction,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null,
    );

  const close =
    useCallback(() => {
      if (
        router.canGoBack()
      ) {
        router.back();

        return;
      }

      router.replace('/');
    }, [router]);

  const loadLaundryData =
    useCallback(
      async () => {
        try {
          setIsLoading(
            true,
          );

          setErrorMessage(
            null,
          );

          const [
            bootstrap,
            loadedStores,
          ] =
            await Promise.all([
              getAppBootstrap(),

              listStores({
                categorySlug:
                  LAUNDRY_CATEGORY_SLUG as StoreCategorySlug,

                serviceAreaId:
                  savedServiceAreaId ??
                  undefined,
              }),
            ]);

          const bootstrapCategories =
            bootstrap
              .store_categories as
              BootstrapCategory[];

          const loadedCategory =
            bootstrapCategories.find(
              (item) =>
                LAUNDRY_CATEGORY_ALIASES.has(
                  normalizeSlug(
                    item.slug,
                  ),
                ),
            ) ?? null;

          setCategory(
            loadedCategory ?? {
              id:
                'laundry',

              slug:
                LAUNDRY_CATEGORY_SLUG,

              name_ar:
                'الغسيل والكي',

              name_en:
                'Laundry & Ironing',

              icon:
                '🧺',

              image_url:
                null,

              is_active:
                true,

              sort_order:
                0,

              subtitle_ar:
                'خدمة غسيل وكي سهلة وسريعة لملابسك.',
            } as BootstrapCategory,
          );

          setStores(
            loadedStores,
          );
        } catch (error) {
          setStores(
            [],
          );

          setCategory(
            null,
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'تعذر تحميل خدمة الغسيل والكي.',
          );
        } finally {
          setIsLoading(
            false,
          );
        }
      },
      [
        savedServiceAreaId,
      ],
    );

  useEffect(() => {
    void loadLaundryData();
  }, [loadLaundryData]);

  /*
   * ============================================================
   * LAUNDRY CAMPAIGN
   * ============================================================
   *
   * الصور المعروضة في واجهة الحملة أصبحت Local Assets فقط.
   *
   * لم نعد نستخدم:
   *
   * category.image_url
   * store.coverImageUrl
   * store.logoUrl
   *
   * ترتيب الصور:
   *
   * 1. Hero
   * 2. Detail 01
   * 3. Detail 02
   * 4. Detail 03
   * ============================================================
   */

  const laundryBanner =
    useMemo<
      HomeBanner | null
    >(() => {
      if (!category) {
        return null;
      }

      const additionalImages:
        HomeBannerImage[] = [
          {
            id:
              'laundry-detail-01',

            imageUrl:
              LAUNDRY_DETAIL_IMAGE_01,

            altTextAr:
              'خدمة الغسيل والكي',

            sortOrder:
              0,
          },

          {
            id:
              'laundry-detail-02',

            imageUrl:
              LAUNDRY_DETAIL_IMAGE_02,

            altTextAr:
              'غسيل ملابس الأسبوع',

            sortOrder:
              1,
          },

          {
            id:
              'laundry-detail-03',

            imageUrl:
              LAUNDRY_DETAIL_IMAGE_03,

            altTextAr:
              'كي وتجهيز الملابس',

            sortOrder:
              2,
          },
        ];

      return {
        id:
          'laundry',

        imageUrl:
          LAUNDRY_HERO_IMAGE,

        altTextAr:
          category.name_ar ||
          'الغسيل والكي',

        altTextEn:
          category.name_en ||
          'Laundry & Ironing',

        linkUrl:
          null,

        sortOrder:
          0,

        placement:
          'main',

        presentationType:
          'detail_screen',

        actionType:
          'none',

        actionPayload:
          {},

        templateKey:
          'premium_promo_v1',

        content:
          {},

        theme:
          {},

        serviceAreaIds:
          [],

        servicePackageId:
          null,

        additionalImages,
      };
    }, [category]);

  /*
   * عند الضغط على "احجز دلوقتي":
   *
   * 1. نحدد متجر المغسلة الحقيقي من Supabase.
   * 2. نحمل الكتالوج الحقيقي للمتجر.
   * 3. نحدد منتج wash-and-iron الحقيقي.
   * 4. نضيفه إلى Cart مرة واحدة فقط.
   * 5. نجعل Cart المغسلة هو الـActive Cart.
   * 6. نفتح صفحة Cart مباشرة.
   *
   * التسجيل النهائي للطلب في قاعدة البيانات
   * يتم من Checkout عند الضغط على "متابعة".
   */

  const openBooking =
    useCallback(
      async () => {
        if (
          isOpeningAction
        ) {
          return;
        }

        try {
          setIsOpeningAction(
            true,
          );

          setErrorMessage(
            null,
          );

          const laundryStore =
            stores[0] ??
            null;

          if (
            !laundryStore
          ) {
            throw new Error(
              'خدمة الغسيل والكي غير متاحة في منطقتك حاليًا.',
            );
          }

          const catalog =
            await getStoreCatalog(
              laundryStore.id,

              savedServiceAreaId ??
                undefined,
            );

          if (
            normalizeSlug(
              catalog.store
                .categorySlug,
            ) !==
            LAUNDRY_CATEGORY_SLUG
          ) {
            throw new Error(
              'بيانات متجر الغسيل والكي غير صحيحة.',
            );
          }

          if (
            catalog.store
              .isManuallyClosed
          ) {
            throw new Error(
              catalog.store
                .manualClosedNote ||
                'خدمة الغسيل والكي مغلقة حاليًا.',
            );
          }

          const laundryProduct =
            findLaundryProduct(
              catalog,
            );

          if (
            !laundryProduct
          ) {
            throw new Error(
              'تعذر العثور على خدمة غسيل وكي في الكتالوج.',
            );
          }

          const cartState =
            useCartStore
              .getState();

          const existingCart =
            cartState.carts[
              catalog.store.id
            ] ??
            null;

          const productAlreadyInCart =
            existingCart
              ?.items
              .some(
                (item) =>
                  item.id ===
                    laundryProduct.id &&
                  item.variantId ===
                    null,
              ) ??
            false;

          if (
            !productAlreadyInCart
          ) {
            const addResult =
              cartState.addItem(
                {
                  id:
                    catalog.store.id,

                  name:
                    catalog.store.name,

                  icon:
                    catalog.store
                      .icon ||
                    '🧺',

                  categorySlug:
                    catalog.store
                      .categorySlug,

                  deliveryFee:
                    catalog.delivery
                      .deliveryFee,

                  minimumOrder:
                    catalog.delivery
                      .minimumOrder,
                },

                {
                  id:
                    laundryProduct.id,

                  name:
                    laundryProduct
                      .name,

                  description:
                    laundryProduct
                      .description,

                  price:
                    laundryProduct
                      .price,

                  icon:
                    laundryProduct
                      .icon ||
                    '🧺',

                  variantId:
                    null,

                  variantName:
                    null,

                  isAgeRestricted:
                    laundryProduct
                      .isAgeRestricted,
                },
              );

            if (
              addResult ===
              'unsupported-category'
            ) {
              throw new Error(
                'قسم الغسيل والكي غير متاح للطلب حاليًا.',
              );
            }

            if (
              addResult ===
              'different-restaurant'
            ) {
              throw new Error(
                'تعذر إضافة خدمة الغسيل والكي إلى السلة.',
              );
            }
          }

          useCartStore
            .getState()
            .setActiveCart(
              catalog.store.id,
            );

          router.push({
            pathname:
              '/cart',

            params: {
              storeId:
                catalog.store.id,
            },
          });
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'تعذر إضافة خدمة الغسيل والكي إلى السلة.',
          );
        } finally {
          setIsOpeningAction(
            false,
          );
        }
      },
      [
        isOpeningAction,
        router,
        savedServiceAreaId,
        stores,
      ],
    );

  if (isLoading) {
    return (
      <SafeAreaView
        style={
          styles.stateScreen
        }
      >
        <StatusBar
          style="dark"
        />

        <ActivityIndicator
          color={
            NAVIENTY_NOW_COLORS
              .primary
          }
          size="large"
        />

        <Text
          style={
            styles
              .stateDescription
          }
        >
          جاري تحميل الخدمة...
        </Text>
      </SafeAreaView>
    );
  }

  if (
    !laundryBanner
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

        <View
          style={
            styles.errorIcon
          }
        >
          <Ionicons
            color={
              NAVIENTY_NOW_COLORS
                .primary
            }
            name="shirt-outline"
            size={28}
          />
        </View>

        <Text
          style={
            styles.stateTitle
          }
        >
          الخدمة غير متاحة
        </Text>

        <Text
          style={
            styles
              .stateDescription
          }
        >
          {errorMessage ||
            'خدمة الغسيل والكي غير متاحة حاليًا.'}
        </Text>

        <Pressable
          accessibilityRole="button"
          style={({
            pressed,
          }) => [
            styles.stateButton,

            pressed &&
              styles
                .stateButtonPressed,
          ]}
          onPress={
            close
          }
        >
          <Text
            style={
              styles
                .stateButtonText
            }
          >
            العودة للرئيسية
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View
      style={
        styles.screen
      }
    >
      <PremiumPromoTemplate
        banner={
          laundryBanner
        }

        areaName={
          null
        }

        ctaEnabled={
          true
        }

        isOpeningAction={
          isOpeningAction
        }

        onClose={
          close
        }

        onPressCta={() => {
          void openBooking();
        }}
      />

      {errorMessage ? (
        <View
          pointerEvents="none"
          style={
            styles.inlineError
          }
        >
          <Text
            style={
              styles
                .inlineErrorText
            }
          >
            {errorMessage}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      backgroundColor:
        NAVIENTY_NOW_COLORS
          .page,

      flex:
        1,
    },

    stateScreen: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS
          .page,

      flex:
        1,

      justifyContent:
        'center',

      paddingHorizontal:
        NAVIENTY_NOW_LAYOUT
          .pageGutter +
        10,
    },

    errorIcon: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS
          .primaryPale,

      borderRadius:
        28,

      height:
        56,

      justifyContent:
        'center',

      marginBottom:
        18,

      width:
        56,
    },

    stateTitle: {
      color:
        NAVIENTY_NOW_COLORS
          .text,

      fontSize:
        24,

      fontWeight:
        '900',

      textAlign:
        'center',
    },

    stateDescription: {
      color:
        NAVIENTY_NOW_COLORS
          .textSecondary,

      fontSize:
        14,

      fontWeight:
        '600',

      lineHeight:
        23,

      marginTop:
        10,

      maxWidth:
        380,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    stateButton: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS
          .primary,

      borderRadius:
        17,

      justifyContent:
        'center',

      marginTop:
        22,

      minHeight:
        54,

      paddingHorizontal:
        26,
    },

    stateButtonPressed: {
      opacity:
        0.86,
    },

    stateButtonText: {
      color:
        NAVIENTY_NOW_COLORS
          .white,

      fontSize:
        15,

      fontWeight:
        '900',
    },

    inlineError: {
      alignSelf:
        'center',

      backgroundColor:
        '#FDECEC',

      borderRadius:
        999,

      bottom:
        112,

      maxWidth:
        420,

      paddingHorizontal:
        16,

      paddingVertical:
        10,

      position:
        'absolute',
    },

    inlineErrorText: {
      color:
        NAVIENTY_NOW_COLORS
          .error,

      fontSize:
        12,

      fontWeight:
        '800',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },
  });