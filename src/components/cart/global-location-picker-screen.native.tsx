import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, {
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  publicSupabase,
} from '../../lib/supabase';
import {
  getDeliveryAddressForCoordinate,
} from '../../services/delivery-address-geocoding-service';
import {
  getDeliveryLocationErrorMessage,
  resolveDeliveryLocation,
} from '../../services/delivery-location-service';
import {
  useCustomerStore,
} from '../../store/customer-store';
import {
  NAVIENTY_NOW_COLORS,
} from '../../theme/navienty-now-theme';

type Coordinate = {
  latitude: number;
  longitude: number;
};

type DefaultActiveServiceArea = {
  latitude?: number | string | null;
  longitude?: number | string | null;

  service_area_id?: string | null;
  service_area_code?: string | null;
  service_area_name_ar?: string | null;
  service_area_name_en?: string | null;

  city_id?: string | null;
  city_name_ar?: string | null;
  city_name_en?: string | null;
};

const DEFAULT_REGION_DELTA = 0.045;
const CURRENT_LOCATION_REGION_DELTA = 0.009;
const SAVED_LOCATION_REGION_DELTA = 0.012;

function createRegion(
  coordinate: Coordinate,
  delta = DEFAULT_REGION_DELTA,
): Region {
  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

function toFiniteNumber(
  value: number | string | null | undefined,
): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value
      : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}

async function getDefaultActiveServiceAreaCoordinate():
Promise<Coordinate> {
  const { data, error } =
    await publicSupabase.rpc(
      'get_default_active_service_area',
    );

  if (error) {
    throw new Error(
      error.message ||
        'تعذر تحميل منطقة التوصيل الافتراضية.',
    );
  }

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {
    throw new Error(
      'لا توجد منطقة توصيل متاحة حاليًا.',
    );
  }

  const area =
    data as DefaultActiveServiceArea;

  const latitude =
    toFiniteNumber(area.latitude);

  const longitude =
    toFiniteNumber(area.longitude);

  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(
      'إحداثيات منطقة التوصيل الافتراضية غير صالحة.',
    );
  }

  return {
    latitude,
    longitude,
  };
}

export default function GlobalLocationPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const mapRef = useRef<MapView | null>(null);
  const manualSelectionRef = useRef(false);
  const mountedRef = useRef(true);

  const savedLatitude = useCustomerStore(
    (state) => state.locationLatitude,
  );

  const savedLongitude = useCustomerStore(
    (state) => state.locationLongitude,
  );

  const setDeliveryLocation = useCustomerStore(
    (state) => state.setDeliveryLocation,
  );

  const savedCoordinate =
    typeof savedLatitude === 'number' &&
    Number.isFinite(savedLatitude) &&
    typeof savedLongitude === 'number' &&
    Number.isFinite(savedLongitude)
      ? {
          latitude: savedLatitude,
          longitude: savedLongitude,
        }
      : null;

  const hasSavedCoordinate =
    savedCoordinate !== null;

  const [
    coordinate,
    setCoordinate,
  ] = useState<Coordinate | null>(
    savedCoordinate,
  );

  const [
    initialRegion,
    setInitialRegion,
  ] = useState<Region | null>(
    savedCoordinate
      ? createRegion(
          savedCoordinate,
          SAVED_LOCATION_REGION_DELTA,
        )
      : null,
  );

  const [
    isPreparingLocation,
    setIsPreparingLocation,
  ] = useState(
    !hasSavedCoordinate,
  );

  const [
    preparationError,
    setPreparationError,
  ] = useState<string | null>(
    null,
  );

  const [
    prepareAttempt,
    setPrepareAttempt,
  ] = useState(0);

  const [
    isLocating,
    setIsLocating,
  ] = useState(false);

  const [
    isConfirming,
    setIsConfirming,
  ] = useState(false);

  const [
    hasLocationPermission,
    setHasLocationPermission,
  ] = useState(false);

  function applyCoordinateToMap(
    nextCoordinate: Coordinate,
    options?: {
      delta?: number;
      animate?: boolean;
    },
  ) {
    const delta =
      options?.delta ??
      DEFAULT_REGION_DELTA;

    const nextRegion =
      createRegion(
        nextCoordinate,
        delta,
      );

    setCoordinate(nextCoordinate);
    setInitialRegion(nextRegion);

    if (
      options?.animate !== false &&
      mapRef.current
    ) {
      mapRef.current.animateToRegion(
        nextRegion,
        280,
      );
    }
  }

  async function openDefaultActiveServiceArea(
    options?: {
      animate?: boolean;
    },
  ) {
    const fallbackCoordinate =
      await getDefaultActiveServiceAreaCoordinate();

    if (!mountedRef.current) {
      return;
    }

    applyCoordinateToMap(
      fallbackCoordinate,
      {
        delta:
          DEFAULT_REGION_DELTA,
        animate:
          options?.animate ?? true,
      },
    );
  }

  async function requestCurrentLocation() {
    try {
      setIsLocating(true);

      const permission =
        await Location
          .requestForegroundPermissionsAsync();

      setHasLocationPermission(
        permission.granted,
      );

      if (!permission.granted) {
        try {
          await openDefaultActiveServiceArea();
        } catch {
          // Keep the current map position if fallback loading fails.
        }

        Alert.alert(
          'موقعك الحالي غير متاح',
          'تقدر تكمل بدون تفعيل الموقع بتحريك الخريطة وتحديد مكان التوصيل يدويًا.',
          [
            {
              text: 'إلغاء',
              style: 'cancel',
            },
            {
              text: 'فتح الإعدادات',
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ],
        );

        return;
      }

      const position =
        await Location
          .getCurrentPositionAsync({
            accuracy:
              Location.Accuracy.High,
          });

      const nextCoordinate = {
        latitude:
          position.coords.latitude,
        longitude:
          position.coords.longitude,
      };

      let resolution;

      try {
        resolution =
          await resolveDeliveryLocation({
            latitude:
              nextCoordinate.latitude,
            longitude:
              nextCoordinate.longitude,
            storeId: null,
          });
      } catch {
        Alert.alert(
          'تعذر التحقق من موقعك',
          'تعذر التأكد من نطاق التوصيل حاليًا. حاول مرة أخرى.',
        );

        return;
      }

      if (!resolution.serviceable) {
        try {
          await openDefaultActiveServiceArea();
        } catch {
          // Keep the current map position if fallback loading fails.
        }

        Alert.alert(
          'موقعك الحالي خارج نطاق التوصيل',
          'فتحنا لك منطقة توصيل متاحة حاليًا. حرّك الخريطة وحدد مكان التوصيل المناسب.',
        );

        return;
      }

      manualSelectionRef.current = false;

      applyCoordinateToMap(
        nextCoordinate,
        {
          delta:
            CURRENT_LOCATION_REGION_DELTA,
          animate: true,
        },
      );
    } catch {
      try {
        await openDefaultActiveServiceArea();
      } catch {
        // Keep the current map state if fallback loading also fails.
      }

      Alert.alert(
        'تعذر تحديد موقعك الحالي',
        'تقدر تكمل بدونه بتحريك الخريطة وتحديد مكان التوصيل يدويًا.',
      );
    } finally {
      setIsLocating(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function prepareExistingLocation() {
      if (hasSavedCoordinate) {
        setIsPreparingLocation(false);
        setPreparationError(null);
        return;
      }

      setIsPreparingLocation(true);
      setPreparationError(null);

      try {
        const permission =
          await Location
            .getForegroundPermissionsAsync();

        if (cancelled) {
          return;
        }

        setHasLocationPermission(
          permission.granted,
        );

        if (permission.granted) {
          try {
            const position =
              await Location
                .getCurrentPositionAsync({
                  accuracy:
                    Location.Accuracy
                      .Balanced,
                });

            if (
              cancelled ||
              manualSelectionRef.current
            ) {
              return;
            }

            const currentCoordinate = {
              latitude:
                position.coords.latitude,
              longitude:
                position.coords.longitude,
            };

            const resolution =
              await resolveDeliveryLocation({
                latitude:
                  currentCoordinate.latitude,
                longitude:
                  currentCoordinate.longitude,
                storeId: null,
              });

            if (
              cancelled ||
              manualSelectionRef.current
            ) {
              return;
            }

            if (resolution.serviceable) {
              applyCoordinateToMap(
                currentCoordinate,
                {
                  delta:
                    CURRENT_LOCATION_REGION_DELTA,
                  animate: false,
                },
              );

              return;
            }
          } catch {
            /*
             * GPS may be unavailable, stale, outside the service area,
             * or the serviceability check may temporarily fail.
             * In all cases, continue to the database-driven fallback.
             */
          }
        }

        if (
          cancelled ||
          manualSelectionRef.current
        ) {
          return;
        }

        const fallbackCoordinate =
          await getDefaultActiveServiceAreaCoordinate();

        if (
          cancelled ||
          manualSelectionRef.current
        ) {
          return;
        }

        applyCoordinateToMap(
          fallbackCoordinate,
          {
            delta:
              DEFAULT_REGION_DELTA,
            animate: false,
          },
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setPreparationError(
          error instanceof Error
            ? error.message
            : 'تعذر تحميل منطقة التوصيل.',
        );
      } finally {
        if (!cancelled) {
          setIsPreparingLocation(false);
        }
      }
    }

    void prepareExistingLocation();

    return () => {
      cancelled = true;
    };
  }, [
    hasSavedCoordinate,
    prepareAttempt,
  ]);

  async function confirmLocation() {
    if (!coordinate) {
      Alert.alert(
        'حدد موقع التوصيل',
        'حرّك الخريطة حتى تكون العلامة فوق مكان التوصيل.',
      );

      return;
    }

    try {
      setIsConfirming(true);

      const resolution =
        await resolveDeliveryLocation({
          latitude:
            coordinate.latitude,
          longitude:
            coordinate.longitude,
          storeId: null,
        });

      if (!resolution.serviceable) {
        Alert.alert(
          'التوصيل غير متاح',
          getDeliveryLocationErrorMessage(
            resolution.reason,
          ),
        );

        return;
      }

      const address =
        await getDeliveryAddressForCoordinate(
          coordinate,
          {
            serviceAreaName:
              resolution.serviceAreaName,
            cityName:
              resolution.cityName,
          },
        );

      setDeliveryLocation({
        latitude:
          coordinate.latitude,
        longitude:
          coordinate.longitude,
        address,
        serviceAreaId:
          resolution.serviceAreaId,
        serviceAreaName:
          resolution.serviceAreaName,
        cityId:
          resolution.cityId,
        cityName:
          resolution.cityName,
      });

      router.replace(
        '/global-checkout',
      );
    } catch (error) {
      Alert.alert(
        'تعذر تأكيد الموقع',
        error instanceof Error
          ? error.message
          : 'حاول مرة أخرى.',
      );
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View
        style={[
          styles.header,
          {
            paddingTop:
              Math.max(
                insets.top,
                8,
              ),
          },
        ]}
      >
        <Pressable
          accessibilityLabel="رجوع"
          style={styles.headerButton}
          onPress={() =>
            router.back()
          }
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={
              NAVIENTY_NOW_COLORS.text
            }
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          مكان التوصيل
        </Text>

        <View
          style={styles.headerSpacer}
        />
      </View>

      <View style={styles.mapWrap}>
        {initialRegion ? (
          <>
            <MapView
              ref={mapRef}
              provider={
                Platform.OS ===
                'android'
                  ? PROVIDER_GOOGLE
                  : undefined
              }
              style={styles.map}
              initialRegion={
                initialRegion
              }
              showsUserLocation={
                hasLocationPermission
              }
              showsMyLocationButton={
                false
              }
              onPanDrag={() => {
                manualSelectionRef.current =
                  true;
              }}
              onRegionChangeComplete={(
                region,
              ) => {
                setCoordinate({
                  latitude:
                    region.latitude,
                  longitude:
                    region.longitude,
                });
              }}
            />

            <View
              pointerEvents="none"
              style={styles.pinWrap}
            >
              <Ionicons
                name="location"
                size={42}
                color={
                  NAVIENTY_NOW_COLORS
                    .primary
                }
              />
            </View>

            <Pressable
              accessibilityLabel="موقعي الحالي"
              style={
                styles.locateButton
              }
              disabled={
                isLocating
              }
              onPress={() => {
                void requestCurrentLocation();
              }}
            >
              {isLocating ? (
                <ActivityIndicator
                  size="small"
                  color={
                    NAVIENTY_NOW_COLORS
                      .primary
                  }
                />
              ) : (
                <Ionicons
                  name="navigate"
                  size={21}
                  color={
                    NAVIENTY_NOW_COLORS
                      .primary
                  }
                />
              )}
            </Pressable>
          </>
        ) : (
          <View
            style={
              styles.mapLoadingContainer
            }
          >
            {isPreparingLocation ? (
              <>
                <ActivityIndicator
                  size="large"
                  color={
                    NAVIENTY_NOW_COLORS
                      .primary
                  }
                />

                <Text
                  style={
                    styles
                      .mapLoadingTitle
                  }
                >
                  جاري تجهيز الخريطة
                </Text>

                <Text
                  style={
                    styles
                      .mapLoadingDescription
                  }
                >
                  بنحدد أفضل نقطة لبدء
                  اختيار مكان التوصيل.
                </Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="location-outline"
                  size={42}
                  color={
                    NAVIENTY_NOW_COLORS
                      .primary
                  }
                />

                <Text
                  style={
                    styles
                      .mapLoadingTitle
                  }
                >
                  تعذر تحميل منطقة
                  التوصيل
                </Text>

                <Text
                  style={
                    styles
                      .mapLoadingDescription
                  }
                >
                  {preparationError ??
                    'تحقق من اتصال الإنترنت وحاول مرة أخرى.'}
                </Text>

                <Pressable
                  style={
                    styles.retryButton
                  }
                  onPress={() => {
                    manualSelectionRef.current =
                      false;

                    setPrepareAttempt(
                      (current) =>
                        current + 1,
                    );
                  }}
                >
                  <Text
                    style={
                      styles
                        .retryButtonText
                    }
                  >
                    إعادة المحاولة
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>

      <View
        style={[
          styles.bottomCard,
          {
            paddingBottom:
              Math.max(
                insets.bottom,
                14,
              ),
          },
        ]}
      >
        <Text
          style={styles.bottomTitle}
        >
          حدد مكان استلام الطلب
        </Text>

        <Text
          style={
            styles.bottomDescription
          }
        >
          نفس المكان هيستخدم لكل
          المتاجر الموجودة في السلة.
        </Text>

        <Pressable
          disabled={
            isConfirming ||
            !coordinate
          }
          style={({ pressed }) => [
            styles.confirmButton,
            (
              isConfirming ||
              !coordinate
            ) &&
              styles
                .confirmButtonDisabled,
            pressed &&
              !isConfirming &&
              coordinate !== null &&
              styles.pressed,
          ]}
          onPress={() => {
            void confirmLocation();
          }}
        >
          {isConfirming ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <Text
              style={
                styles
                  .confirmButtonText
              }
            >
              تأكيد الموقع
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },

  header: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    minHeight: 76,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },

  headerButton: {
    alignItems: 'center',
    borderColor: '#E1E1E1',
    borderRadius: 23,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },

  headerTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },

  headerSpacer: {
    height: 46,
    width: 46,
  },

  mapWrap: {
    flex: 1,
  },

  map: {
    ...StyleSheet.absoluteFill,
  },

  pinWrap: {
    left: '50%',
    marginLeft: -21,
    marginTop: -42,
    position: 'absolute',
    top: '50%',
  },

  locateButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    bottom: 18,
    elevation: 4,
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    width: 48,
  },

  mapLoadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  mapLoadingTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 14,
    textAlign: 'center',
  },

  mapLoadingDescription: {
    color:
      NAVIENTY_NOW_COLORS
        .textSecondary,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 7,
    textAlign: 'center',
  },

  retryButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 46,
    paddingHorizontal: 24,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  bottomCard: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#EEEEEE',
    borderTopWidth:
      StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 15,
  },

  bottomTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },

  bottomDescription: {
    color:
      NAVIENTY_NOW_COLORS
        .textSecondary,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'right',
  },

  confirmButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 999,
    height: 54,
    justifyContent: 'center',
    marginTop: 13,
  },

  confirmButtonDisabled: {
    opacity: 0.6,
  },

  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  pressed: {
    opacity: 0.86,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },
});