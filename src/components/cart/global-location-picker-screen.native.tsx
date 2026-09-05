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
  getDeliveryLocationErrorMessage,
  resolveDeliveryLocation,
} from '../../services/delivery-location-service';
import {
  useCustomerStore,
} from '../../store/customer-store';
import {
  NAVIENTY_NOW_COLORS,
} from '../../theme/navienty-now-theme';

const FALLBACK_REGION: Region = {
  latitude: 27.18858603,
  longitude: 31.16372869,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
};

function buildAddress(
  address: Location.LocationGeocodedAddress,
) {
  const formatted =
    address.formattedAddress?.trim();

  if (formatted) {
    return formatted;
  }

  return [
    address.name,
    address.street,
    address.district,
    address.city,
    address.region,
    address.country,
  ]
    .filter(Boolean)
    .join('، ');
}

export default function GlobalLocationPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);

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

  const [coordinate, setCoordinate] =
    useState(savedCoordinate);
  const [isLocating, setIsLocating] =
    useState(false);
  const [isConfirming, setIsConfirming] =
    useState(false);

  const initialRegion: Region =
    savedCoordinate
      ? {
          ...savedCoordinate,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        }
      : FALLBACK_REGION;

  async function requestCurrentLocation() {
    try {
      setIsLocating(true);
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'السماح بالموقع مطلوب',
          'اسمح لـ Navienty Now باستخدام موقعك لتحديد مكان التوصيل.',
        );
        return;
      }

      const position =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

      const next = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setCoordinate(next);
      mapRef.current?.animateToRegion(
        {
          ...next,
          latitudeDelta: 0.009,
          longitudeDelta: 0.009,
        },
        280,
      );
    } catch (error) {
      Alert.alert(
        'تعذر تحديد الموقع',
        error instanceof Error
          ? error.message
          : 'حاول مرة أخرى.',
      );
    } finally {
      setIsLocating(false);
    }
  }

  useEffect(() => {
    if (!savedCoordinate) {
      void requestCurrentLocation();
    }
  }, []);

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
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
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

      const addresses =
        await Location.reverseGeocodeAsync(
          coordinate,
        );
      const address = addresses[0]
        ? buildAddress(addresses[0])
        : '';

      if (!address) {
        Alert.alert(
          'تعذر قراءة العنوان',
          'حرّك الخريطة قليلًا وحاول مرة أخرى.',
        );
        return;
      }

      setDeliveryLocation({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        address,
        serviceAreaId: resolution.serviceAreaId,
        serviceAreaName: resolution.serviceAreaName,
        cityId: resolution.cityId,
        cityName: resolution.cityName,
      });

      router.replace('/global-checkout');
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
          { paddingTop: Math.max(insets.top, 8) },
        ]}
      >
        <Pressable
          accessibilityLabel="رجوع"
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={NAVIENTY_NOW_COLORS.text}
          />
        </Pressable>
        <Text style={styles.headerTitle}>
          مكان التوصيل
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={
            Platform.OS === 'android'
              ? PROVIDER_GOOGLE
              : undefined
          }
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
          onRegionChangeComplete={(region) =>
            setCoordinate({
              latitude: region.latitude,
              longitude: region.longitude,
            })
          }
        />

        <View pointerEvents="none" style={styles.pinWrap}>
          <Ionicons
            name="location"
            size={42}
            color={NAVIENTY_NOW_COLORS.primary}
          />
        </View>

        <Pressable
          accessibilityLabel="موقعي الحالي"
          style={styles.locateButton}
          disabled={isLocating}
          onPress={() => {
            void requestCurrentLocation();
          }}
        >
          {isLocating ? (
            <ActivityIndicator
              size="small"
              color={NAVIENTY_NOW_COLORS.primary}
            />
          ) : (
            <Ionicons
              name="navigate"
              size={21}
              color={NAVIENTY_NOW_COLORS.primary}
            />
          )}
        </Pressable>
      </View>

      <View
        style={[
          styles.bottomCard,
          { paddingBottom: Math.max(insets.bottom, 14) },
        ]}
      >
        <Text style={styles.bottomTitle}>
          حدد مكان استلام الطلب
        </Text>
        <Text style={styles.bottomDescription}>
          نفس المكان هيستخدم لكل المتاجر الموجودة في السلة.
        </Text>
        <Pressable
          disabled={isConfirming}
          style={({ pressed }) => [
            styles.confirmButton,
            isConfirming && styles.confirmButtonDisabled,
            pressed && !isConfirming && styles.pressed,
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
            <Text style={styles.confirmButtonText}>
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
    color: NAVIENTY_NOW_COLORS.text,
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
  bottomCard: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#EEEEEE',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 15,
  },
  bottomTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  bottomDescription: {
    color: NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'right',
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.primary,
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
    transform: [{ scale: 0.99 }],
  },
});
