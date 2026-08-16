import { supabase } from '../lib/supabase';

type NumericValue =
  | number
  | string
  | null
  | undefined;

function toNullableNumber(
  value: NumericValue,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : null;
}

export type DeliveryLocationResolution = {
  serviceable: boolean;
  reason: string | null;

  latitude: number;
  longitude: number;

  serviceAreaId: string | null;
  serviceAreaCode: string | null;
  serviceAreaName: string | null;
  serviceAreaNameEn: string | null;

  cityId: string | null;
  cityName: string | null;
  cityNameEn: string | null;

  storeId: string | null;
  storeAvailable: boolean | null;

  deliveryFee: number | null;
  minimumOrder: number | null;
  estimatedDeliveryMinutes: number | null;
};

type RawDeliveryLocationResolution = {
  serviceable?: boolean;
  reason?: string | null;

  latitude?: NumericValue;
  longitude?: NumericValue;

  service_area_id?: string | null;
  service_area_code?: string | null;
  service_area_name_ar?: string | null;
  service_area_name_en?: string | null;

  city_id?: string | null;
  city_name_ar?: string | null;
  city_name_en?: string | null;

  store_id?: string | null;
  store_available?: boolean | null;

  delivery_fee?: NumericValue;
  minimum_order_amount?: NumericValue;
  estimated_delivery_minutes?: NumericValue;
};

export function getDeliveryLocationErrorMessage(
  reason: string | null | undefined,
): string {
  switch (reason) {
    case 'outside_service_area':
      return 'الموقع المحدد خارج نطاق توصيل Navienty Now حاليًا.';

    case 'store_not_available':
      return 'المتجر مغلق أو غير متاح حاليًا.';

    case 'store_not_available_in_service_area':
      return 'المتجر لا يوصّل إلى الموقع الذي اخترته.';

    default:
      return 'تعذر التأكد من توفر التوصيل إلى هذا الموقع.';
  }
}

export async function resolveDeliveryLocation(
  input: {
    latitude: number;
    longitude: number;
    storeId?: string | null;
  },
): Promise<DeliveryLocationResolution> {
  if (
    !Number.isFinite(input.latitude) ||
    input.latitude < -90 ||
    input.latitude > 90 ||
    !Number.isFinite(input.longitude) ||
    input.longitude < -180 ||
    input.longitude > 180
  ) {
    throw new Error(
      'إحداثيات موقع التوصيل غير صالحة.',
    );
  }

  const { data, error } = await supabase.rpc(
    'resolve_delivery_location',
    {
      p_latitude: input.latitude,
      p_longitude: input.longitude,
      p_store_id: input.storeId ?? null,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
        'تعذر التحقق من منطقة التوصيل.',
    );
  }

  if (!data || typeof data !== 'object') {
    throw new Error(
      'لم ترجع قاعدة البيانات نتيجة صالحة لموقع التوصيل.',
    );
  }

  const raw =
    data as RawDeliveryLocationResolution;

  return {
    serviceable:
      raw.serviceable === true,

    reason:
      raw.reason ?? null,

    latitude:
      toNullableNumber(raw.latitude) ??
      input.latitude,

    longitude:
      toNullableNumber(raw.longitude) ??
      input.longitude,

    serviceAreaId:
      raw.service_area_id ?? null,

    serviceAreaCode:
      raw.service_area_code ?? null,

    serviceAreaName:
      raw.service_area_name_ar ?? null,

    serviceAreaNameEn:
      raw.service_area_name_en ?? null,

    cityId:
      raw.city_id ?? null,

    cityName:
      raw.city_name_ar ?? null,

    cityNameEn:
      raw.city_name_en ?? null,

    storeId:
      raw.store_id ??
      input.storeId ??
      null,

    storeAvailable:
      typeof raw.store_available ===
      'boolean'
        ? raw.store_available
        : null,

    deliveryFee:
      toNullableNumber(
        raw.delivery_fee,
      ),

    minimumOrder:
      toNullableNumber(
        raw.minimum_order_amount,
      ),

    estimatedDeliveryMinutes:
      toNullableNumber(
        raw.estimated_delivery_minutes,
      ),
  };
}
