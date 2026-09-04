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
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  getLegacyRequestAnythingCartConfiguration,
  type RequestAnythingCartConfiguration,
} from '../../domain/request-anything-cart-config';
import {
  getRequestAnythingCartConfiguration,
} from '../../services/request-anything-cart-config-service';
import {
  findStorefrontCategoryTile,
  getStorefrontTileScreenImages,
  listStorefrontCategoryTiles,
} from '../../services/storefront-category-service';

import getAppBootstrap, {
  type AppBootstrap,
} from '../../services/bootstrap-service';
import {
  type HomeBanner,
  type HomeBannerImage,
} from '../../services/home-banners-service';
import {
  useCartStore,
} from '../../store/cart-store';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../../theme/navienty-now-theme';

type BootstrapCategory =
  AppBootstrap['store_categories'][number] & {
    subtitle_ar?: string | null;
  };

const REQUEST_ANYTHING_CATEGORY_SLUG =
  'request-anything';

const REQUEST_ANYTHING_CATEGORY_ALIASES =
  new Set([
    'request-anything',
    'anything',
    'other',
    'special-request',
  ]);

const REQUEST_MAX_LENGTH =
  500;

function buildRequestAnythingCartDescription(
  requestText: string,
  pickupAddress: string,
) {
  return JSON.stringify({
    kind:
      'request-anything',

    requestText,

    pickupAddress,
  });
}

/*
 * ============================================================
 * REQUEST ANYTHING CAMPAIGN ARTWORK
 * ============================================================
 *
 * The interaction is intentionally distributed across
 * all three campaign images:
 *
 * 1. HERO
 *    "عاوز إيه؟"
 *
 * 2. DETAIL 02
 *    "نجيبه منين؟"
 *
 * 3. DETAIL 03
 *    Live premium order review
 *
 * Recommended assets:
 *
 * Hero:
 * 1112 × 1280 px
 *
 * Detail 02:
 * 1125 × 792 px
 *
 * Detail 03:
 * 1125 × 792 px
 *
 * Suggested assets:
 *
 * src/assets/images/request-anything/
 *   request-anything-hero.webp
 *   request-anything-detail-02.webp
 *   request-anything-detail-03.webp
 * ============================================================
 */

const REQUEST_ANYTHING_HERO_IMAGE =
  Image.resolveAssetSource(
    require(
      '../../assets/images/request-anything/request-anything-hero.webp',
    ),
  ).uri;

const REQUEST_ANYTHING_DETAIL_IMAGE_02 =
  Image.resolveAssetSource(
    require(
      '../../assets/images/request-anything/request-anything-detail-02.webp',
    ),
  ).uri;

const REQUEST_ANYTHING_DETAIL_IMAGE_03 =
  Image.resolveAssetSource(
    require(
      '../../assets/images/request-anything/request-anything-detail-03.webp',
    ),
  ).uri;

const HERO_ASPECT_RATIO =
  1112 / 1280;

const GALLERY_ASPECT_RATIO =
  1125 / 792;

const IMAGE_GAP =
  14;

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

export default function RequestAnythingScreen() {
  const router =
    useRouter();

  const insets =
    useSafeAreaInsets();

  const {
    width:
      viewportWidth,
  } =
    useWindowDimensions();

  const [
    category,
    setCategory,
  ] =
    useState<BootstrapCategory | null>(
      null,
    );

  const [
    cartConfiguration,
    setCartConfiguration,
  ] =
    useState<RequestAnythingCartConfiguration>(
      getLegacyRequestAnythingCartConfiguration,
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    requestText,
    setRequestText,
  ] =
    useState('');

  const [
    pickupAddress,
    setPickupAddress,
  ] =
    useState('');

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(
      null,
    );

  const [
    campaignImageOverrides,
    setCampaignImageOverrides,
  ] =
    useState<Record<string, string>>(
      {},
    );

  const addItem =
    useCartStore(
      (state) =>
        state.addItem,
    );

  const clearStoreCart =
    useCartStore(
      (state) =>
        state.clearStoreCart,
    );

  const contentWidth =
    Math.min(
      NAVIENTY_NOW_LAYOUT
        .contentMaxWidth,
      viewportWidth,
    );

  const bottomBarPadding =
    14 +
    Math.max(
      insets.bottom,
      8,
    );

  const close =
    useCallback(() => {
      Keyboard.dismiss();

      if (
        router.canGoBack()
      ) {
        router.back();

        return;
      }

      router.replace('/');
    }, [router]);

  const loadRequestAnythingData =
    useCallback(
      async () => {
        try {
          setIsLoading(
            true,
          );

          setErrorMessage(
            null,
          );

          const bootstrap =
            await getAppBootstrap();

          const cartConfigurationPromise =
            getRequestAnythingCartConfiguration(
              bootstrap.settings
                .default_service_area_id,
            );

          let remoteScreenImages:
            Record<string, string> =
            {};

          try {
            const remoteTiles =
              await listStorefrontCategoryTiles(
                'home',
              );

            const remoteTile =
              findStorefrontCategoryTile(
                remoteTiles,
                [
                  'request-anything',
                ],
              );

            remoteScreenImages =
              getStorefrontTileScreenImages(
                remoteTile,
              );
          } catch {
            /*
             * Remote artwork is optional.
             * Bundled images remain the fallback.
             */
          }

          setCartConfiguration(
            await cartConfigurationPromise,
          );

          setCampaignImageOverrides(
            remoteScreenImages,
          );

          const bootstrapCategories =
            bootstrap
              .store_categories as
              BootstrapCategory[];

          const loadedCategory =
            bootstrapCategories.find(
              (item) =>
                REQUEST_ANYTHING_CATEGORY_ALIASES.has(
                  normalizeSlug(
                    item.slug,
                  ),
                ),
            ) ?? null;

          setCategory(
            loadedCategory ?? {
              id:
                'request-anything',

              slug:
                REQUEST_ANYTHING_CATEGORY_SLUG,

              name_ar:
                'اطلب أي حاجة',

              name_en:
                'Request Anything',

              icon:
                '🛍️',

              image_url:
                null,

              is_active:
                true,

              sort_order:
                0,

              subtitle_ar:
                'قولنا محتاج إيه ومنين وسيب الباقي علينا.',
            } as BootstrapCategory,
          );
        } catch (error) {
          setCategory(
            null,
          );

          setCampaignImageOverrides(
            {},
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'تعذر تحميل خدمة اطلب أي حاجة.',
          );
        } finally {
          setIsLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(() => {
    void loadRequestAnythingData();
  }, [loadRequestAnythingData]);

  const requestAnythingBanner =
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
              'request-anything-detail-02',

            imageUrl:
              campaignImageOverrides[
                'detail_02'
              ] ??
              campaignImageOverrides[
                'detail02'
              ] ??
              REQUEST_ANYTHING_DETAIL_IMAGE_02,

            altTextAr:
              'حدد المكان اللي هنجيب منه طلبك',

            sortOrder:
              0,
          },

          {
            id:
              'request-anything-detail-03',

            imageUrl:
              campaignImageOverrides[
                'detail_03'
              ] ??
              campaignImageOverrides[
                'detail03'
              ] ??
              REQUEST_ANYTHING_DETAIL_IMAGE_03,

            altTextAr:
              'راجع طلبك قبل المتابعة',

            sortOrder:
              1,
          },
        ];

      return {
        id:
          'request-anything',

        imageUrl:
          campaignImageOverrides[
            'hero'
          ] ??
          REQUEST_ANYTHING_HERO_IMAGE,

        altTextAr:
          category.name_ar ||
          'اطلب أي حاجة',

        altTextEn:
          category.name_en ||
          'Request Anything',

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
    }, [
      campaignImageOverrides,
      category,
    ]);

  const trimmedRequest =
    requestText.trim();

  const trimmedPickupAddress =
    pickupAddress.trim();

  const canContinue =
    useMemo(
      () =>
        trimmedRequest.length >
          0 &&
        trimmedPickupAddress.length >
          0,
      [
        trimmedPickupAddress,
        trimmedRequest,
      ],
    );

  const handleRequestChange =
    useCallback(
      (value: string) => {
        setRequestText(
          value,
        );

        if (
          errorMessage
        ) {
          setErrorMessage(
            null,
          );
        }
      },
      [errorMessage],
    );

  const handlePickupAddressChange =
    useCallback(
      (value: string) => {
        setPickupAddress(
          value,
        );

        if (
          errorMessage
        ) {
          setErrorMessage(
            null,
          );
        }
      },
      [errorMessage],
    );

  const handleContinue =
    useCallback(() => {
      Keyboard.dismiss();

      if (
        !trimmedRequest
      ) {
        setErrorMessage(
          'اكتب لنا إيه اللي محتاجه.',
        );

        return;
      }

      if (
        !trimmedPickupAddress
      ) {
        setErrorMessage(
          'اكتب المكان اللي هنجيب منه الطلب.',
        );

        return;
      }

      setErrorMessage(
        null,
      );

      /*
       * Request Anything uses the exact same cart/order flow
       * as a normal store order.
       *
       * The Supabase migration creates a real internal store
       * and a real zero-price product. We keep one line only
       * and store the customer's free-form request inside the
       * local cart description so checkout can copy it into
       * now.orders.notes.
       */
      const legacyCartConfiguration =
        getLegacyRequestAnythingCartConfiguration();

      if (
        legacyCartConfiguration.storeId !==
        cartConfiguration.storeId
      ) {
        clearStoreCart(
          legacyCartConfiguration.storeId,
        );
      }

      clearStoreCart(
        cartConfiguration.storeId,
      );

      const addResult =
        addItem(
          {
            id:
              cartConfiguration.storeId,

            name:
              'اطلب أي حاجة',

            icon:
              '🛍️',

            categorySlug:
              REQUEST_ANYTHING_CATEGORY_SLUG,

            deliveryFee:
              cartConfiguration.deliveryFee,

            minimumOrder:
              0,
          },
          {
            id:
              cartConfiguration.productId,

            name:
              'اطلب أي حاجة',

            description:
              buildRequestAnythingCartDescription(
                trimmedRequest,
                trimmedPickupAddress,
              ),

            price:
              0,

            icon:
              '🛍️',

            variantId:
              null,

            variantName:
              null,

            isAgeRestricted:
              false,
          },
        );

      if (
        addResult !==
        'added'
      ) {
        setErrorMessage(
          'تعذر تجهيز الطلب في السلة. حاول مرة أخرى.',
        );

        return;
      }

      router.push({
        pathname:
          '/cart',

        params: {
          storeId:
            cartConfiguration.storeId,
        },
      });
    }, [
      addItem,
      cartConfiguration,
      clearStoreCart,
      router,
      trimmedPickupAddress,
      trimmedRequest,
    ]);

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
    !requestAnythingBanner
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
            name="bag-handle-outline"
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
            'خدمة اطلب أي حاجة غير متاحة حاليًا.'}
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

  const detailImage02 =
    requestAnythingBanner
      .additionalImages[0] ??
    null;

  const detailImage03 =
    requestAnythingBanner
      .additionalImages[1] ??
    null;

  return (
    <SafeAreaView
      edges={[
        'top',
      ]}
      style={
        styles.safeArea
      }
    >
      <StatusBar
        style="dark"
      />

      {/* ========================================================
          FIXED HEADER
      ======================================================== */}

      <View
        style={
          styles.header
        }
      >
        <View
          style={[
            styles.headerInner,

            {
              maxWidth:
                contentWidth,
            },
          ]}
        >
          <Text
            numberOfLines={1}
            style={
              styles.headerTitle
            }
          >
            Navienty Now
          </Text>

          <Pressable
            accessibilityLabel="إغلاق"
            accessibilityRole="button"
            hitSlop={10}
            style={({
              pressed,
            }) => [
              styles.closeButton,

              pressed &&
                styles.pressed,
            ]}
            onPress={
              close
            }
          >
            <Ionicons
              color={
                NAVIENTY_NOW_COLORS
                  .text
              }
              name="close"
              size={28}
            />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : undefined
        }
        keyboardVerticalOffset={
          0
        }
        style={
          styles.keyboardView
        }
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,

            {
              paddingBottom:
                106 +
                Math.max(
                  insets.bottom,
                  8,
                ),
            },
          ]}
          keyboardDismissMode={
            Platform.OS ===
            'ios'
              ? 'interactive'
              : 'on-drag'
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
          style={
            styles.scrollView
          }
        >
          <View
            style={[
              styles.page,

              {
                maxWidth:
                  contentWidth,
              },
            ]}
          >
            {/* ==================================================
                IMAGE 01 — HERO
                STEP 01: عاوز إيه؟
            ================================================== */}

            <View
              style={
                styles.heroFrame
              }
            >
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel={
                  requestAnythingBanner
                    .altTextAr ||
                  requestAnythingBanner
                    .altTextEn ||
                  'Navienty Now'
                }
                resizeMode="cover"
                source={{
                  uri:
                    requestAnythingBanner
                      .imageUrl,
                }}
                style={
                  styles.fullImage
                }
              />

              <View
                style={
                  styles.heroContent
                }
              >
                <View
                  style={
                    styles.heroIntro
                  }
                >
                  <View
                    style={
                      styles.heroIntroCopy
                    }
                  >
                  </View>
                </View>

                <View
                  style={
                    styles
                      .heroInputGlass
                  }
                >
                  <TextInput
                    maxLength={
                      REQUEST_MAX_LENGTH
                    }
                    multiline
                    placeholder={
                      'مثال: عاوز شاحن iPhone أصلي Type-C...'
                    }
                    placeholderTextColor={
                      '#8E9691'
                    }
                    scrollEnabled
                    selectionColor={
                      NAVIENTY_NOW_COLORS
                        .primary
                    }
                    style={
                      styles.heroRequestInput
                    }
                    textAlignVertical="top"
                    value={
                      requestText
                    }
                    onChangeText={
                      handleRequestChange
                    }
                  />

                  <View
                    style={
                      styles
                        .heroCounterPill
                    }
                  >
                    <Text
                      style={
                        styles
                          .heroCounterText
                      }
                    >
                      {
                        requestText.length
                      }
                      /
                      {
                        REQUEST_MAX_LENGTH
                      }
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ==================================================
                IMAGE 02 — DETAIL 02
                STEP 02: نجيبه منين؟
            ================================================== */}

            {detailImage02 ? (
              <View
                style={
                  styles
                    .detailInteractiveFrame
                }
              >
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={
                    detailImage02
                      .altTextAr ||
                    undefined
                  }
                  resizeMode="cover"
                  source={{
                    uri:
                      detailImage02
                        .imageUrl,
                  }}
                  style={
                    styles.fullImage
                  }
                />

                <View
                  style={
                    styles
                      .locationComposition
                  }
                >
                  <View
                    style={
                      styles
                        .locationIntro
                    }
                  >
                    <View
                      style={
                        styles
                          .locationIntroCopy
                      }
                    >
                    </View>
                  </View>

                  <View
                    style={
                      styles
                        .locationGlass
                    }
                  >
                    <TextInput
                      multiline
                      placeholder={
                        'اسم المكان أو العنوان'
                      }
                      placeholderTextColor={
                        '#8E9691'
                      }
                      selectionColor={
                        NAVIENTY_NOW_COLORS
                          .primary
                      }
                      style={
                        styles
                          .locationInput
                      }
                      textAlignVertical="center"
                      value={
                        pickupAddress
                      }
                      onChangeText={
                        handlePickupAddressChange
                      }
                    />
                  </View>

                </View>
              </View>
            ) : null}

            {/* ==================================================
                IMAGE 03 — DETAIL 03
                STEP 03: LIVE REVIEW
            ================================================== */}

            {detailImage03 ? (
              <View
                style={
                  styles
                    .reviewFrame
                }
              >
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={
                    detailImage03
                      .altTextAr ||
                    undefined
                  }
                  resizeMode="cover"
                  source={{
                    uri:
                      detailImage03
                        .imageUrl,
                  }}
                  style={
                    styles.fullImage
                  }
                />

                <View
                  style={
                    styles
                      .reviewComposition
                  }
                >
                  <View
                    style={
                      styles
                        .reviewHeader
                    }
                  >
                  </View>

                  {errorMessage ? (
                    <View
                      style={
                        styles
                          .reviewError
                      }
                    >
                      <Ionicons
                        color={
                          NAVIENTY_NOW_COLORS
                            .error
                        }
                        name="alert-circle-outline"
                        size={17}
                      />

                      <Text
                        style={
                          styles
                            .reviewErrorText
                        }
                      >
                        {errorMessage}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>

        {/* ========================================================
            FIXED CTA
        ======================================================== */}

        <View
          style={[
            styles.bottomBar,

            {
              paddingBottom:
                bottomBarPadding,
            },
          ]}
        >
          <View
            style={[
              styles.bottomBarInner,

              {
                maxWidth:
                  contentWidth,
              },
            ]}
          >
            <Pressable
              accessibilityLabel="متابعة"
              accessibilityRole="button"
              disabled={
                !canContinue
              }
              style={({
                pressed,
              }) => [
                styles.ctaButton,

                pressed &&
                  canContinue &&
                  styles
                    .ctaButtonPressed,

                !canContinue &&
                  styles
                    .ctaButtonDisabled,
              ]}
              onPress={
                handleContinue
              }
            >
              <Text
                style={
                  styles.ctaButtonText
                }
              >
                متابعة
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    /*
     * ============================================================
     * LOADING / ERROR
     * ============================================================
     */

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

    /*
     * ============================================================
     * MAIN SCREEN
     * ============================================================
     */

    safeArea: {
      backgroundColor:
        NAVIENTY_NOW_COLORS
          .page,

      flex:
        1,
    },

    keyboardView: {
      flex:
        1,
    },

    /*
     * ============================================================
     * HEADER
     * ============================================================
     */

    header: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS
          .page,

      borderBottomColor:
        NAVIENTY_NOW_COLORS
          .border,

      borderBottomWidth:
        StyleSheet
          .hairlineWidth,

      zIndex:
        20,
    },

    headerInner: {
      alignItems:
        'center',

      height:
        64,

      justifyContent:
        'center',

      paddingHorizontal:
        NAVIENTY_NOW_LAYOUT
          .pageGutter,

      position:
        'relative',

      width:
        '100%',
    },

    headerTitle: {
      color:
        NAVIENTY_NOW_COLORS
          .primary,

      fontSize:
        22,

      fontWeight:
        '900',

      letterSpacing:
        -0.6,

      textAlign:
        'center',
    },

    closeButton: {
      alignItems:
        'center',

      height:
        48,

      justifyContent:
        'center',

      position:
        'absolute',

      right:
        NAVIENTY_NOW_LAYOUT
          .pageGutter,

      width:
        48,
    },

    pressed: {
      opacity:
        0.65,
    },

    /*
     * ============================================================
     * SCROLL
     * ============================================================
     */

    scrollView: {
      backgroundColor:
        NAVIENTY_NOW_COLORS
          .page,

      flex:
        1,
    },

    scrollContent: {
      alignItems:
        'center',
    },

    page: {
      paddingHorizontal:
        NAVIENTY_NOW_LAYOUT
          .pageGutter,

      paddingTop:
        16,

      width:
        '100%',
    },

    fullImage: {
      height:
        '100%',

      width:
        '100%',
    },

    /*
     * ============================================================
     * IMAGE 01 — HERO / REQUEST
     * ============================================================
     */

    heroFrame: {
      aspectRatio:
        HERO_ASPECT_RATIO,

      backgroundColor:
        NAVIENTY_NOW_COLORS
          .surface,

      borderRadius:
        26,

      overflow:
        'hidden',

      position:
        'relative',

      width:
        '100%',
    },

    heroContent: {
      bottom:
        0,

      justifyContent:
        'center',

      left:
        0,

      paddingHorizontal:
        16,

      position:
        'absolute',

      right:
        0,

      top:
        0,
    },

    heroIntro: {
      alignItems:
        'center',

      flexDirection:
        'row-reverse',
    },

    heroIntroCopy: {
      flex:
        1,
    },

    heroTopCopy: {
      alignItems:
        'flex-end',
    },

    stepBadgeLight: {
      alignItems:
        'center',

      backgroundColor:
        'rgba(255, 255, 255, 0.15)',

      borderColor:
        'rgba(255, 255, 255, 0.30)',

      borderRadius:
        999,

      borderWidth:
        1,

      height:
        32,

      justifyContent:
        'center',

      width:
        45,
    },

    stepBadgeLightText: {
      color:
        NAVIENTY_NOW_COLORS
          .white,

      fontSize:
        11,

      fontWeight:
        '900',
    },

    heroEyebrow: {
      color:
        'rgba(255, 255, 255, 0.78)',

      fontSize:
        12,

      fontWeight:
        '800',

      marginTop:
        18,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    heroHeadline: {
      color:
        NAVIENTY_NOW_COLORS
          .white,

      fontSize:
        34,

      fontWeight:
        '900',

      letterSpacing:
        -0.6,

      lineHeight:
        41,

      marginTop:
        3,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    heroDescription: {
      color:
        'rgba(255, 255, 255, 0.82)',

      fontSize:
        12.5,

      fontWeight:
        '600',

      lineHeight:
        20,

      marginTop:
        8,

      maxWidth:
        245,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    heroInputGlass: {
      backgroundColor:
        'rgba(255, 255, 255, 0.94)',

      borderColor:
        'rgba(255, 255, 255, 0.72)',

      borderRadius:
        18,

      borderWidth:
        1,

      marginTop:
        12,

      minHeight:
        150,

      overflow:
        'hidden',

      paddingBottom:
        28,

      paddingHorizontal:
        11,

      paddingTop:
        10,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          8,
      },

      shadowOpacity:
        0.12,

      shadowRadius:
        20,

      elevation:
        6,
    },

    heroRequestInput: {
      color:
        NAVIENTY_NOW_COLORS
          .text,

      fontSize:
        13.5,

      fontWeight:
        '700',

      lineHeight:
        20,

      minHeight:
        112,

      paddingHorizontal:
        2,

      paddingTop:
        8,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    heroCounterPill: {
      alignItems:
        'center',

      backgroundColor:
        '#F4F7F5',

      borderRadius:
        999,

      bottom:
        9,

      left:
        12,

      minHeight:
        20,

      paddingHorizontal:
        7,

      position:
        'absolute',
    },

    heroCounterText: {
      color:
        '#8C9690',

      fontSize:
        9.5,

      fontWeight:
        '800',
    },

    /*
     * ============================================================
     * IMAGE 02 — LOCATION
     * ============================================================
     */

    detailInteractiveFrame: {
      aspectRatio:
        GALLERY_ASPECT_RATIO,

      backgroundColor:
        NAVIENTY_NOW_COLORS
          .surface,

      borderRadius:
        22,

      marginTop:
        IMAGE_GAP,

      overflow:
        'hidden',

      position:
        'relative',

      width:
        '100%',
    },

    locationComposition: {
      bottom:
        0,

      justifyContent:
        'center',

      left:
        0,

      paddingHorizontal:
        16,

      position:
        'absolute',

      right:
        0,

      top:
        0,
    },

    locationIntro: {
      alignItems:
        'center',

      flexDirection:
        'row-reverse',
    },

    stepBadgeDark: {
      alignItems:
        'center',

      backgroundColor:
        'rgba(255, 255, 255, 0.94)',

      borderRadius:
        999,

      height:
        32,

      justifyContent:
        'center',

      width:
        44,
    },

    stepBadgeDarkText: {
      color:
        NAVIENTY_NOW_COLORS
          .primary,

      fontSize:
        11,

      fontWeight:
        '900',
    },

    locationIntroCopy: {
      flex:
        1,

      marginRight:
        10,
    },

    locationEyebrow: {
      color:
        'rgba(255, 255, 255, 0.72)',

      fontSize:
        10.5,

      fontWeight:
        '800',

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    locationGlass: {
      alignItems:
        'center',

      backgroundColor:
        'rgba(255, 255, 255, 0.94)',

      borderColor:
        'rgba(255, 255, 255, 0.72)',

      borderRadius:
        18,

      borderWidth:
        1,

      flexDirection:
        'row-reverse',

      marginTop:
        12,

      minHeight:
        68,

      paddingHorizontal:
        11,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          8,
      },

      shadowOpacity:
        0.12,

      shadowRadius:
        20,

      elevation:
        6,
    },

    locationPin: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS
          .primaryPale,

      borderRadius:
        12,

      height:
        38,

      justifyContent:
        'center',

      width:
        38,
    },

    locationInput: {
      color:
        NAVIENTY_NOW_COLORS
          .text,

      flex:
        1,

      fontSize:
        13.5,

      fontWeight:
        '700',

      lineHeight:
        20,

      marginRight:
        9,

      maxHeight:
        94,

      minHeight:
        52,

      paddingVertical:
        8,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    locationHintPill: {
      alignItems:
        'center',

      alignSelf:
        'flex-end',

      backgroundColor:
        'rgba(255, 255, 255, 0.88)',

      borderRadius:
        999,

      flexDirection:
        'row-reverse',

      marginTop:
        9,

      paddingHorizontal:
        10,

      paddingVertical:
        6,
    },

    locationHintText: {
      color:
        NAVIENTY_NOW_COLORS
          .text,

      fontSize:
        9.8,

      fontWeight:
        '700',

      marginRight:
        5,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    /*
     * ============================================================
     * IMAGE 03 — REVIEW
     * ============================================================
     */

    reviewFrame: {
      aspectRatio:
        GALLERY_ASPECT_RATIO,

      backgroundColor:
        NAVIENTY_NOW_COLORS
          .surface,

      borderRadius:
        22,

      marginTop:
        IMAGE_GAP,

      overflow:
        'hidden',

      position:
        'relative',

      width:
        '100%',
    },

    reviewComposition: {
      bottom:
        0,

      justifyContent:
        'center',

      left:
        0,

      paddingHorizontal:
        15,

      position:
        'absolute',

      right:
        0,

      top:
        0,
    },

    reviewHeader: {
      alignItems:
        'center',

      flexDirection:
        'row-reverse',
    },

    reviewHeaderCopy: {
      flex:
        1,

      marginRight:
        10,
    },

    reviewEyebrow: {
      color:
        'rgba(255, 255, 255, 0.72)',

      fontSize:
        10.5,

      fontWeight:
        '800',

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    reviewTitle: {
      color:
        NAVIENTY_NOW_COLORS
          .white,

      fontSize:
        22,

      fontWeight:
        '900',

      marginTop:
        1,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    reviewGlassCard: {
      backgroundColor:
        'rgba(255, 255, 255, 0.94)',

      borderColor:
        'rgba(255, 255, 255, 0.72)',

      borderRadius:
        18,

      borderWidth:
        1,

      marginTop:
        11,

      paddingHorizontal:
        12,

      paddingVertical:
        10,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          8,
      },

      shadowOpacity:
        0.12,

      shadowRadius:
        20,

      elevation:
        6,
    },

    reviewRow: {
      alignItems:
        'center',

      flexDirection:
        'row-reverse',
    },

    reviewRowIcon: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS
          .primaryPale,

      borderRadius:
        10,

      height:
        32,

      justifyContent:
        'center',

      width:
        32,
    },

    reviewRowCopy: {
      flex:
        1,

      marginRight:
        9,
    },

    reviewRowLabel: {
      color:
        NAVIENTY_NOW_COLORS
          .primary,

      fontSize:
        9.5,

      fontWeight:
        '900',

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    reviewRowValue: {
      color:
        NAVIENTY_NOW_COLORS
          .text,

      fontSize:
        11.5,

      fontWeight:
        '800',

      lineHeight:
        17,

      marginTop:
        1,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    reviewRowPlaceholder: {
      color:
        '#8E9691',

      fontWeight:
        '600',
    },

    reviewDivider: {
      backgroundColor:
        'rgba(18, 42, 28, 0.08)',

      height:
        StyleSheet
          .hairlineWidth,

      marginVertical:
        8,
    },

    reviewTrustPill: {
      alignItems:
        'center',

      alignSelf:
        'flex-end',

      backgroundColor:
        'rgba(255, 255, 255, 0.90)',

      borderRadius:
        999,

      flexDirection:
        'row-reverse',

      marginTop:
        9,

      paddingHorizontal:
        9,

      paddingVertical:
        6,
    },

    reviewTrustIcon: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS
          .primaryPale,

      borderRadius:
        999,

      height:
        24,

      justifyContent:
        'center',

      width:
        24,
    },

    reviewTrustText: {
      color:
        NAVIENTY_NOW_COLORS
          .text,

      fontSize:
        9.5,

      fontWeight:
        '700',

      lineHeight:
        14,

      marginRight:
        6,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    reviewError: {
      alignItems:
        'center',

      backgroundColor:
        'rgba(253, 236, 236, 0.96)',

      borderRadius:
        12,

      flexDirection:
        'row-reverse',

      marginTop:
        8,

      paddingHorizontal:
        9,

      paddingVertical:
        7,
    },

    reviewErrorText: {
      color:
        NAVIENTY_NOW_COLORS
          .error,

      flex:
        1,

      fontSize:
        10,

      fontWeight:
        '800',

      lineHeight:
        15,

      marginRight:
        6,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    /*
     * ============================================================
     * FIXED CTA
     * ============================================================
     */

    bottomBar: {
      backgroundColor:
        NAVIENTY_NOW_COLORS
          .page,

      borderTopColor:
        NAVIENTY_NOW_COLORS
          .border,

      borderTopWidth:
        StyleSheet
          .hairlineWidth,

      bottom:
        0,

      left:
        0,

      paddingHorizontal:
        NAVIENTY_NOW_LAYOUT
          .pageGutter,

      paddingTop:
        12,

      position:
        'absolute',

      right:
        0,

      shadowColor:
        '#000000',

      shadowOffset: {
        height:
          -5,

        width:
          0,
      },

      shadowOpacity:
        0.06,

      shadowRadius:
        14,

      elevation:
        14,
    },

    bottomBarInner: {
      alignSelf:
        'center',

      width:
        '100%',
    },

    ctaButton: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS
          .primary,

      borderRadius:
        18,

      justifyContent:
        'center',

      minHeight:
        58,

      paddingHorizontal:
        20,
    },

    ctaButtonPressed: {
      opacity:
        0.88,

      transform: [
        {
          scale:
            0.994,
        },
      ],
    },

    ctaButtonDisabled: {
      opacity:
        0.45,
    },

    ctaButtonText: {
      color:
        NAVIENTY_NOW_COLORS
          .white,

      fontSize:
        17,

      fontWeight:
        '900',

      textAlign:
        'center',
    },
  });
