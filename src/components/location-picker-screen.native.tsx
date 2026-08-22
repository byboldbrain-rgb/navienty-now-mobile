import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getDeliveryLocationErrorMessage,
  resolveDeliveryLocation,
} from '../services/delivery-location-service';
import {
  useCustomerStore,
} from '../store/customer-store';
import {
  NAVIENTY_NOW_COLORS,
} from '../theme/navienty-now-theme';

const BRAND_GREEN =
  NAVIENTY_NOW_COLORS.primary;

const BRAND_GREEN_DARK =
  NAVIENTY_NOW_COLORS.primaryPressed;

const LOCATION_SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'slide_from_right' as const,
};

const FALLBACK_REGION: Region = {
  latitude:
    27.18858603,

  longitude:
    31.16372869,

  latitudeDelta:
    0.045,

  longitudeDelta:
    0.045,
};

const FOCUSED_REGION_DELTA =
  0.009;

type Coordinate = {
  latitude: number;
  longitude: number;
};

type MapVisualType =
  | 'standard'
  | 'hybrid';

function getSingleParam(
  value:
    | string
    | string[]
    | undefined,
): string | undefined {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function isValidCoordinate(
  latitude:
    | number
    | null,

  longitude:
    | number
    | null,
): latitude is number {
  return (
    typeof latitude ===
      'number' &&
    Number.isFinite(
      latitude,
    ) &&
    typeof longitude ===
      'number' &&
    Number.isFinite(
      longitude,
    )
  );
}

function buildAddress(
  address:
    Location.LocationGeocodedAddress,
): string {
  const formattedAddress =
    address.formattedAddress
      ?.trim();

  if (formattedAddress) {
    return formattedAddress;
  }

  const streetLine = [
    address.streetNumber,
    address.street,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const possibleParts = [
    address.name,
    streetLine,
    address.district,
    address.subregion,
    address.city,
    address.region,
    address.postalCode,
    address.country,
  ];

  const uniqueParts:
    string[] = [];

  possibleParts.forEach(
    (part) => {
      const normalized =
        part?.trim();

      if (
        !normalized ||
        uniqueParts.some(
          (
            existingPart,
          ) =>
            existingPart
              .toLocaleLowerCase() ===
            normalized
              .toLocaleLowerCase(),
        )
      ) {
        return;
      }

      uniqueParts.push(
        normalized,
      );
    },
  );

  return uniqueParts.join(
    '، ',
  );
}

export default function LocationPickerScreen() {
  const router =
    useRouter();

  const insets =
    useSafeAreaInsets();

  const params =
    useLocalSearchParams<{
      storeId?:
        | string
        | string[];

      source?:
        | string
        | string[];
    }>();

  const storeId =
    getSingleParam(
      params.storeId,
    );

  const source =
    getSingleParam(
      params.source,
    );

  const mapRef =
    useRef<MapView | null>(
      null,
    );

  const manualSelectionRef =
    useRef(false);

  const mapWasDraggedRef =
    useRef(false);

  const locationLatitude =
    useCustomerStore(
      (state) =>
        state.locationLatitude,
    );

  const locationLongitude =
    useCustomerStore(
      (state) =>
        state.locationLongitude,
    );

  const setDeliveryLocation =
    useCustomerStore(
      (state) =>
        state.setDeliveryLocation,
    );

  const hasSavedCoordinate =
    isValidCoordinate(
      locationLatitude,
      locationLongitude,
    );

  const initialCoordinate:
    Coordinate | null =
    hasSavedCoordinate
      ? {
          latitude:
            locationLatitude,

          longitude:
            locationLongitude!,
        }
      : null;

  const initialRegion:
    Region =
    initialCoordinate
      ? {
          ...initialCoordinate,

          latitudeDelta:
            0.012,

          longitudeDelta:
            0.012,
        }
      : FALLBACK_REGION;

  const [
    selectedCoordinate,
    setSelectedCoordinate,
  ] =
    useState<Coordinate | null>(
      initialCoordinate,
    );

  const [
    isLocating,
    setIsLocating,
  ] =
    useState(false);

  const [
    isConfirming,
    setIsConfirming,
  ] =
    useState(false);

  const [
    permissionDenied,
    setPermissionDenied,
  ] =
    useState(false);

  const [
    hasLocationPermission,
    setHasLocationPermission,
  ] =
    useState(false);

  const [
    mapReady,
    setMapReady,
  ] =
    useState(false);

  const [
    mapType,
    setMapType,
  ] =
    useState<MapVisualType>(
      'standard',
    );

  const [
    searchVisible,
    setSearchVisible,
  ] =
    useState(false);

  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState('');

  const [
    isSearching,
    setIsSearching,
  ] =
    useState(false);

  function animateToCoordinate(
    coordinate:
      Coordinate,
  ) {
    setSelectedCoordinate(
      coordinate,
    );

    mapRef.current
      ?.animateToRegion(
        {
          ...coordinate,

          latitudeDelta:
            FOCUSED_REGION_DELTA,

          longitudeDelta:
            FOCUSED_REGION_DELTA,
        },
        420,
      );
  }

  function openLocationSettings() {
    void Linking
      .openSettings();
  }

  function showPermissionAlert() {
    Alert.alert(
      'السماح بالموقع مطلوب',
      'اسمح لـ Navienty Now باستخدام موقعك لتحديد عنوان التوصيل بدقة.',
      [
        {
          text:
            'إلغاء',

          style:
            'cancel',
        },

        {
          text:
            'فتح الإعدادات',

          onPress:
            openLocationSettings,
        },
      ],
    );
  }

  async function ensurePermission():
    Promise<boolean> {
    const currentPermission =
      await Location
        .getForegroundPermissionsAsync();

    if (
      currentPermission.granted
    ) {
      setPermissionDenied(
        false,
      );

      setHasLocationPermission(
        true,
      );

      return true;
    }

    const requestedPermission =
      await Location
        .requestForegroundPermissionsAsync();

    const granted =
      requestedPermission.granted;

    setPermissionDenied(
      !granted,
    );

    setHasLocationPermission(
      granted,
    );

    return granted;
  }

  async function moveToCurrentLocation(
    options?: {
      silentPermissionFailure?: boolean;

      respectManualSelection?: boolean;
    },
  ) {
    try {
      setIsLocating(
        true,
      );

      const granted =
        await ensurePermission();

      if (!granted) {
        if (
          !options
            ?.silentPermissionFailure
        ) {
          showPermissionAlert();
        }

        return;
      }

      const currentLocation =
        await Location
          .getCurrentPositionAsync(
            {
              accuracy:
                Location
                  .Accuracy
                  .High,
            },
          );

      if (
        options
          ?.respectManualSelection &&
        manualSelectionRef.current
      ) {
        return;
      }

      const coordinate = {
        latitude:
          currentLocation
            .coords
            .latitude,

        longitude:
          currentLocation
            .coords
            .longitude,
      };

      animateToCoordinate(
        coordinate,
      );
    } catch (error) {
      Alert.alert(
        'تعذر تحديد الموقع',

        error instanceof Error
          ? error.message
          : 'تعذر تحديد موقعك الحالي.',
      );
    } finally {
      setIsLocating(
        false,
      );
    }
  }

  useEffect(() => {
    if (
      !hasSavedCoordinate
    ) {
      void moveToCurrentLocation({
        silentPermissionFailure:
          true,

        respectManualSelection:
          true,
      });
    }
  }, []);

  function handleMapPress(
    event:
      MapPressEvent,
  ) {
    const coordinate =
      event.nativeEvent
        .coordinate;

    manualSelectionRef.current =
      true;

    animateToCoordinate({
      latitude:
        coordinate.latitude,

      longitude:
        coordinate.longitude,
    });
  }

  function handleRegionChangeComplete(
    region:
      Region,
  ) {
    if (
      !selectedCoordinate &&
      !mapWasDraggedRef.current
    ) {
      return;
    }

    if (
      mapWasDraggedRef.current
    ) {
      manualSelectionRef.current =
        true;
    }

    setSelectedCoordinate({
      latitude:
        region.latitude,

      longitude:
        region.longitude,
    });

    mapWasDraggedRef.current =
      false;
  }

  async function searchForAddress() {
    const normalizedQuery =
      searchQuery.trim();

    if (
      !normalizedQuery
    ) {
      return;
    }

    try {
      setIsSearching(
        true,
      );

      const granted =
        await ensurePermission();

      if (!granted) {
        showPermissionAlert();

        return;
      }

      const results =
        await Location
          .geocodeAsync(
            normalizedQuery,
          );

      const firstResult =
        results[0];

      if (
        !firstResult
      ) {
        Alert.alert(
          'لم يتم العثور على المكان',
          'جرّب كتابة اسم الشارع أو المنطقة بشكل أوضح.',
        );

        return;
      }

      manualSelectionRef.current =
        true;

      animateToCoordinate({
        latitude:
          firstResult.latitude,

        longitude:
          firstResult.longitude,
      });

      Keyboard.dismiss();

      setSearchVisible(
        false,
      );
    } catch (error) {
      Alert.alert(
        'تعذر البحث',

        error instanceof Error
          ? error.message
          : 'تعذر البحث عن هذا المكان.',
      );
    } finally {
      setIsSearching(
        false,
      );
    }
  }

  async function confirmLocation() {
    if (
      !selectedCoordinate
    ) {
      Alert.alert(
        'حدد موقع التوصيل',
        'حرّك الخريطة حتى تكون العلامة فوق مكان التوصيل، أو استخدم زر موقعك الحالي.',
      );

      return;
    }

    if (!storeId) {
      Alert.alert(
        'السلة غير متاحة',
        'تعذر تحديد المتجر الخاص بهذه السلة. ارجع إلى السلة وحاول مرة أخرى.',
      );

      return;
    }

    try {
      setIsConfirming(
        true,
      );

      const granted =
        await ensurePermission();

      if (!granted) {
        showPermissionAlert();

        return;
      }

      /*
       * Reverse geocode the exact selected pin.
       */
      const addresses =
        await Location
          .reverseGeocodeAsync({
            latitude:
              selectedCoordinate
                .latitude,

            longitude:
              selectedCoordinate
                .longitude,
          });

      const firstAddress =
        addresses[0];

      const generatedAddress =
        firstAddress
          ? buildAddress(
              firstAddress,
            )
          : '';

      if (
        !generatedAddress
      ) {
        Alert.alert(
          'تعذر قراءة العنوان',
          'تم تحديد الموقع على الخريطة، لكن تعذر تحويله إلى عنوان مكتوب. حرّك الخريطة قليلًا وحاول مرة أخرى.',
        );

        return;
      }

      /*
       * IMPORTANT:
       *
       * The backend is authoritative.
       *
       * The selected latitude/longitude are checked against the real
       * service-area polygon stored in Supabase.
       *
       * This prevents a customer from choosing an unsupported place
       * even if Google calls the whole location "الهضبة".
       */
      const deliveryResolution =
        await resolveDeliveryLocation({
          latitude:
            selectedCoordinate
              .latitude,

          longitude:
            selectedCoordinate
              .longitude,

          storeId,
        });

      if (
        !deliveryResolution
          .serviceable ||
        deliveryResolution
          .storeAvailable !==
          true
      ) {
        Alert.alert(
          'التوصيل غير متاح',
          getDeliveryLocationErrorMessage(
            deliveryResolution
              .reason,
          ),
        );

        return;
      }

      /*
       * Save only a server-validated location.
       */
      setDeliveryLocation({
        latitude:
          selectedCoordinate
            .latitude,

        longitude:
          selectedCoordinate
            .longitude,

        address:
          generatedAddress,

        serviceAreaId:
          deliveryResolution
            .serviceAreaId,

        serviceAreaName:
          deliveryResolution
            .serviceAreaName,

        cityId:
          deliveryResolution
            .cityId,

        cityName:
          deliveryResolution
            .cityName,
      });

      /*
       * We arrived from the existing Address Details screen.
       *
       * The Address Details screen is still underneath because it
       * opened this map using router.push().
       *
       * Simply go back. This preserves all text fields the customer
       * was already typing.
       */
      if (
        source ===
        'address-details'
      ) {
        router.back();

        return;
      }

      /*
       * First-time Cart flow:
       *
       * Cart
       * -> Location Picker
       * -> Address Details
       * -> Checkout
       *
       *
       * Checkout edit flow:
       *
       * Checkout
       * -> Location Picker
       * -> Address Details
       * -> back to Checkout after Save
       */
      router.replace({
        pathname:
          '/address-details',

        params: {
          storeId,

          source:
            source ===
            'checkout'
              ? 'checkout'
              : 'cart',
        },
      });
    } catch (error) {
      Alert.alert(
        'تعذر تأكيد الموقع',

        error instanceof Error
          ? error.message
          : 'تعذر التحقق من موقع التوصيل.',
      );
    } finally {
      setIsConfirming(
        false,
      );
    }
  }

  return (
    <View
      style={
        styles.screen
      }
    >
      <Stack.Screen
        options={
          LOCATION_SCREEN_OPTIONS
        }
      />

      {/* HEADER */}
      <View
        style={[
          styles.header,

          {
            paddingTop:
              Math.max(
                insets.top,
                6,
              ),
          },
        ]}
      >
        <View
          style={
            styles.headerInner
          }
        >
          <Pressable
            accessibilityLabel="البحث عن مكان"
            style={({
              pressed,
            }) => [
              styles.headerCircleButton,

              styles.searchHeaderButton,

              pressed &&
                styles.headerCircleButtonPressed,
            ]}
            onPress={() => {
              setSearchVisible(
                (
                  current,
                ) =>
                  !current,
              );
            }}
          >
            <Ionicons
              name="search-outline"
              size={22}
              color={
                NAVIENTY_NOW_COLORS.text
              }
            />
          </Pressable>

          <Text
            style={
              styles.headerTitle
            }
          >
            تأكيد الموقع
          </Text>

          <Pressable
            accessibilityLabel="رجوع"
            style={({
              pressed,
            }) => [
              styles.headerCircleButton,

              styles.backHeaderButton,

              pressed &&
                styles.headerCircleButtonPressed,
            ]}
            onPress={() =>
              router.back()
            }
          >
            <Ionicons
              name="arrow-forward"
              size={22}
              color={
                NAVIENTY_NOW_COLORS.text
              }
            />
          </Pressable>
        </View>
      </View>

      {/* MAP */}
      <View
        style={
          styles.mapStage
        }
      >
        <MapView
          ref={mapRef}
          provider={
            PROVIDER_GOOGLE
          }
          style={
            styles.map
          }
          initialRegion={
            initialRegion
          }
          mapType={
            mapType
          }
          loadingEnabled
          pitchEnabled={
            false
          }
          rotateEnabled={
            false
          }
          showsCompass={
            false
          }
          showsUserLocation={
            hasLocationPermission
          }
          showsMyLocationButton={
            false
          }
          toolbarEnabled={
            false
          }
          onMapReady={() =>
            setMapReady(
              true,
            )
          }
          onPanDrag={() => {
            mapWasDraggedRef.current =
              true;
          }}
          onPress={
            handleMapPress
          }
          onRegionChangeComplete={
            handleRegionChangeComplete
          }
        />

        {!mapReady ? (
          <View
            pointerEvents="none"
            style={
              styles.mapLoadingOverlay
            }
          >
            <ActivityIndicator
              size="large"
              color={
                BRAND_GREEN
              }
            />

            <Text
              style={
                styles.mapLoadingText
              }
            >
              جاري تحميل الخريطة...
            </Text>
          </View>
        ) : null}

        {/* SEARCH */}
        {searchVisible ? (
          <View
            style={
              styles.searchCard
            }
          >
            <Pressable
              accessibilityLabel="إغلاق البحث"
              hitSlop={8}
              style={({
                pressed,
              }) => [
                styles.searchCloseButton,

                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={() => {
                Keyboard
                  .dismiss();

                setSearchVisible(
                  false,
                );
              }}
            >
              <Ionicons
                name="close"
                size={22}
                color={
                  NAVIENTY_NOW_COLORS
                    .textSecondary
                }
              />
            </Pressable>

            <TextInput
              autoFocus
              value={
                searchQuery
              }
              placeholder="ابحث عن شارع، منطقة أو مكان"
              placeholderTextColor={
                NAVIENTY_NOW_COLORS
                  .textMuted
              }
              returnKeyType="search"
              style={
                styles.searchInput
              }
              textAlign="right"
              onChangeText={
                setSearchQuery
              }
              onSubmitEditing={() => {
                void searchForAddress();
              }}
            />

            <Pressable
              accessibilityLabel="بحث"
              disabled={
                isSearching ||
                !searchQuery.trim()
              }
              style={({
                pressed,
              }) => [
                styles.searchSubmitButton,

                (
                  isSearching ||
                  !searchQuery.trim()
                ) &&
                  styles.searchSubmitButtonDisabled,

                pressed &&
                  !isSearching &&
                  !!searchQuery.trim() &&
                  styles.searchSubmitButtonPressed,
              ]}
              onPress={() => {
                void searchForAddress();
              }}
            >
              {isSearching ? (
                <ActivityIndicator
                  size="small"
                  color={
                    NAVIENTY_NOW_COLORS
                      .white
                  }
                />
              ) : (
                <Ionicons
                  name="search"
                  size={20}
                  color={
                    NAVIENTY_NOW_COLORS
                      .white
                  }
                />
              )}
            </Pressable>
          </View>
        ) : null}

        {/* PERMISSION */}
        {permissionDenied ? (
          <Pressable
            style={({
              pressed,
            }) => [
              styles.permissionCard,

              pressed &&
                styles.buttonPressed,
            ]}
            onPress={
              openLocationSettings
            }
          >
            <Ionicons
              name="warning-outline"
              size={18}
              color="#9A6516"
            />

            <Text
              style={
                styles.permissionText
              }
            >
              فعّل إذن الموقع لزيادة دقة عنوان التوصيل.
            </Text>
          </Pressable>
        ) : null}

        {/* FIXED CENTER PIN */}
        <View
          pointerEvents="none"
          style={
            styles.centerPinAnchor
          }
        >
          <View
            style={
              styles.deliveryBubble
            }
          >
            <Text
              style={
                styles.deliveryBubbleText
              }
            >
              {selectedCoordinate
                ? 'سيتم توصيل طلبك إلى هذا المكان'
                : 'حرّك الخريطة لتحديد مكان التوصيل'}
            </Text>

            <View
              style={
                styles.deliveryBubbleCaret
              }
            />
          </View>

          <View
            style={
              styles.pinHalo
            }
          />

          <View
            style={
              styles.pinVisual
            }
          >
            <View
              style={
                styles.pinTail
              }
            />

            <View
              style={
                styles.pinHead
              }
            >
              <View
                style={
                  styles.pinCenterDot
                }
              />
            </View>
          </View>
        </View>

        {/* MAP CONTROLS */}
        <View
          style={
            styles.mapControls
          }
        >
          <Pressable
            accessibilityLabel="استخدام موقعي الحالي"
            disabled={
              isLocating ||
              isConfirming
            }
            style={({
              pressed,
            }) => [
              styles.mapControlButton,

              pressed &&
                !isLocating &&
                !isConfirming &&
                styles.mapControlButtonPressed,
            ]}
            onPress={() => {
              manualSelectionRef.current =
                false;

              void moveToCurrentLocation();
            }}
          >
            {isLocating ? (
              <ActivityIndicator
                size="small"
                color={
                  BRAND_GREEN
                }
              />
            ) : (
              <Ionicons
                name="navigate"
                size={22}
                color={
                  NAVIENTY_NOW_COLORS
                    .text
                }
              />
            )}
          </Pressable>

          <Pressable
            accessibilityLabel="تغيير شكل الخريطة"
            style={({
              pressed,
            }) => [
              styles.mapControlButton,

              pressed &&
                styles.mapControlButtonPressed,
            ]}
            onPress={() => {
              setMapType(
                (
                  current,
                ) =>
                  current ===
                  'standard'
                    ? 'hybrid'
                    : 'standard',
              );
            }}
          >
            <Ionicons
              name="map-outline"
              size={21}
              color={
                mapType ===
                'hybrid'
                  ? BRAND_GREEN
                  : NAVIENTY_NOW_COLORS
                      .text
              }
            />
          </Pressable>
        </View>
      </View>

      {/* BOTTOM BUTTON */}
      <View
        style={[
          styles.bottomBar,

          {
            paddingBottom:
              Math.max(
                insets.bottom,
                10,
              ) + 4,
          },
        ]}
      >
        <Pressable
          disabled={
            !selectedCoordinate ||
            isConfirming
          }
          style={({
            pressed,
          }) => [
            styles.confirmButton,

            (
              !selectedCoordinate ||
              isConfirming
            ) &&
              styles.confirmButtonDisabled,

            pressed &&
              !!selectedCoordinate &&
              !isConfirming &&
              styles.confirmButtonPressed,
          ]}
          onPress={() => {
            void confirmLocation();
          }}
        >
          {isConfirming ? (
            <ActivityIndicator
              size="small"
              color={
                NAVIENTY_NOW_COLORS
                  .white
              }
            />
          ) : (
            <Text
              style={
                styles.confirmButtonText
              }
            >
              تأكيد الموقع والمتابعة
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.page,

      flex:
        1,
    },

    header: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.white,

      zIndex:
        20,
    },

    headerInner: {
      alignItems:
        'center',

      height:
        62,

      justifyContent:
        'center',

      position:
        'relative',
    },

    headerCircleButton: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS.white,

      borderColor:
        NAVIENTY_NOW_COLORS.border,

      borderRadius:
        21,

      borderWidth:
        1,

      height:
        42,

      justifyContent:
        'center',

      position:
        'absolute',

      top:
        10,

      width:
        42,
    },

    searchHeaderButton: {
      left:
        16,
    },

    backHeaderButton: {
      right:
        16,
    },

    headerCircleButtonPressed: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.surface,

      transform: [
        {
          scale:
            0.97,
        },
      ],
    },

    headerTitle: {
      color:
        NAVIENTY_NOW_COLORS.text,

      fontSize:
        18,

      fontWeight:
        '900',

      lineHeight:
        25,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    mapStage: {
      backgroundColor:
        '#EEF1F1',

      flex:
        1,

      overflow:
        'hidden',

      position:
        'relative',
    },

    map: {
      position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    },

    mapLoadingOverlay: {
      position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,

      alignItems:
        'center',

      backgroundColor:
        '#F3F5F4',

      justifyContent:
        'center',

      zIndex:
        15,
    },

    mapLoadingText: {
      color:
        NAVIENTY_NOW_COLORS
          .textSecondary,

      fontSize:
        12,

      marginTop:
        9,
    },

    searchCard: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS.white,

      borderColor:
        NAVIENTY_NOW_COLORS.border,

      borderRadius:
        16,

      borderWidth:
        1,

      elevation:
        9,

      flexDirection:
        'row',

      left:
        16,

      minHeight:
        56,

      paddingHorizontal:
        7,

      position:
        'absolute',

      right:
        16,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          4,
      },

      shadowOpacity:
        0.14,

      shadowRadius:
        12,

      top:
        14,

      zIndex:
        30,
    },

    searchCloseButton: {
      alignItems:
        'center',

      borderRadius:
        20,

      height:
        40,

      justifyContent:
        'center',

      width:
        40,
    },

    searchInput: {
      color:
        NAVIENTY_NOW_COLORS.text,

      flex:
        1,

      fontSize:
        14,

      height:
        50,

      paddingHorizontal:
        8,

      writingDirection:
        'rtl',
    },

    searchSubmitButton: {
      alignItems:
        'center',

      backgroundColor:
        BRAND_GREEN,

      borderRadius:
        20,

      height:
        40,

      justifyContent:
        'center',

      width:
        40,
    },

    searchSubmitButtonDisabled: {
      opacity:
        0.42,
    },

    searchSubmitButtonPressed: {
      backgroundColor:
        BRAND_GREEN_DARK,

      transform: [
        {
          scale:
            0.96,
        },
      ],
    },

    permissionCard: {
      alignItems:
        'center',

      alignSelf:
        'center',

      backgroundColor:
        '#FFF5DA',

      borderColor:
        '#F0D89E',

      borderRadius:
        13,

      borderWidth:
        1,

      elevation:
        4,

      flexDirection:
        'row',

      maxWidth:
        340,

      paddingHorizontal:
        11,

      paddingVertical:
        8,

      position:
        'absolute',

      top:
        82,

      zIndex:
        12,
    },

    permissionText: {
      color:
        '#745814',

      fontSize:
        10,

      lineHeight:
        16,

      marginLeft:
        7,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    centerPinAnchor: {
      alignItems:
        'center',

      height:
        0,

      left:
        0,

      position:
        'absolute',

      right:
        0,

      top:
        '50%',

      zIndex:
        10,
    },

    deliveryBubble: {
      alignItems:
        'center',

      backgroundColor:
        '#242424',

      borderRadius:
        16,

      bottom:
        82,

      elevation:
        8,

      justifyContent:
        'center',

      maxWidth:
        320,

      minHeight:
        52,

      paddingHorizontal:
        18,

      paddingVertical:
        10,

      position:
        'absolute',

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          4,
      },

      shadowOpacity:
        0.2,

      shadowRadius:
        9,
    },

    deliveryBubbleText: {
      color:
        NAVIENTY_NOW_COLORS.white,

      fontSize:
        13,

      fontWeight:
        '600',

      lineHeight:
        20,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    deliveryBubbleCaret: {
      backgroundColor:
        '#242424',

      bottom:
        -6,

      height:
        14,

      position:
        'absolute',

      transform: [
        {
          rotate:
            '45deg',
        },
      ],

      width:
        14,
    },

    pinHalo: {
      backgroundColor:
        'rgba(0, 177, 79, 0.18)',

      borderColor:
        'rgba(0, 177, 79, 0.32)',

      borderRadius:
        14,

      borderWidth:
        1,

      bottom:
        -7,

      height:
        28,

      position:
        'absolute',

      width:
        28,
    },

    pinVisual: {
      alignItems:
        'center',

      bottom:
        2,

      height:
        62,

      justifyContent:
        'flex-start',

      position:
        'absolute',

      width:
        54,
    },

    pinTail: {
      backgroundColor:
        BRAND_GREEN,

      bottom:
        5,

      height:
        20,

      position:
        'absolute',

      transform: [
        {
          rotate:
            '45deg',
        },
      ],

      width:
        20,
    },

    pinHead: {
      alignItems:
        'center',

      backgroundColor:
        BRAND_GREEN,

      borderRadius:
        25,

      elevation:
        5,

      height:
        50,

      justifyContent:
        'center',

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          2,
      },

      shadowOpacity:
        0.2,

      shadowRadius:
        4,

      width:
        50,
    },

    pinCenterDot: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.white,

      borderRadius:
        6,

      height:
        12,

      width:
        12,
    },

    mapControls: {
      bottom:
        16,

      gap:
        9,

      left:
        16,

      position:
        'absolute',

      zIndex:
        12,
    },

    mapControlButton: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS.white,

      borderColor:
        NAVIENTY_NOW_COLORS.border,

      borderRadius:
        23,

      borderWidth:
        1,

      elevation:
        7,

      height:
        46,

      justifyContent:
        'center',

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          3,
      },

      shadowOpacity:
        0.14,

      shadowRadius:
        7,

      width:
        46,
    },

    mapControlButtonPressed: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.surface,

      transform: [
        {
          scale:
            0.96,
        },
      ],
    },

    bottomBar: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.white,

      borderTopColor:
        NAVIENTY_NOW_COLORS.border,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      paddingHorizontal:
        16,

      paddingTop:
        11,

      zIndex:
        20,
    },

    confirmButton: {
      alignItems:
        'center',

      backgroundColor:
        BRAND_GREEN,

      borderRadius:
        24,

      height:
        52,

      justifyContent:
        'center',

      width:
        '100%',
    },

    confirmButtonDisabled: {
      opacity:
        0.48,
    },

    confirmButtonPressed: {
      backgroundColor:
        BRAND_GREEN_DARK,

      transform: [
        {
          scale:
            0.99,
        },
      ],
    },

    confirmButtonText: {
      color:
        NAVIENTY_NOW_COLORS.white,

      fontSize:
        15,

      fontWeight:
        '900',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    buttonPressed: {
      opacity:
        0.72,
    },
  });