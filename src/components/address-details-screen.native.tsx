import { Ionicons } from '@expo/vector-icons';
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'slide_from_right' as const,
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

function digitsOnly(
  value: string,
) {
  return value.replace(/\D/g, '');
}

function getSubscriberDigits(
  phoneNumber: string,
) {
  const digits =
    digitsOnly(phoneNumber);

  if (
    /^01[0125]\d{8}$/.test(
      digits,
    )
  ) {
    return digits.slice(1);
  }

  if (
    /^201[0125]\d{8}$/.test(
      digits,
    )
  ) {
    return digits.slice(2);
  }

  if (
    /^1[0125]\d{8}$/.test(
      digits,
    )
  ) {
    return digits;
  }

  return digits.slice(0, 10);
}

function buildDetailedAddress(
  input: {
    buildingName: string;
    locationAddress: string;
  },
) {
  const parts: string[] = [];

  const buildingName =
    input.buildingName.trim();

  const locationAddress =
    input.locationAddress.trim();

  if (buildingName) {
    parts.push(
      `المبنى: ${buildingName}`,
    );
  }

  if (locationAddress) {
    parts.push(
      locationAddress,
    );
  }

  return parts.join('، ');
}

export default function AddressDetailsScreen() {
  const router = useRouter();
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

  const serviceAreaName =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaName,
    );

  const cityName =
    useCustomerStore(
      (state) =>
        state.locationCityName,
    );

  const savedPhoneNumber =
    useCustomerStore(
      (state) =>
        state.phoneNumber,
    );

  const savedBuildingName =
    useCustomerStore(
      (state) =>
        state.buildingName,
    );

  const savedDeliveryInstructions =
    useCustomerStore(
      (state) =>
        state.deliveryInstructions,
    );

  const setCustomerData =
    useCustomerStore(
      (state) =>
        state.setCustomerData,
    );

  const [
    buildingName,
    setBuildingName,
  ] = useState(
    savedBuildingName,
  );

  const [
    phoneSubscriber,
    setPhoneSubscriber,
  ] = useState(
    getSubscriberDigits(
      savedPhoneNumber,
    ),
  );

  const [
    deliveryInstructions,
    setDeliveryInstructions,
  ] = useState(
    savedDeliveryInstructions,
  );

  const [
    submitted,
    setSubmitted,
  ] = useState(false);

  const hasCoordinate =
    typeof locationLatitude ===
      'number' &&
    Number.isFinite(
      locationLatitude,
    ) &&
    typeof locationLongitude ===
      'number' &&
    Number.isFinite(
      locationLongitude,
    );

  const mapRegion =
    useMemo<Region | null>(
      () => {
        if (!hasCoordinate) {
          return null;
        }

        return {
          latitude:
            locationLatitude!,

          longitude:
            locationLongitude!,

          latitudeDelta:
            0.007,

          longitudeDelta:
            0.007,
        };
      },
      [
        hasCoordinate,
        locationLatitude,
        locationLongitude,
      ],
    );

  const areaDisplayName = [
    serviceAreaName,
    cityName,
  ]
    .filter(Boolean)
    .join('، ');

  const cleanSubscriber =
    digitsOnly(
      phoneSubscriber,
    ).slice(
      0,
      10,
    );

  const validation = {
    building:
      buildingName
        .trim()
        .length >= 1,

    phone:
      /^1[0125]\d{8}$/.test(
        cleanSubscriber,
      ),
  };

  const formIsValid =
    Object.values(
      validation,
    ).every(Boolean);

  function editPin() {
    if (!storeId) {
      Alert.alert(
        'تعذر تعديل الموقع',
        'تعذر تحديد المتجر الخاص بهذا الطلب. ارجع إلى السلة وحاول مرة أخرى.',
      );

      return;
    }

    /*
     * Important:
     *
     * Use push, not replace.
     *
     * This keeps Address Details alive in the navigation stack,
     * including everything the customer has typed locally.
     *
     * Address Details -> Map -> Back to same Address Details.
     */
    router.push({
      pathname:
        '/location-picker',

      params: {
        storeId,

        source:
          'address-details',
      },
    });
  }

  function saveAddress() {
    setSubmitted(true);

    if (!hasCoordinate) {
      Alert.alert(
        'موقع التوصيل غير موجود',
        'ارجع إلى الخريطة وحدد موقع التوصيل أولًا.',
      );

      return;
    }

    if (!storeId) {
      Alert.alert(
        'تعذر تحديد المتجر',
        'ارجع إلى السلة وحاول مرة أخرى.',
      );

      return;
    }

    if (!formIsValid) {
      return;
    }

    const finalPhoneNumber =
      `0${cleanSubscriber}`;

    const finalAddress =
      buildDetailedAddress({
        buildingName,
        locationAddress,
      });

    setCustomerData({
      phoneNumber:
        finalPhoneNumber,

      address:
        finalAddress,

      buildingName:
        buildingName.trim(),

      apartmentNumber:
        '',

      floor:
        '',

      street:
        '',

      addressLabel:
        '',

      deliveryInstructions:
        deliveryInstructions.trim(),

      /*
       * Checkout already submits landmark.
       * Reuse it for delivery instructions.
       */
      landmark:
        deliveryInstructions.trim(),
    });

    if (
      source ===
      'checkout'
    ) {
      router.back();

      return;
    }

    router.replace({
      pathname:
        '/checkout',

      params: {
        storeId,
      },
    });
  }

  if (
    !hasCoordinate ||
    !mapRegion
  ) {
    return (
      <View
        style={
          styles.errorScreen
        }
      >
        <Stack.Screen
          options={
            SCREEN_OPTIONS
          }
        />

        <View
          style={
            styles.errorIcon
          }
        >
          <Ionicons
            name="location-outline"
            size={28}
            color={
              BRAND_GREEN
            }
          />
        </View>

        <Text
          style={
            styles.errorTitle
          }
        >
          حدد موقع التوصيل أولًا
        </Text>

        <Text
          style={
            styles.errorDescription
          }
        >
          نحتاج إلى Pin صالح قبل إضافة تفاصيل العنوان.
        </Text>

        <Pressable
          style={({
            pressed,
          }) => [
            styles.errorButton,

            pressed &&
              styles.buttonPressed,
          ]}
          onPress={
            editPin
          }
        >
          <Text
            style={
              styles.errorButtonText
            }
          >
            فتح الخريطة
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS ===
        'ios'
          ? 'padding'
          : undefined
      }
    >
      <Stack.Screen
        options={
          SCREEN_OPTIONS
        }
      />

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
            name="arrow-forward"
            size={20}
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
          عنوان جديد
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <ScrollView
        style={
          styles.scrollView
        }
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom:
              Math.max(
                insets.bottom,
                12,
              ) + 96,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.mapPreviewCard
          }
        >
          <MapView
            provider={
              PROVIDER_GOOGLE
            }
            style={
              styles.mapPreview
            }
            region={
              mapRegion
            }
            scrollEnabled={
              false
            }
            zoomEnabled={
              false
            }
            rotateEnabled={
              false
            }
            pitchEnabled={
              false
            }
            toolbarEnabled={
              false
            }
            showsCompass={
              false
            }
            showsMyLocationButton={
              false
            }
            pointerEvents="none"
          >
            <Marker
              coordinate={{
                latitude:
                  locationLatitude!,

                longitude:
                  locationLongitude!,
              }}
            >
              <View
                style={
                  styles.mapPinWrap
                }
              >
                <Ionicons
                  name="location"
                  size={30}
                  color={
                    BRAND_GREEN
                  }
                />
              </View>
            </Marker>
          </MapView>
        </View>

        <View
          style={
            styles.areaCard
          }
        >
          <Pressable
            hitSlop={10}
            style={({
              pressed,
            }) => [
              styles.areaEditButton,

              pressed &&
                styles.buttonPressed,
            ]}
            onPress={
              editPin
            }
          >
            <Text
              style={
                styles.areaEditText
              }
            >
              تعديل
            </Text>
          </Pressable>

          <View
            style={
              styles.areaCopy
            }
          >
            <Text
              style={
                styles.areaLabel
              }
            >
              المنطقة
            </Text>

            <Text
              style={
                styles.areaValue
              }
              numberOfLines={2}
            >
              {areaDisplayName ||
                locationAddress ||
                'منطقة التوصيل'}
            </Text>
          </View>

          <View
            style={
              styles.areaIconWrap
            }
          >
            <Ionicons
              name="location-outline"
              size={19}
              color={
                BRAND_GREEN
              }
            />
          </View>
        </View>

        <View
          style={
            styles.formSection
          }
        >
          <View
            style={
              styles.fieldBlock
            }
          >
            <TextInput
              value={
                buildingName
              }
              placeholder="اسم المبنى"
              placeholderTextColor={
                NAVIENTY_NOW_COLORS.textMuted
              }
              style={[
                styles.input,

                submitted &&
                  !validation.building &&
                  styles.inputError,
              ]}
              textAlign="right"
              onChangeText={
                setBuildingName
              }
            />

            {submitted &&
            !validation.building ? (
              <Text
                style={
                  styles.errorText
                }
              >
                اكتب اسم المبنى.
              </Text>
            ) : null}
          </View>

          <View
            style={
              styles.fieldBlock
            }
          >
            <View
              style={[
                styles.phoneField,

                submitted &&
                  !validation.phone &&
                  styles.inputError,
              ]}
            >
              <View
                style={
                  styles.flagCircle
                }
              >
                <Text
                  style={
                    styles.flagEmoji
                  }
                >
                  🇪🇬
                </Text>
              </View>

              <View
                style={
                  styles.phoneDivider
                }
              />

              <TextInput
                value={
                  phoneSubscriber
                }
                placeholder="10xxxxxxxx"
                placeholderTextColor={
                  NAVIENTY_NOW_COLORS.textMuted
                }
                style={
                  styles.phoneInput
                }
                keyboardType="phone-pad"
                maxLength={10}
                textAlign="left"
                onChangeText={(
                  value,
                ) => {
                  setPhoneSubscriber(
                    digitsOnly(
                      value,
                    ).slice(
                      0,
                      10,
                    ),
                  );
                }}
              />

              <Text
                style={
                  styles.phonePrefix
                }
              >
                +20
              </Text>
            </View>

            {submitted &&
            !validation.phone ? (
              <Text
                style={
                  styles.errorText
                }
              >
                اكتب رقم موبايل مصري صحيح.
              </Text>
            ) : null}
          </View>

          <TextInput
            value={
              deliveryInstructions
            }
            placeholder="إرشادات إضافية (اختياري)"
            placeholderTextColor={
              NAVIENTY_NOW_COLORS.textMuted
            }
            style={[
              styles.input,
              styles.multilineInput,
            ]}
            multiline
            numberOfLines={3}
            textAlign="right"
            textAlignVertical="top"
            onChangeText={
              setDeliveryInstructions
            }
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom:
              Math.max(
                insets.bottom,
                8,
              ) + 4,
          },
        ]}
      >
        <Pressable
          style={({
            pressed,
          }) => [
            styles.saveButton,

            pressed &&
              styles.saveButtonPressed,
          ]}
          onPress={
            saveAddress
          }
        >
          <Text
            style={
              styles.saveButtonText
            }
          >
            حفظ العنوان
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.page,
      flex: 1,
    },

    header: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS.white,

      borderBottomColor:
        NAVIENTY_NOW_COLORS.border,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      flexDirection:
        'row-reverse',

      justifyContent:
        'space-between',

      minHeight:
        66,

      paddingBottom:
        8,

      paddingHorizontal:
        16,
    },

    headerButton: {
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

      width:
        42,
    },

    headerTitle: {
      color:
        NAVIENTY_NOW_COLORS.text,

      fontSize:
        19,

      fontWeight:
        '800',

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    headerSpacer: {
      height:
        42,

      width:
        42,
    },

    scrollView: {
      flex:
        1,
    },

    scrollContent: {
      paddingHorizontal:
        16,

      paddingTop:
        12,
    },

    mapPreviewCard: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.surface,

      borderRadius:
        16,

      height:
        142,

      overflow:
        'hidden',

      width:
        '100%',
    },

    mapPreview: {
      position:
        'absolute',

      bottom:
        0,

      left:
        0,

      right:
        0,

      top:
        0,
    },

    mapPinWrap: {
      alignItems:
        'center',

      justifyContent:
        'center',
    },

    areaCard: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS.white,

      borderColor:
        NAVIENTY_NOW_COLORS.border,

      borderRadius:
        18,

      borderWidth:
        1,

      flexDirection:
        'row',

      marginTop:
        10,

      minHeight:
        86,

      paddingHorizontal:
        14,
    },

    areaEditButton: {
      paddingHorizontal:
        4,

      paddingVertical:
        8,
    },

    areaEditText: {
      color:
        BRAND_GREEN,

      fontSize:
        13,

      fontWeight:
        '800',
    },

    areaCopy: {
      alignItems:
        'flex-end',

      flex:
        1,

      marginHorizontal:
        12,
    },

    areaLabel: {
      color:
        NAVIENTY_NOW_COLORS.text,

      fontSize:
        15,

      fontWeight:
        '800',

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    areaValue: {
      color:
        NAVIENTY_NOW_COLORS.textSecondary,

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        3,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    areaIconWrap: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS.primaryPale,

      borderRadius:
        18,

      height:
        36,

      justifyContent:
        'center',

      width:
        36,
    },

    formSection: {
      marginTop:
        18,
    },

    fieldBlock: {
      marginBottom:
        12,
    },

    input: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.white,

      borderColor:
        NAVIENTY_NOW_COLORS.border,

      borderRadius:
        16,

      borderWidth:
        1,

      color:
        NAVIENTY_NOW_COLORS.text,

      fontSize:
        14,

      minHeight:
        60,

      paddingHorizontal:
        16,

      writingDirection:
        'rtl',
    },

    inputError: {
      borderColor:
        NAVIENTY_NOW_COLORS.error,
    },

    errorText: {
      color:
        NAVIENTY_NOW_COLORS.error,

      fontSize:
        10,

      marginTop:
        5,

      textAlign:
        'right',

      writingDirection:
        'rtl',
    },

    phoneField: {
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

      flexDirection:
        'row-reverse',

      minHeight:
        60,

      paddingHorizontal:
        14,
    },

    flagCircle: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS.surface,

      borderRadius:
        15,

      height:
        30,

      justifyContent:
        'center',

      width:
        30,
    },

    flagEmoji: {
      fontSize:
        15,
    },

    phoneDivider: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.border,

      height:
        34,

      marginHorizontal:
        10,

      width:
        1,
    },

    phoneInput: {
      color:
        NAVIENTY_NOW_COLORS.text,

      flex:
        1,

      fontSize:
        14,

      minHeight:
        54,

      paddingHorizontal:
        6,
    },

    phonePrefix: {
      color:
        NAVIENTY_NOW_COLORS.text,

      fontSize:
        14,

      fontWeight:
        '600',

      marginLeft:
        6,
    },

    multilineInput: {
      minHeight:
        78,

      paddingTop:
        16,
    },

    bottomBar: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.white,

      borderTopColor:
        NAVIENTY_NOW_COLORS.border,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      bottom:
        0,

      left:
        0,

      paddingHorizontal:
        16,

      paddingTop:
        10,

      position:
        'absolute',

      right:
        0,
    },

    saveButton: {
      alignItems:
        'center',

      backgroundColor:
        BRAND_GREEN,

      borderRadius:
        24,

      justifyContent:
        'center',

      minHeight:
        52,
    },

    saveButtonPressed: {
      backgroundColor:
        BRAND_GREEN_DARK,

      transform: [
        {
          scale:
            0.993,
        },
      ],
    },

    saveButtonText: {
      color:
        NAVIENTY_NOW_COLORS.white,

      fontSize:
        15,

      fontWeight:
        '900',

      writingDirection:
        'rtl',
    },

    buttonPressed: {
      opacity:
        0.7,
    },

    errorScreen: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS.page,

      flex:
        1,

      justifyContent:
        'center',

      paddingHorizontal:
        28,
    },

    errorIcon: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS.primaryPale,

      borderRadius:
        28,

      height:
        56,

      justifyContent:
        'center',

      width:
        56,
    },

    errorTitle: {
      color:
        NAVIENTY_NOW_COLORS.text,

      fontSize:
        18,

      fontWeight:
        '900',

      marginTop:
        14,

      textAlign:
        'center',
    },

    errorDescription: {
      color:
        NAVIENTY_NOW_COLORS.textSecondary,

      fontSize:
        12,

      lineHeight:
        19,

      marginTop:
        6,

      maxWidth:
        320,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    errorButton: {
      alignItems:
        'center',

      backgroundColor:
        BRAND_GREEN,

      borderRadius:
        18,

      justifyContent:
        'center',

      marginTop:
        18,

      minHeight:
        46,

      minWidth:
        150,

      paddingHorizontal:
        18,
    },

    errorButtonText: {
      color:
        NAVIENTY_NOW_COLORS.white,

      fontSize:
        13,

      fontWeight:
        '900',
    },
  });
