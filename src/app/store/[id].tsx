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
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import getAppBootstrap from '../../services/bootstrap-service';
import {
    type CatalogProduct,
    type StoreCatalog,
    getStoreCatalog,
} from '../../services/catalog-service';

import {
    selectCartItemCount,
    selectCartSubtotal,
    useCartStore,
} from '../../store/cart-store';

export default function StoreScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const rawId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [catalog, setCatalog] =
    useState<StoreCatalog | null>(null);

  const [appName, setAppName] =
    useState('');

  const [
    currencySymbol,
    setCurrencySymbol,
  ] = useState('');

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

  const [
    pendingProduct,
    setPendingProduct,
  ] = useState<CatalogProduct | null>(
    null,
  );

  const cartItems = useCartStore(
    (state) => state.items,
  );

  const cartStoreId = useCartStore(
    (state) => state.storeId,
  );

  const cartStoreName = useCartStore(
    (state) => state.storeName,
  );

  const addItem = useCartStore(
    (state) => state.addItem,
  );

  const increaseItem = useCartStore(
    (state) => state.increaseItem,
  );

  const decreaseItem = useCartStore(
    (state) => state.decreaseItem,
  );

  const clearCart = useCartStore(
    (state) => state.clearCart,
  );

  const cartItemCount = useCartStore(
    selectCartItemCount,
  );

  const cartSubtotal = useCartStore(
    selectCartSubtotal,
  );

  async function loadStoreData() {
    if (!rawId) {
      setCatalog(null);
      setErrorMessage(
        'لم يتم تحديد المتجر المطلوب.',
      );
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const [
        loadedCatalog,
        loadedBootstrap,
      ] = await Promise.all([
        getStoreCatalog(rawId),
        getAppBootstrap(),
      ]);

      setCatalog(loadedCatalog);

      setAppName(
        loadedBootstrap.settings.app_name,
      );

      setCurrencySymbol(
        loadedBootstrap.settings
          .currency_symbol,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحميل بيانات المتجر.';

      setCatalog(null);
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadStoreData();
  }, [rawId]);

  if (isLoading) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator
          size="large"
          color="#6d56df"
        />

        <Text style={styles.stateTitle}>
          جاري تحميل المتجر
        </Text>

        <Text
          style={styles.stateDescription}
        >
          يتم تحميل المنتجات والأسعار
          مباشرة من Supabase.
        </Text>
      </View>
    );
  }

  if (!catalog || errorMessage) {
    return (
      <View style={styles.stateScreen}>
        <Text style={styles.stateIcon}>
          🏪
        </Text>

        <Text style={styles.stateTitle}>
          المتجر غير متاح
        </Text>

        <Text
          style={styles.stateDescription}
        >
          {errorMessage ??
            'لم نتمكن من العثور على بيانات المتجر.'}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed &&
              styles.buttonPressed,
          ]}
          onPress={() => {
            void loadStoreData();
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
            styles.errorButton,
            pressed &&
              styles.buttonPressed,
          ]}
          onPress={() =>
            router.replace('/')
          }
        >
          <Text
            style={styles.errorButtonText}
          >
            العودة للرئيسية
          </Text>
        </Pressable>
      </View>
    );
  }

  const currentStore = catalog.store;
  const delivery = catalog.delivery;
  const productSections =
    catalog.sections;

  const storeIsClosed =
    currentStore.isManuallyClosed;

  function addProductToCart(
    product: CatalogProduct,
  ) {
    if (storeIsClosed) {
      return;
    }

    const result = addItem(
      {
        id: currentStore.id,
        name: currentStore.name,
        icon: currentStore.icon,
        deliveryFee:
          delivery.deliveryFee,
        minimumOrder:
          delivery.minimumOrder,
      },
      {
        id: product.id,
        name: product.name,
        description:
          product.description,
        price: product.price,
        icon: product.icon,
      },
    );

    if (
      result === 'different-store'
    ) {
      setPendingProduct(product);
    }
  }

  function increaseProductQuantity(
    product: CatalogProduct,
  ) {
    if (storeIsClosed) {
      return;
    }

    const itemExistsInCurrentStore =
      cartStoreId === currentStore.id &&
      cartItems.some(
        (item) =>
          item.id === product.id,
      );

    if (itemExistsInCurrentStore) {
      increaseItem(product.id);
      return;
    }

    addProductToCart(product);
  }

  function decreaseProductQuantity(
    productId: string,
  ) {
    if (
      cartStoreId !== currentStore.id
    ) {
      return;
    }

    decreaseItem(productId);
  }

  function replaceCartAndAddProduct() {
    if (
      !pendingProduct ||
      storeIsClosed
    ) {
      return;
    }

    clearCart();

    addItem(
      {
        id: currentStore.id,
        name: currentStore.name,
        icon: currentStore.icon,
        deliveryFee:
          delivery.deliveryFee,
        minimumOrder:
          delivery.minimumOrder,
      },
      {
        id: pendingProduct.id,
        name: pendingProduct.name,
        description:
          pendingProduct.description,
        price: pendingProduct.price,
        icon: pendingProduct.icon,
      },
    );

    setPendingProduct(null);
  }

  function openCart() {
    setPendingProduct(null);
    router.push('/cart');
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.pageContent,
          cartItemCount > 0 &&
            styles.pageContentWithCart,
        ]}
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
              onPress={() =>
                router.back()
              }
            >
              <Text
                style={styles.backIcon}
              >
                ›
              </Text>
            </Pressable>

            <View
              style={styles.storeHero}
            >
              <View
                style={
                  styles.storeIconContainer
                }
              >
                <Text
                  style={styles.storeIcon}
                >
                  {currentStore.icon}
                </Text>
              </View>

              <Text
                style={styles.storeName}
              >
                {currentStore.name}
              </Text>

              <Text
                style={
                  styles.storeDescription
                }
              >
                {
                  currentStore.shortDescription
                }
              </Text>

              <View
                style={
                  styles.storeInformation
                }
              >
                <View
                  style={
                    styles.informationItem
                  }
                >
                  <Text
                    style={
                      styles.informationValue
                    }
                  >
                    ⭐ {currentStore.rating}
                  </Text>

                  <Text
                    style={
                      styles.informationLabel
                    }
                  >
                    التقييم
                  </Text>
                </View>

                <View
                  style={
                    styles.informationDivider
                  }
                />

                <View
                  style={
                    styles.informationItem
                  }
                >
                  <Text
                    style={
                      styles.informationValue
                    }
                  >
                    {delivery.deliveryTime ||
                      `${delivery.estimatedDeliveryMinutes ?? '-'} دقيقة`}
                  </Text>

                  <Text
                    style={
                      styles.informationLabel
                    }
                  >
                    وقت التوصيل
                  </Text>
                </View>

                <View
                  style={
                    styles.informationDivider
                  }
                />

                <View
                  style={
                    styles.informationItem
                  }
                >
                  <Text
                    style={
                      styles.informationValue
                    }
                  >
                    {delivery.deliveryFee}{' '}
                    {currencySymbol}
                  </Text>

                  <Text
                    style={
                      styles.informationLabel
                    }
                  >
                    التوصيل
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {storeIsClosed && (
            <View
              style={styles.closedNotice}
            >
              <Text
                style={
                  styles.closedNoticeText
                }
              >
                {currentStore.manualClosedNote ??
                  'المتجر مغلق مؤقتًا ولا يستقبل طلبات الآن'}
              </Text>

              <Text
                style={
                  styles.closedNoticeIcon
                }
              >
                ⛔
              </Text>
            </View>
          )}

          <View
            style={
              styles.minimumOrderNotice
            }
          >
            <Text
              style={
                styles.minimumOrderText
              }
            >
              الحد الأدنى للطلب:{' '}
              {delivery.minimumOrder}{' '}
              {currencySymbol}
            </Text>

            <Text
              style={
                styles.minimumOrderIcon
              }
            >
              🛍️
            </Text>
          </View>

          <View
            style={
              styles.sectionNavigation
            }
          >
            {productSections.map(
              (section) => (
                <View
                  key={section.id}
                  style={
                    styles.sectionChip
                  }
                >
                  <Text
                    style={
                      styles.sectionChipText
                    }
                  >
                    {section.name}
                  </Text>
                </View>
              ),
            )}
          </View>

          {productSections.length ===
          0 ? (
            <View
              style={styles.emptyCatalog}
            >
              <Text
                style={
                  styles.emptyCatalogIcon
                }
              >
                📦
              </Text>

              <Text
                style={
                  styles.emptyCatalogTitle
                }
              >
                لا توجد منتجات متاحة
              </Text>

              <Text
                style={
                  styles.emptyCatalogDescription
                }
              >
                لم تتم إضافة منتجات مفعّلة
                لهذا المتجر بعد.
              </Text>
            </View>
          ) : (
            productSections.map(
              (section) => (
                <View
                  key={section.id}
                  style={
                    styles.productsSection
                  }
                >
                  <Text
                    style={
                      styles.productsSectionTitle
                    }
                  >
                    {section.name}
                  </Text>

                  <View
                    style={
                      styles.productsList
                    }
                  >
                    {section.products.map(
                      (product) => {
                        const cartItem =
                          cartStoreId ===
                          currentStore.id
                            ? cartItems.find(
                                (item) =>
                                  item.id ===
                                  product.id,
                              )
                            : undefined;

                        const quantity =
                          cartItem?.quantity ??
                          0;

                        return (
                          <View
                            key={
                              product.id
                            }
                            style={
                              styles.productCard
                            }
                          >
                            <View
                              style={
                                styles.productImage
                              }
                            >
                              <Text
                                style={
                                  styles.productIcon
                                }
                              >
                                {
                                  product.icon
                                }
                              </Text>
                            </View>

                            <View
                              style={
                                styles.productContent
                              }
                            >
                              <Text
                                style={
                                  styles.productName
                                }
                              >
                                {
                                  product.name
                                }
                              </Text>

                              <Text
                                style={
                                  styles.productDescription
                                }
                              >
                                {
                                  product.description
                                }
                              </Text>

                              <Text
                                style={
                                  styles.productPrice
                                }
                              >
                                {
                                  product.price
                                }{' '}
                                {
                                  currencySymbol
                                }
                              </Text>

                              {product.requiresPrescription && (
                                <Text
                                  style={
                                    styles.productWarning
                                  }
                                >
                                  يتطلب مراجعة
                                  وصفة طبية
                                </Text>
                              )}

                              {product.isAgeRestricted && (
                                <Text
                                  style={
                                    styles.productWarning
                                  }
                                >
                                  منتج مقيّد
                                  بالعمر
                                </Text>
                              )}
                            </View>

                            {quantity ===
                            0 ? (
                              <Pressable
                                style={({
                                  pressed,
                                }) => [
                                  styles.addButton,
                                  storeIsClosed &&
                                    styles.disabledButton,
                                  pressed &&
                                    !storeIsClosed &&
                                    styles.buttonPressed,
                                ]}
                                disabled={
                                  storeIsClosed
                                }
                                onPress={() =>
                                  addProductToCart(
                                    product,
                                  )
                                }
                              >
                                <Text
                                  style={
                                    styles.addButtonText
                                  }
                                >
                                  +
                                </Text>
                              </Pressable>
                            ) : (
                              <View
                                style={
                                  styles.quantityControl
                                }
                              >
                                <Pressable
                                  style={({
                                    pressed,
                                  }) => [
                                    styles.quantityButton,
                                    storeIsClosed &&
                                      styles.disabledButton,
                                    pressed &&
                                      !storeIsClosed &&
                                      styles.buttonPressed,
                                  ]}
                                  disabled={
                                    storeIsClosed
                                  }
                                  onPress={() =>
                                    increaseProductQuantity(
                                      product,
                                    )
                                  }
                                >
                                  <Text
                                    style={
                                      styles.quantityButtonText
                                    }
                                  >
                                    +
                                  </Text>
                                </Pressable>

                                <Text
                                  style={
                                    styles.quantityText
                                  }
                                >
                                  {
                                    quantity
                                  }
                                </Text>

                                <Pressable
                                  style={({
                                    pressed,
                                  }) => [
                                    styles.quantityButton,
                                    pressed &&
                                      styles.buttonPressed,
                                  ]}
                                  onPress={() =>
                                    decreaseProductQuantity(
                                      product.id,
                                    )
                                  }
                                >
                                  <Text
                                    style={
                                      styles.quantityButtonText
                                    }
                                  >
                                    −
                                  </Text>
                                </Pressable>
                              </View>
                            )}
                          </View>
                        );
                      },
                    )}
                  </View>
                </View>
              ),
            )
          )}
        </View>
      </ScrollView>

      {cartItemCount > 0 && (
        <View
          style={styles.cartBarWrapper}
        >
          <View
            style={
              styles.cartBarContainer
            }
          >
            <Pressable
              style={({ pressed }) => [
                styles.cartBar,
                pressed &&
                  styles.cartBarPressed,
              ]}
              onPress={() =>
                router.push('/cart')
              }
            >
              <View
                style={
                  styles.cartPriceContainer
                }
              >
                <Text
                  style={styles.cartPrice}
                >
                  {cartSubtotal}{' '}
                  {currencySymbol}
                </Text>

                <Text
                  style={
                    styles.cartPriceLabel
                  }
                >
                  إجمالي المنتجات
                </Text>
              </View>

              <View
                style={styles.cartAction}
              >
                <Text
                  style={
                    styles.cartButtonText
                  }
                >
                  عرض السلة
                </Text>

                {cartStoreName && (
                  <Text
                    style={
                      styles.cartStoreText
                    }
                    numberOfLines={1}
                  >
                    {cartStoreName}
                  </Text>
                )}
              </View>

              <View
                style={styles.cartCount}
              >
                <Text
                  style={
                    styles.cartCountText
                  }
                >
                  {cartItemCount}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      )}

      <Modal
        visible={
          pendingProduct !== null
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setPendingProduct(null)
        }
      >
        <View
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View
              style={
                styles.modalIconContainer
              }
            >
              <Text
                style={styles.modalIcon}
              >
                🛒
              </Text>
            </View>

            <Text
              style={styles.modalTitle}
            >
              لديك سلة من متجر آخر
            </Text>

            <Text
              style={
                styles.modalDescription
              }
            >
              السلة الحالية من{' '}
              {cartStoreName ??
                'متجر آخر'}
              .{'\n'}
              يسمح{' '}
              {appName ||
                'التطبيق'}{' '}
              بطلب من متجر واحد فقط.
            </Text>

            {pendingProduct && (
              <View
                style={
                  styles.pendingProduct
                }
              >
                <Text
                  style={
                    styles.pendingProductName
                  }
                >
                  {pendingProduct.name}
                </Text>

                <Text
                  style={
                    styles.pendingProductLabel
                  }
                >
                  المنتج الذي تحاول
                  إضافته
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.replaceCartButton,
                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={
                replaceCartAndAddProduct
              }
            >
              <Text
                style={
                  styles.replaceCartButtonText
                }
              >
                إفراغ السلة والبدء من هذا
                المتجر
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.viewCartButton,
                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={openCart}
            >
              <Text
                style={
                  styles.viewCartButtonText
                }
              >
                عرض السلة الحالية
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={() =>
                setPendingProduct(null)
              }
            >
              <Text
                style={
                  styles.cancelButtonText
                }
              >
                إلغاء
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
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

  pageContentWithCart: {
    paddingBottom: 130,
  },

  container: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },

  header: {
    backgroundColor: '#6d56df',
    borderRadius: 28,
    minHeight: 310,
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

  storeHero: {
    alignItems: 'center',
    marginTop: 4,
  },

  storeIconContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },

  storeIcon: {
    fontSize: 39,
  },

  storeName: {
    color: '#ffffff',
    fontSize: 27,
    fontWeight: '900',
    marginTop: 14,
    textAlign: 'center',
  },

  storeDescription: {
    color: '#edeaff',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 6,
    textAlign: 'center',
  },

  storeInformation: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor:
      'rgba(255,255,255,0.13)',
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },

  informationItem: {
    alignItems: 'center',
    flex: 1,
  },

  informationValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  informationLabel: {
    color: '#ddd8ff',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },

  informationDivider: {
    backgroundColor:
      'rgba(255,255,255,0.23)',
    height: 30,
    width: 1,
  },

  closedNotice: {
    alignItems: 'center',
    backgroundColor: '#fdecec',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },

  closedNoticeText: {
    color: '#9a3333',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },

  closedNoticeIcon: {
    fontSize: 18,
    marginLeft: 9,
  },

  minimumOrderNotice: {
    alignItems: 'center',
    backgroundColor: '#fff3d6',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },

  minimumOrderText: {
    color: '#7a5a13',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },

  minimumOrderIcon: {
    fontSize: 18,
    marginLeft: 9,
  },

  sectionNavigation: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 24,
  },

  sectionChip: {
    backgroundColor: '#eeeafd',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },

  sectionChipText: {
    color: '#5d47d2',
    fontSize: 12,
    fontWeight: '800',
  },

  productsSection: {
    marginTop: 28,
  },

  productsSectionTitle: {
    color: '#1d1d22',
    fontSize: 21,
    fontWeight: '900',
    marginBottom: 14,
    textAlign: 'right',
  },

  productsList: {
    gap: 12,
  },

  productCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 21,
    flexDirection: 'row',
    minHeight: 122,
    padding: 14,
  },

  productImage: {
    alignItems: 'center',
    backgroundColor: '#f1efff',
    borderRadius: 18,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },

  productIcon: {
    fontSize: 35,
  },

  productContent: {
    flex: 1,
    marginHorizontal: 14,
  },

  productName: {
    color: '#202025',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },

  productDescription: {
    color: '#777781',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'right',
  },

  productPrice: {
    color: '#5d47d2',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'right',
  },

  productWarning: {
    color: '#a13333',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 5,
    textAlign: 'right',
  },

  addButton: {
    alignItems: 'center',
    backgroundColor: '#6d56df',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },

  addButtonText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '500',
    lineHeight: 29,
  },

  quantityControl: {
    alignItems: 'center',
    backgroundColor: '#f1efff',
    borderRadius: 14,
    gap: 5,
    padding: 5,
  },

  quantityButton: {
    alignItems: 'center',
    backgroundColor: '#6d56df',
    borderRadius: 9,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },

  quantityButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 21,
  },

  quantityText: {
    color: '#28232f',
    fontSize: 14,
    fontWeight: '900',
    minWidth: 28,
    textAlign: 'center',
  },

  disabledButton: {
    opacity: 0.45,
  },

  cartBarWrapper: {
    bottom: 0,
    left: 0,
    paddingBottom: 18,
    paddingHorizontal: 18,
    position: 'absolute',
    right: 0,
  },

  cartBarContainer: {
    alignSelf: 'center',
    maxWidth: 520,
    width: '100%',
  },

  cartBar: {
    alignItems: 'center',
    backgroundColor: '#6d56df',
    borderRadius: 20,
    flexDirection: 'row',
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  cartBarPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },

  cartPriceContainer: {
    flex: 1,
  },

  cartPrice: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },

  cartPriceLabel: {
    color: '#dcd7ff',
    fontSize: 10,
    marginTop: 2,
  },

  cartAction: {
    alignItems: 'center',
    flex: 1,
  },

  cartButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },

  cartStoreText: {
    color: '#dcd7ff',
    fontSize: 10,
    marginTop: 2,
    maxWidth: 130,
  },

  cartCount: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 11,
    height: 34,
    justifyContent: 'center',
    marginLeft: 12,
    width: 34,
  },

  cartCountText: {
    color: '#5d47d2',
    fontSize: 14,
    fontWeight: '900',
  },

  modalOverlay: {
    alignItems: 'center',
    backgroundColor:
      'rgba(22, 19, 33, 0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },

  modalCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 26,
    maxWidth: 440,
    padding: 24,
    width: '100%',
  },

  modalIconContainer: {
    alignItems: 'center',
    backgroundColor: '#f1efff',
    borderRadius: 22,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },

  modalIcon: {
    fontSize: 36,
  },

  modalTitle: {
    color: '#222228',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 18,
    textAlign: 'center',
  },

  modalDescription: {
    color: '#777781',
    fontSize: 13,
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'center',
  },

  pendingProduct: {
    alignSelf: 'stretch',
    backgroundColor: '#f7f7fa',
    borderRadius: 16,
    marginTop: 18,
    padding: 14,
  },

  pendingProductName: {
    color: '#25252b',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },

  pendingProductLabel: {
    color: '#888891',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },

  replaceCartButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#6d56df',
    borderRadius: 16,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  replaceCartButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },

  viewCartButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#eeeafd',
    borderRadius: 16,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  viewCartButtonText: {
    color: '#5d47d2',
    fontSize: 14,
    fontWeight: '900',
  },

  cancelButton: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },

  cancelButtonText: {
    color: '#777781',
    fontSize: 13,
    fontWeight: '700',
  },

  emptyCatalog: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    marginTop: 24,
    padding: 25,
  },

  emptyCatalogIcon: {
    fontSize: 42,
  },

  emptyCatalogTitle: {
    color: '#222228',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
  },

  emptyCatalogDescription: {
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

  errorButton: {
    backgroundColor: '#ffffff',
    borderColor: '#e8e8ed',
    borderRadius: 15,
    borderWidth: 1,
    marginTop: 11,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },

  errorButtonText: {
    color: '#5d47d2',
    fontSize: 14,
    fontWeight: '800',
  },

  buttonPressed: {
    opacity: 0.75,
  },
});
