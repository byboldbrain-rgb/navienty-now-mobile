import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Animated,
    FlatList,
    Image,
    type ImageSourcePropType,
    PanResponder,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    getCategoryIcon,
} from '../config/category-icons';
import {
    publicSupabase,
} from '../lib/supabase';
import {
    useCartStore,
} from '../store/cart-store';

const PERSONAL_CARE_CART_IMAGE = require(
  '../assets/icons/categories/personal-care.webp',
);

const LAUNDRY_CART_IMAGE = require(
  '../assets/icons/categories/laundry.webp',
);

const REQUEST_ANYTHING_CART_IMAGE = require(
  '../assets/icons/categories/request-anything.webp',
);

const CART_PICKER_CLOSE_DISTANCE = 95;
const CART_PICKER_CLOSE_VELOCITY = 0.75;
const CART_PICKER_OFFSCREEN_Y = 900;
const STORE_ARTWORK_MAX_CONCURRENCY = 3;

type CartStoreArtwork = {
  logoUrl: string;
  coverImageUrl: string;
  categorySlug: string;
};

type RawCartStoreCatalog = {
  store?: {
    id?: string | null;
    category_slug?: string | null;
    logo_url?: string | null;
    cover_image_url?: string | null;
  } | null;
};

/*
 * Keep resolved artwork for the lifetime of the JavaScript session.
 * Reopening the multi-cart picker should not need to resolve the same
 * store artwork from Supabase again.
 */
const storeArtworkSessionCache = new Map<
  string,
  CartStoreArtwork
>();

/*
 * If the picker is mounted again while a store request is still running,
 * reuse the same promise instead of creating a duplicate RPC.
 */
const storeArtworkInFlight = new Map<
  string,
  Promise<CartStoreArtwork>
>();

function normalizeCategorySlug(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

function isImageUri(
  value: string | null | undefined,
) {
  if (!value) {
    return false;
  }

  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file://') ||
    value.startsWith('data:image/')
  );
}

function getImmediateCartArtwork(
  cart: {
    storeId: string;
    storeIcon?: string | null;
    categorySlug?: string | null;
  },
): CartStoreArtwork | null {
  const cachedArtwork =
    storeArtworkSessionCache.get(
      cart.storeId,
    );

  if (cachedArtwork) {
    return cachedArtwork;
  }

  /*
   * The cart already persists storeIcon. When that value is a real image
   * URL there is no reason to wait for get_store_catalog before showing
   * something useful to the customer.
   */
  if (isImageUri(cart.storeIcon)) {
    const immediateArtwork = {
      logoUrl:
        cart.storeIcon?.trim() ?? '',
      coverImageUrl: '',
      categorySlug:
        normalizeCategorySlug(
          cart.categorySlug,
        ),
    };

    /*
     * This is a display seed only. Keep the catalog request eligible so a
     * newer logo/cover from Supabase can replace it in the background.
     */
    return immediateArtwork;
  }

  return null;
}

async function resolveCartStoreArtwork(
  cart: {
    storeId: string;
    storeIcon?: string | null;
    categorySlug?: string | null;
  },
): Promise<CartStoreArtwork> {
  const immediateArtwork =
    getImmediateCartArtwork(cart);

  if (immediateArtwork) {
    return immediateArtwork;
  }

  const existingRequest =
    storeArtworkInFlight.get(
      cart.storeId,
    );

  if (existingRequest) {
    return existingRequest;
  }

  const fallbackCategorySlug =
    normalizeCategorySlug(
      cart.categorySlug,
    );

  const request = (async () => {
    try {
      const { data, error } =
        await publicSupabase.rpc(
          'get_store_catalog',
          {
            p_store_id:
              cart.storeId,
          },
        );

      if (error) {
        throw error;
      }

      const rawCatalog =
        data as
          | RawCartStoreCatalog
          | null;

      const rawStore =
        rawCatalog?.store;

      const artwork: CartStoreArtwork = {
        logoUrl:
          rawStore?.logo_url?.trim() ??
          '',
        coverImageUrl:
          rawStore?.cover_image_url?.trim() ??
          '',
        categorySlug:
          rawStore?.category_slug?.trim() ??
          fallbackCategorySlug,
      };

      /*
       * Successful resolutions are kept for the entire app session,
       * including stores whose only useful fallback is their category.
       */
      storeArtworkSessionCache.set(
        cart.storeId,
        artwork,
      );

      return artwork;
    } catch (error) {
      console.warn(
        'Unable to resolve cart store artwork.',
        cart.storeId,
        error,
      );

      /*
       * Do not permanently cache network failures. The current picker can
       * use the category fallback, while a later reopen may retry Supabase.
       */
      return {
        logoUrl: '',
        coverImageUrl: '',
        categorySlug:
          fallbackCategorySlug,
      };
    } finally {
      storeArtworkInFlight.delete(
        cart.storeId,
      );
    }
  })();

  storeArtworkInFlight.set(
    cart.storeId,
    request,
  );

  return request;
}

function getCartStoreCategoryArtwork(
  categorySlug:
    | string
    | null
    | undefined,
): ImageSourcePropType | null {
  const normalizedSlug =
    normalizeCategorySlug(
      categorySlug,
    );

  if (
    normalizedSlug === 'laundry' ||
    normalizedSlug === 'laundry-ironing' ||
    normalizedSlug === 'wash-and-iron' ||
    normalizedSlug === 'washing-ironing'
  ) {
    return LAUNDRY_CART_IMAGE;
  }

  if (
    normalizedSlug === 'personal-care' ||
    normalizedSlug === 'personalcare' ||
    normalizedSlug === 'beauty' ||
    normalizedSlug === 'beauty-care' ||
    normalizedSlug === 'health-beauty'
  ) {
    return PERSONAL_CARE_CART_IMAGE;
  }

  if (
    normalizedSlug === 'request-anything' ||
    normalizedSlug === 'anything' ||
    normalizedSlug === 'other' ||
    normalizedSlug === 'special-request'
  ) {
    return REQUEST_ANYTHING_CART_IMAGE;
  }

  if (
    normalizedSlug === 'restaurant' ||
    normalizedSlug === 'restaurants' ||
    normalizedSlug === 'supermarket' ||
    normalizedSlug === 'supermarkets' ||
    normalizedSlug === 'bookstore' ||
    normalizedSlug === 'bookstores'
  ) {
    return getCategoryIcon(
      normalizedSlug,
    );
  }

  return null;
}

function getCartItemCount(
  items: Array<{ quantity: number }>,
) {
  return items.reduce(
    (total, item) =>
      total + Number(item.quantity ?? 0),
    0,
  );
}

function getCartSubtotal(
  items: Array<{
    price: number;
    quantity: number;
  }>,
) {
  return items.reduce(
    (total, item) =>
      total +
      Number(item.price ?? 0) *
        Number(item.quantity ?? 0),
    0,
  );
}

function formatCartItemCount(
  count: number,
) {
  if (count === 1) {
    return 'صنف واحد';
  }

  if (count === 2) {
    return 'صنفان';
  }

  return `${count} أصناف`;
}

function formatCartSelectorPrice(
  value:
    | number
    | string
    | null
    | undefined,
) {
  const numericValue =
    Number(value ?? 0);

  return `${numericValue.toFixed(
    2,
  )} ج.م`;
}

export default function CartPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const carts = useCartStore(
    (state) => state.carts,
  );

  const setActiveCart = useCartStore(
    (state) => state.setActiveCart,
  );

  const availableCarts = useMemo(
    () =>
      Object.values(carts).filter(
        (cart) => cart.items.length > 0,
      ),
    [carts],
  );

  const [
    storeImages,
    setStoreImages,
  ] = useState<
    Record<
      string,
      CartStoreArtwork
    >
  >(() => {
    const initialArtwork: Record<
      string,
      CartStoreArtwork
    > = {};

    for (const cart of availableCarts) {
      const artwork =
        getImmediateCartArtwork(
          cart,
        );

      if (artwork) {
        initialArtwork[
          cart.storeId
        ] = artwork;
      }
    }

    return initialArtwork;
  });

  const storeImagesRef = useRef(
    storeImages,
  );

  const [
    failedImageUrls,
    setFailedImageUrls,
  ] = useState<Record<string, boolean>>(
    {},
  );

  const sheetTranslateY = useRef(
    new Animated.Value(0),
  ).current;

  const isClosingRef = useRef(false);

  function restoreSheetPosition() {
    isClosingRef.current = false;

    Animated.spring(
      sheetTranslateY,
      {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 240,
        mass: 0.9,
      },
    ).start();
  }

  function closePicker() {
    if (isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;

    Animated.timing(
      sheetTranslateY,
      {
        toValue:
          CART_PICKER_OFFSCREEN_Y,
        duration: 210,
        useNativeDriver: true,
      },
    ).start(({ finished }) => {
      if (!finished) {
        isClosingRef.current = false;
        return;
      }

      router.back();
    });
  }

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder:
          () => false,

        onMoveShouldSetPanResponder: (
          _,
          gestureState,
        ) => {
          const verticalMovement =
            Math.abs(gestureState.dy) >
            Math.abs(gestureState.dx);

          return (
            verticalMovement &&
            gestureState.dy > 3
          );
        },

        onMoveShouldSetPanResponderCapture:
          (
            _,
            gestureState,
          ) => {
            const verticalMovement =
              Math.abs(gestureState.dy) >
              Math.abs(gestureState.dx);

            return (
              verticalMovement &&
              gestureState.dy > 3
            );
          },

        onPanResponderGrant: () => {
          sheetTranslateY.stopAnimation();
        },

        onPanResponderMove: (
          _,
          gestureState,
        ) => {
          sheetTranslateY.setValue(
            Math.max(
              gestureState.dy,
              0,
            ),
          );
        },

        onPanResponderRelease: (
          _,
          gestureState,
        ) => {
          const shouldClose =
            gestureState.dy >=
              CART_PICKER_CLOSE_DISTANCE ||
            gestureState.vy >=
              CART_PICKER_CLOSE_VELOCITY;

          if (shouldClose) {
            closePicker();
            return;
          }

          restoreSheetPosition();
        },

        onPanResponderTerminate: () => {
          restoreSheetPosition();
        },

        onPanResponderTerminationRequest:
          () => false,
      }),
    [sheetTranslateY],
  );

  /*
   * /cart temporarily dispatches here only when there is more than one
   * non-empty cart. If cart state changes while the picker is open, move
   * back to the correct Cart state automatically.
   */
  useEffect(() => {
    if (availableCarts.length > 1) {
      return;
    }

    if (availableCarts.length === 1) {
      router.replace({
        pathname: '/cart-details',
        params: {
          storeId:
            availableCarts[0].storeId,
        },
      });

      return;
    }

    router.replace('/cart-details');
  }, [
    availableCarts,
    router,
  ]);

  /*
   * Resolve store artwork progressively.
   *
   * Important performance rules:
   * - render any cart.storeIcon URL immediately;
   * - reuse artwork already resolved during this app session;
   * - keep at most three Supabase RPCs active at once;
   * - commit each store as soon as its request finishes instead of waiting
   *   for the slowest store in the entire batch.
   */
  useEffect(() => {
    let cancelled = false;

    if (availableCarts.length === 0) {
      storeImagesRef.current = {};

      setStoreImages(
        (current) =>
          Object.keys(current).length ===
          0
            ? current
            : {},
      );

      return () => {
        cancelled = true;
      };
    }

    const seededArtwork: Record<
      string,
      CartStoreArtwork
    > = {};

    for (const cart of availableCarts) {
      if (
        storeImagesRef.current[
          cart.storeId
        ]
      ) {
        continue;
      }

      const immediateArtwork =
        getImmediateCartArtwork(
          cart,
        );

      if (immediateArtwork) {
        seededArtwork[
          cart.storeId
        ] = immediateArtwork;
      }
    }

    if (
      Object.keys(seededArtwork)
        .length > 0
    ) {
      storeImagesRef.current = {
        ...storeImagesRef.current,
        ...seededArtwork,
      };

      setStoreImages(
        (current) => ({
          ...current,
          ...seededArtwork,
        }),
      );
    }

    const missingCarts =
      availableCarts.filter(
        (cart) =>
          !storeArtworkSessionCache.has(
            cart.storeId,
          ),
      );

    if (missingCarts.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    let nextCartIndex = 0;

    const workerCount = Math.min(
      STORE_ARTWORK_MAX_CONCURRENCY,
      missingCarts.length,
    );

    async function loadNextArtwork() {
      while (!cancelled) {
        const cartIndex =
          nextCartIndex;

        nextCartIndex += 1;

        const cart =
          missingCarts[cartIndex];

        if (!cart) {
          return;
        }

        const artwork =
          await resolveCartStoreArtwork(
            cart,
          );

        if (cancelled) {
          return;
        }

        /*
         * Update this row immediately. We intentionally do not wait for
         * the other workers or stores to finish.
         */
        storeImagesRef.current = {
          ...storeImagesRef.current,
          [cart.storeId]: artwork,
        };

        setStoreImages(
          (current) => {
            const currentArtwork =
              current[cart.storeId];

            if (
              currentArtwork?.logoUrl ===
                artwork.logoUrl &&
              currentArtwork?.coverImageUrl ===
                artwork.coverImageUrl &&
              currentArtwork?.categorySlug ===
                artwork.categorySlug
            ) {
              return current;
            }

            return {
              ...current,
              [cart.storeId]:
                artwork,
            };
          },
        );
      }
    }

    void Promise.all(
      Array.from(
        {
          length: workerCount,
        },
        () => loadNextArtwork(),
      ),
    );

    return () => {
      cancelled = true;
    };
  }, [availableCarts]);

  function markImageUrlAsFailed(
    imageUrl: string,
  ) {
    if (!imageUrl) {
      return;
    }

    setFailedImageUrls(
      (current) => {
        if (current[imageUrl]) {
          return current;
        }

        return {
          ...current,
          [imageUrl]: true,
        };
      },
    );
  }

  function openCart(
    storeId: string,
  ) {
    setActiveCart(storeId);

    /*
     * Replace the transparent picker directly with the normal Cart-details
     * card. This avoids bouncing through /cart and keeps the transition
     * lightweight while preserving the native stack back gesture.
     */
    router.replace({
      pathname: '/cart-details',
      params: {
        storeId,
      },
    });
  }

  return (
    <View
      style={styles.screen}
    >
      <Pressable
        style={styles.backdrop}
        onPress={closePicker}
      />

      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom:
              Math.max(
                11,
                insets.bottom,
              ),
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
          {...sheetPanResponder.panHandlers}
          style={styles.dragArea}
        >
          <View
            style={styles.handle}
          />

          <View
            style={styles.topRow}
          >
            <Pressable
              accessibilityLabel="إغلاق"
              hitSlop={10}
              style={({
                pressed,
              }) => [
                styles.closeButton,
                pressed &&
                  styles.closeButtonPressed,
              ]}
              onPress={closePicker}
            >
              <Ionicons
                name="close"
                size={20}
                color="#171717"
              />
            </Pressable>
          </View>

          <Text
            style={styles.title}
          >
            جميع سلات التسوق
          </Text>
        </View>

        <FlatList
          data={availableCarts}
          keyExtractor={(cart) =>
            cart.storeId
          }
          style={styles.list}
          contentContainerStyle={
            styles.listContent
          }
          showsVerticalScrollIndicator={
            false
          }
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={
            40
          }
          windowSize={5}
          removeClippedSubviews={
            Platform.OS ===
            'android'
          }
          renderItem={({
            item: cart,
            index,
          }) => {
            const itemCount =
              getCartItemCount(
                cart.items,
              );

            const subtotal =
              getCartSubtotal(
                cart.items,
              );

            const storeArtwork =
              storeImages[
                cart.storeId
              ] ?? null;

            const storeLogoUrl =
              storeArtwork?.logoUrl ??
              '';

            const storeCoverImageUrl =
              storeArtwork
                ?.coverImageUrl ??
              '';

            const storedCartImageUrl =
              isImageUri(
                cart.storeIcon,
              )
                ? (cart.storeIcon ?? '')
                    .trim()
                : '';

            /*
             * Try the best available image, and if that exact URL fails,
             * immediately fall through to the next candidate instead of
             * blocking every image for the entire store.
             */
            const imageCandidates = [
              storeLogoUrl,
              storeCoverImageUrl,
              storedCartImageUrl,
            ].filter(
              (imageUrl, index, values) =>
                imageUrl.length > 0 &&
                values.indexOf(imageUrl) ===
                  index &&
                !failedImageUrls[imageUrl],
            );

            const remoteImageUrl =
              imageCandidates[0] ?? '';

            const categoryArtwork =
              getCartStoreCategoryArtwork(
                storeArtwork
                  ?.categorySlug ??
                  cart.categorySlug,
              );

            const displayRemoteImage =
              remoteImageUrl.length > 0;

            const remoteResizeMode:
              | 'contain'
              | 'cover' =
              remoteImageUrl ===
              storeLogoUrl
                ? 'contain'
                : 'cover';

            const isLast =
              index ===
              availableCarts.length -
                1;

            return (
              <Pressable
                style={({
                  pressed,
                }) => [
                  styles.row,
                  !isLast &&
                    styles.rowBorder,
                  pressed &&
                    styles.rowPressed,
                ]}
                onPress={() =>
                  openCart(
                    cart.storeId,
                  )
                }
              >
                <View
                  style={styles.logoBox}
                >
                  {displayRemoteImage ? (
                    <Image
                      accessibilityIgnoresInvertColors
                      accessibilityLabel={`صورة ${cart.storeName}`}
                      source={{
                        uri:
                          remoteImageUrl,
                      }}
                      style={styles.logo}
                      resizeMode={
                        remoteResizeMode
                      }
                      onError={() =>
                        markImageUrlAsFailed(
                          remoteImageUrl,
                        )
                      }
                    />
                  ) : categoryArtwork ? (
                    <Image
                      accessibilityIgnoresInvertColors
                      accessibilityLabel={`صورة ${cart.storeName}`}
                      source={
                        categoryArtwork
                      }
                      style={styles.logo}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text
                      style={
                        styles.logoFallback
                      }
                    >
                      {cart.storeIcon ||
                        '🏪'}
                    </Text>
                  )}
                </View>

                <View
                  style={
                    styles.storeContent
                  }
                >
                  <Text
                    style={
                      styles.storeName
                    }
                    numberOfLines={1}
                  >
                    {cart.storeName}
                  </Text>

                  <Text
                    style={
                      styles.itemCount
                    }
                    numberOfLines={1}
                  >
                    {formatCartItemCount(
                      itemCount,
                    )}
                  </Text>
                </View>

                <Text
                  style={styles.price}
                  numberOfLines={1}
                >
                  {formatCartSelectorPrice(
                    subtotal,
                  )}
                </Text>
              </Pressable>
            );
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      backgroundColor:
        'transparent',
      flex: 1,
      justifyContent:
        'flex-end',
    },

    backdrop: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
      backgroundColor:
        'rgba(0, 0, 0, 0.46)',
    },

    sheet: {
      backgroundColor:
        '#ffffff',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '76%',
      minHeight: 310,
      overflow: 'hidden',
      paddingHorizontal: 18,
      paddingTop: 0,

      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: -6,
      },
      shadowOpacity: 0.16,
      shadowRadius: 16,

      elevation: 24,
    },

    dragArea: {
      marginHorizontal: -18,
      paddingHorizontal: 18,
      paddingTop: 7,
    },

    handle: {
      alignSelf: 'center',
      backgroundColor: '#e5e5e5',
      borderRadius: 3,
      height: 4,
      marginTop: 3,
      width: 44,
    },

    topRow: {
      alignItems: 'center',
      flexDirection:
        'row-reverse',
      height: 52,
      justifyContent:
        'flex-start',
    },

    closeButton: {
      alignItems: 'center',
      backgroundColor:
        '#ffffff',
      borderColor: '#e1e1e1',
      borderRadius: 22,
      borderWidth: 1,
      height: 44,
      justifyContent:
        'center',
      width: 44,
    },

    closeButtonPressed: {
      backgroundColor:
        '#f6f6f6',
      transform: [
        {
          scale: 0.97,
        },
      ],
    },

    title: {
      color: '#1e1e1e',
      fontSize: 21,
      fontWeight: '900',
      lineHeight: 28,
      marginBottom: 10,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    list: {
      flexGrow: 0,
    },

    listContent: {
      paddingBottom: 4,
    },

    row: {
      alignItems: 'center',
      flexDirection:
        'row-reverse',
      minHeight: 92,
      paddingVertical: 8,
    },

    rowBorder: {
      borderBottomColor:
        '#e6e6e6',
      borderBottomWidth: 1,
    },

    rowPressed: {
      opacity: 0.74,
    },

    logoBox: {
      alignItems: 'center',
      backgroundColor:
        '#f5f5f5',
      borderColor: '#eeeeee',
      borderRadius: 11,
      borderWidth: 1,
      height: 62,
      justifyContent:
        'center',
      overflow: 'hidden',
      width: 62,
    },

    logo: {
      height: '100%',
      width: '100%',
    },

    logoFallback: {
      fontSize: 30,
    },

    storeContent: {
      flex: 1,
      marginHorizontal: 12,
    },

    storeName: {
      color: '#1d1d1d',
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    itemCount: {
      color: '#444444',
      fontSize: 12.5,
      marginTop: 3,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    price: {
      color: '#1d1d1d',
      fontSize: 14.5,
      fontWeight: '700',
      minWidth: 80,
      textAlign: 'left',
    },
  });
