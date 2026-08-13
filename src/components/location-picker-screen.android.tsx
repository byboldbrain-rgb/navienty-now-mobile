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
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import MapView, {
    Marker,
    PROVIDER_GOOGLE,
    type MapPressEvent,
    type Region,
} from 'react-native-maps';

import {
    useCustomerStore,
} from '../store/customer-store';

const BRAND_GREEN = '#00B14F';
const BRAND_GREEN_DARK = '#009B45';
const BRAND_GREEN_SOFT = '#EAF8F0';

/**
 * Safe fallback only for the initial camera when a saved/current
 * location is not available yet. The user still has to deliberately
 * choose a pin before continuing.
 *
 * Assiut city center.
 */
const FALLBACK_REGION: Region = {
  latitude: 27.18858603,
  longitude: 31.16372869,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

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
  latitude: number | null,
  longitude: number | null,
): latitude is number {
  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude)
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
          (existingPart) =>
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

  return uniqueParts.join('، ');
}

export default function LocationPickerScreen() {
  const router = useRouter();

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

  const locationAddress =
    useCustomerStore(
      (state) =>
        state.locationAddress,
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
  ] = useState(false);

  const [
    isConfirming,
    setIsConfirming,
  ] = useState(false);

  const [
    permissionDenied,
    setPermissionDenied,
  ] = useState(false);

  const [
    hasLocationPermission,
    setHasLocationPermission,
  ] = useState(false);

  const [
    mapReady,
    setMapReady,
  ] = useState(false);

  function animateToCoordinate(
    coordinate: Coordinate,
  ) {
    mapRef.current?.animateToRegion(
      {
        ...coordinate,

        latitudeDelta:
          0.009,

        longitudeDelta:
          0.009,
      },

      420,
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

  async function useCurrentLocation() {
    try {
      setIsLocating(true);

      const granted =
        await ensurePermission();

      if (!granted) {
        Alert.alert(
          'السماح بالموقع مطلوب',
          'اسمح لـ Navienty Now باستخدام موقعك حتى نحدد عنوان التوصيل تلقائيًا.',
          [
            {
              text: 'إلغاء',
              style: 'cancel',
            },
            {
              text: 'فتح الإعدادات',
              onPress: () => {
                void Linking
                  .openSettings();
              },
            },
          ],
        );

        return;
      }

      const currentLocation =
        await Location
          .getCurrentPositionAsync({
            accuracy:
              Location
                .Accuracy
                .High,
          });

      const coordinate = {
        latitude:
          currentLocation
            .coords.latitude,

        longitude:
          currentLocation
            .coords.longitude,
      };

      setSelectedCoordinate(
        coordinate,
      );

      animateToCoordinate(
        coordinate,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحديد موقعك الحالي.';

      Alert.alert(
        'تعذر تحديد الموقع',
        message,
      );
    } finally {
      setIsLocating(
        false,
      );
    }
  }

  useEffect(() => {
    /**
     * If there is no previous map pin, ask for foreground permission
     * and center on the device. A saved location is respected so the
     * customer can simply review or adjust it.
     */
    if (
      !hasSavedCoordinate
    ) {
      void useCurrentLocation();
    }
  }, []);

  function handleMapPress(
    event: MapPressEvent,
  ) {
    const coordinate =
      event.nativeEvent
        .coordinate;

    setSelectedCoordinate({
      latitude:
        coordinate.latitude,

      longitude:
        coordinate.longitude,
    });
  }

  async function confirmLocation() {
    if (
      !selectedCoordinate
    ) {
      Alert.alert(
        'حدد موقع التوصيل',
        'اضغط على الخريطة لوضع العلامة على مكان التوصيل، أو استخدم زر موقعي الحالي.',
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

      /**
       * expo-location requires foreground location permission for
       * reverse geocoding on Android.
       */
      const granted =
        await ensurePermission();

      if (!granted) {
        Alert.alert(
          'السماح بالموقع مطلوب',
          'نحتاج إذن الموقع لتحويل العلامة التي اخترتها إلى عنوان مكتوب تلقائيًا.',
          [
            {
              text: 'إلغاء',
              style: 'cancel',
            },
            {
              text: 'فتح الإعدادات',
              onPress: () => {
                void Linking
                  .openSettings();
              },
            },
          ],
        );

        return;
      }

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

      if (!generatedAddress) {
        Alert.alert(
          'تعذر قراءة العنوان',
          'تم تحديد الموقع على الخريطة، لكن تعذر تحويله إلى عنوان مكتوب. حرّك العلامة قليلًا وحاول مرة أخرى.',
        );

        return;
      }

      setDeliveryLocation({
        latitude:
          selectedCoordinate
            .latitude,

        longitude:
          selectedCoordinate
            .longitude,

        address:
          generatedAddress,
      });

      if (
        source ===
        'checkout'
      ) {
        router.back();

        return;
      }

      /**
       * Initial Cart flow:
       * Cart -> Location Picker -> Checkout
       *
       * replace removes the picker from the stack so Back from checkout
       * returns naturally to the cart.
       */
      router.replace({
        pathname: '/checkout',

        params: {
          storeId,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'تعذر تحويل الموقع إلى عنوان.';

      Alert.alert(
        'تعذر تأكيد الموقع',
        message,
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
        options={{
          headerShown:
            false,

          animation:
            'slide_from_right',
        }}
      />

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
        showsCompass
        showsUserLocation={
          hasLocationPermission
        }
        showsMyLocationButton={
          false
        }
        onMapReady={() =>
          setMapReady(true)
        }
        onPress={
          handleMapPress
        }
      >
        {selectedCoordinate ? (
          <Marker
            coordinate={
              selectedCoordinate
            }
            draggable
            pinColor={
              BRAND_GREEN
            }
            title="موقع التوصيل"
            description="يمكنك تحريك العلامة لتحديد المكان بدقة"
            onDragEnd={(
              event,
            ) => {
              const coordinate =
                event.nativeEvent
                  .coordinate;

              setSelectedCoordinate({
                latitude:
                  coordinate
                    .latitude,

                longitude:
                  coordinate
                    .longitude,
              });
            }}
          />
        ) : null}
      </MapView>

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

      <View
        pointerEvents="box-none"
        style={
          styles.topOverlay
        }
      >
        <View
          style={
            styles.header
          }
        >
          <Pressable
            accessibilityLabel="رجوع"
            style={({
              pressed,
            }) => [
              styles.headerButton,

              pressed &&
                styles.buttonPressed,
            ]}
            onPress={() =>
              router.back()
            }
          >
            <Ionicons
              name="arrow-back"
              size={27}
              color="#202020"
            />
          </Pressable>

          <View
            style={
              styles.headerTitleContainer
            }
          >
            <Text
              style={
                styles.headerTitle
              }
            >
              حدد موقع التوصيل
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              اضغط على الخريطة أو حرّك العلامة
            </Text>
          </View>

          <View
            style={
              styles.headerPlaceholder
            }
          />
        </View>

        {permissionDenied ? (
          <Pressable
            style={({
              pressed,
            }) => [
              styles.permissionCard,

              pressed &&
                styles.buttonPressed,
            ]}
            onPress={() => {
              void Linking
                .openSettings();
            }}
          >
            <Ionicons
              name="warning-outline"
              size={20}
              color="#9a6516"
            />

            <Text
              style={
                styles.permissionText
              }
            >
              إذن الموقع مغلق. اضغط لفتحه من الإعدادات.
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityLabel="استخدام موقعي الحالي"
        style={({
          pressed,
        }) => [
          styles.currentLocationButton,

          pressed &&
            !isLocating &&
            styles.buttonPressed,
        ]}
        disabled={
          isLocating ||
          isConfirming
        }
        onPress={() => {
          void useCurrentLocation();
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
            size={24}
            color={
              BRAND_GREEN
            }
          />
        )}
      </Pressable>

      <View
        style={
          styles.bottomSheet
        }
      >
        <View
          style={
            styles.sheetHandle
          }
        />

        <View
          style={
            styles.instructionRow
          }
        >
          <View
            style={
              styles.instructionIcon
            }
          >
            <Ionicons
              name="location"
              size={25}
              color={
                BRAND_GREEN
              }
            />
          </View>

          <View
            style={
              styles.instructionContent
            }
          >
            <Text
              style={
                styles.instructionTitle
              }
            >
              حط العلامة على باب التوصيل
            </Text>

            <Text
              style={
                styles.instructionDescription
              }
            >
              هنحوّل الموقع إلى عنوان مكتوب تلقائيًا،
              وبعدها تقدر تضيف رقم العمارة والدور والشقة
              في صفحة إتمام الطلب.
            </Text>
          </View>
        </View>

        {selectedCoordinate ? (
          <View
            style={
              styles.selectedCard
            }
          >
            <Ionicons
              name="checkmark-circle"
              size={21}
              color={
                BRAND_GREEN
              }
            />

            <View
              style={
                styles.selectedContent
              }
            >
              <Text
                style={
                  styles.selectedTitle
                }
              >
                تم تحديد موقع
              </Text>

              <Text
                numberOfLines={1}
                style={
                  styles.selectedSubtitle
                }
              >
                {locationAddress &&
                hasSavedCoordinate &&
                selectedCoordinate
                  .latitude ===
                  locationLatitude &&
                selectedCoordinate
                  .longitude ===
                  locationLongitude
                  ? locationAddress
                  : `${selectedCoordinate.latitude.toFixed(
                      6,
                    )}, ${selectedCoordinate.longitude.toFixed(
                      6,
                    )}`}
              </Text>
            </View>
          </View>
        ) : (
          <View
            style={
              styles.emptySelectionCard
            }
          >
            <Text
              style={
                styles.emptySelectionText
              }
            >
              اضغط على المكان المطلوب داخل الخريطة.
            </Text>
          </View>
        )}

        <Pressable
          style={({
            pressed,
          }) => [
            styles.confirmButton,

            (!selectedCoordinate ||
              isConfirming) &&
              styles.confirmButtonDisabled,

            pressed &&
              selectedCoordinate &&
              !isConfirming &&
              styles.confirmButtonPressed,
          ]}
          disabled={
            !selectedCoordinate ||
            isConfirming
          }
          onPress={() => {
            void confirmLocation();
          }}
        >
          {isConfirming ? (
            <ActivityIndicator
              size="small"
              color="#ffffff"
            />
          ) : (
            <>
              <Ionicons
                name="checkmark-circle-outline"
                size={23}
                color="#ffffff"
              />

              <Text
                style={
                  styles.confirmButtonText
                }
              >
                تأكيد الموقع والمتابعة
              </Text>
            </>
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
        '#f3f3f3',

      flex: 1,
    },

    map: {
      ...StyleSheet
        .absoluteFillObject,
    },

    mapLoadingOverlay: {
      ...StyleSheet
        .absoluteFillObject,

      alignItems:
        'center',

      backgroundColor:
        '#f5f5f5',

      justifyContent:
        'center',

      zIndex:
        3,
    },

    mapLoadingText: {
      color:
        '#707070',

      fontSize:
        12,

      marginTop:
        10,
    },

    topOverlay: {
      left: 0,

      paddingHorizontal:
        18,

      paddingTop:
        48,

      position:
        'absolute',

      right: 0,

      top: 0,

      zIndex:
        5,
    },

    header: {
      alignItems:
        'center',

      backgroundColor:
        '#ffffff',

      borderRadius:
        22,

      elevation:
        7,

      flexDirection:
        'row',

      minHeight:
        70,

      paddingHorizontal:
        10,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 3,
      },

      shadowOpacity:
        0.12,

      shadowRadius:
        10,
    },

    headerButton: {
      alignItems:
        'center',

      backgroundColor:
        '#f5f5f5',

      borderRadius:
        22,

      height:
        44,

      justifyContent:
        'center',

      width:
        44,
    },

    headerTitleContainer: {
      alignItems:
        'center',

      flex:
        1,

      paddingHorizontal:
        8,
    },

    headerTitle: {
      color:
        '#202020',

      fontSize:
        18,

      fontWeight:
        '900',

      textAlign:
        'center',
    },

    headerSubtitle: {
      color:
        '#858585',

      fontSize:
        10,

      marginTop:
        3,

      textAlign:
        'center',
    },

    headerPlaceholder: {
      height:
        44,

      width:
        44,
    },

    permissionCard: {
      alignItems:
        'center',

      alignSelf:
        'center',

      backgroundColor:
        '#fff3d6',

      borderColor:
        '#f0d18a',

      borderRadius:
        14,

      borderWidth:
        1,

      flexDirection:
        'row',

      marginTop:
        10,

      maxWidth:
        420,

      paddingHorizontal:
        13,

      paddingVertical:
        10,
    },

    permissionText: {
      color:
        '#7a5a13',

      flex:
        1,

      fontSize:
        11,

      lineHeight:
        17,

      marginLeft:
        8,

      textAlign:
        'right',
    },

    currentLocationButton: {
      alignItems:
        'center',

      backgroundColor:
        '#ffffff',

      borderColor:
        '#e4e4e4',

      borderRadius:
        27,

      borderWidth:
        1,

      bottom:
        292,

      elevation:
        7,

      height:
        54,

      justifyContent:
        'center',

      position:
        'absolute',

      right:
        18,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 3,
      },

      shadowOpacity:
        0.12,

      shadowRadius:
        8,

      width:
        54,

      zIndex:
        5,
    },

    bottomSheet: {
      backgroundColor:
        '#ffffff',

      borderTopLeftRadius:
        29,

      borderTopRightRadius:
        29,

      bottom:
        0,

      elevation:
        18,

      left:
        0,

      paddingBottom:
        24,

      paddingHorizontal:
        20,

      paddingTop:
        10,

      position:
        'absolute',

      right:
        0,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: -4,
      },

      shadowOpacity:
        0.1,

      shadowRadius:
        15,

      zIndex:
        6,
    },

    sheetHandle: {
      alignSelf:
        'center',

      backgroundColor:
        '#d7d7d7',

      borderRadius:
        3,

      height:
        5,

      marginBottom:
        17,

      width:
        48,
    },

    instructionRow: {
      alignItems:
        'center',

      flexDirection:
        'row',
    },

    instructionIcon: {
      alignItems:
        'center',

      backgroundColor:
        BRAND_GREEN_SOFT,

      borderRadius:
        23,

      height:
        46,

      justifyContent:
        'center',

      width:
        46,
    },

    instructionContent: {
      flex:
        1,

      marginLeft:
        13,
    },

    instructionTitle: {
      color:
        '#222222',

      fontSize:
        16,

      fontWeight:
        '900',

      textAlign:
        'right',
    },

    instructionDescription: {
      color:
        '#737373',

      fontSize:
        10,

      lineHeight:
        17,

      marginTop:
        4,

      textAlign:
        'right',
    },

    selectedCard: {
      alignItems:
        'center',

      backgroundColor:
        BRAND_GREEN_SOFT,

      borderColor:
        '#d5f0e0',

      borderRadius:
        16,

      borderWidth:
        1,

      flexDirection:
        'row',

      marginTop:
        15,

      paddingHorizontal:
        13,

      paddingVertical:
        11,
    },

    selectedContent: {
      flex:
        1,

      marginLeft:
        9,
    },

    selectedTitle: {
      color:
        '#285d3e',

      fontSize:
        12,

      fontWeight:
        '800',

      textAlign:
        'right',
    },

    selectedSubtitle: {
      color:
        '#61806d',

      fontSize:
        10,

      marginTop:
        3,

      textAlign:
        'right',
    },

    emptySelectionCard: {
      alignItems:
        'center',

      backgroundColor:
        '#f7f7f7',

      borderRadius:
        16,

      marginTop:
        15,

      paddingHorizontal:
        13,

      paddingVertical:
        12,
    },

    emptySelectionText: {
      color:
        '#777777',

      fontSize:
        11,

      textAlign:
        'center',
    },

    confirmButton: {
      alignItems:
        'center',

      backgroundColor:
        BRAND_GREEN,

      borderRadius:
        28,

      flexDirection:
        'row',

      gap:
        9,

      height:
        58,

      justifyContent:
        'center',

      marginTop:
        15,
    },

    confirmButtonDisabled: {
      opacity:
        0.5,
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
        '#ffffff',

      fontSize:
        16,

      fontWeight:
        '900',
    },

    buttonPressed: {
      opacity:
        0.72,
    },
  });
