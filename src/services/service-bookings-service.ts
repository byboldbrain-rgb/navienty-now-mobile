import { supabase } from '../lib/supabase';
import {
  getServicePackageById,
} from './service-packages-service';

export type ServiceBookingStatus =
  | 'awaiting-whatsapp-send'
  | 'waiting-confirmation'
  | 'confirmed'
  | 'picked-up'
  | 'processing'
  | 'ready-for-delivery'
  | 'out-for-delivery'
  | 'delivered'
  | 'cancelled';

export type ServiceBooking = {
  id: string;
  bookingCode: string;

  servicePackageId: string;
  packageSlug: string;
  packageNameAr: string;
  packageNameEn: string | null;
  packagePrice: number;
  currencyCode: string;
  currencySymbol: string;
  packageImageUrl: string | null;

  paymentMethodId: string | null;
  paymentMethodNameAr: string;

  customerName: string;
  customerPhone: string;
  address: string;
  landmark: string | null;
  serviceAreaName: string | null;

  whatsappNumber: string;

  status: ServiceBookingStatus;
  cancellationReason: string | null;

  whatsappOpenedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateServiceBookingInput = {
  servicePackageId: string;

  /**
   * Compatibility snapshots from the current Checkout UI.
   *
   * IMPORTANT: createServiceBooking intentionally does NOT trust these
   * values for package identity or pricing. It reloads the active package
   * from Supabase using servicePackageId before writing the booking.
   * These fields remain temporarily so existing callers do not break while
   * the Checkout contract is migrated to the smaller server-authoritative
   * payload.
   */
  packageSlug: string;
  packageNameAr: string;
  packageNameEn?: string | null;
  packagePrice: number;
  currencyCode: string;
  currencySymbol: string;
  packageImageUrl?: string | null;

  paymentMethodId?: string | null;
  paymentMethodNameAr: string;

  customerName: string;
  customerPhone: string;
  address: string;
  landmark?: string | null;
  serviceAreaName?: string | null;

  whatsappNumber: string;
};

type ServiceBookingRow = {
  id: string;
  booking_code: string;

  service_package_id: string;
  package_slug: string;
  package_name_ar: string;
  package_name_en: string | null;
  package_price: number | string;
  currency_code: string;
  currency_symbol: string;
  package_image_url: string | null;

  payment_method_id: string | null;
  payment_method_name_ar: string;

  customer_name: string;
  customer_phone: string;
  address: string;
  landmark: string | null;
  service_area_name: string | null;

  whatsapp_number: string;

  status: ServiceBookingStatus;
  cancellation_reason: string | null;

  whatsapp_opened_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

const SERVICE_BOOKING_SELECT = [
  'id',
  'booking_code',

  'service_package_id',
  'package_slug',
  'package_name_ar',
  'package_name_en',
  'package_price',
  'currency_code',
  'currency_symbol',
  'package_image_url',

  'payment_method_id',
  'payment_method_name_ar',

  'customer_name',
  'customer_phone',
  'address',
  'landmark',
  'service_area_name',

  'whatsapp_number',

  'status',
  'cancellation_reason',

  'whatsapp_opened_at',
  'cancelled_at',
  'created_at',
  'updated_at',
].join(',');

function normalizeNullableText(
  value:
    | string
    | null
    | undefined,
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized.length > 0
    ? normalized
    : null;
}

function toMoney(
  value:
    | number
    | string
    | null
    | undefined,
): number {
  const numericValue =
    Number(value ?? 0);

  if (
    !Number.isFinite(
      numericValue,
    )
  ) {
    return 0;
  }

  return numericValue;
}

function mapServiceBooking(
  row: ServiceBookingRow,
): ServiceBooking {
  return {
    id: row.id,
    bookingCode:
      row.booking_code,

    servicePackageId:
      row.service_package_id,

    packageSlug:
      row.package_slug,

    packageNameAr:
      row.package_name_ar,

    packageNameEn:
      normalizeNullableText(
        row.package_name_en,
      ),

    packagePrice:
      toMoney(
        row.package_price,
      ),

    currencyCode:
      row.currency_code,

    currencySymbol:
      row.currency_symbol,

    packageImageUrl:
      normalizeNullableText(
        row.package_image_url,
      ),

    paymentMethodId:
      normalizeNullableText(
        row.payment_method_id,
      ),

    paymentMethodNameAr:
      row.payment_method_name_ar,

    customerName:
      row.customer_name,

    customerPhone:
      row.customer_phone,

    address:
      row.address,

    landmark:
      normalizeNullableText(
        row.landmark,
      ),

    serviceAreaName:
      normalizeNullableText(
        row.service_area_name,
      ),

    whatsappNumber:
      row.whatsapp_number,

    status:
      row.status,

    cancellationReason:
      normalizeNullableText(
        row.cancellation_reason,
      ),

    whatsappOpenedAt:
      row.whatsapp_opened_at,

    cancelledAt:
      row.cancelled_at,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}

function getServiceBookingsTable() {
  return (
    supabase as any
  )
    .schema('now')
    .from('service_bookings');
}

export async function createServiceBooking(
  input: CreateServiceBookingInput,
): Promise<ServiceBooking> {
  /**
   * Client-side hardening only: never trust package price/name/currency
   * snapshots supplied by Checkout. Reload the canonical active package
   * from Supabase and persist only those database values.
   *
   * This is intentionally NOT treated as the final security boundary.
   * Production must move creation and customer-owned reads/transitions to
   * authenticated database functions plus restrictive RLS. Until that
   * database migration is applied, direct table access still depends on the
   * policies configured in Supabase.
   */
  const canonicalPackage =
    await getServicePackageById(
      input.servicePackageId,
    );

  if (!canonicalPackage) {
    throw new Error(
      'الخدمة غير متاحة حاليًا أو تم إيقافها.',
    );
  }

  const {
    data,
    error,
  } = await getServiceBookingsTable()
    .insert({
      service_package_id:
        canonicalPackage.id,

      package_slug:
        canonicalPackage.slug,

      package_name_ar:
        canonicalPackage.nameAr,

      package_name_en:
        normalizeNullableText(
          canonicalPackage.nameEn,
        ),

      package_price:
        canonicalPackage.price,

      currency_code:
        canonicalPackage.currencyCode,

      currency_symbol:
        canonicalPackage.currencySymbol,

      package_image_url:
        normalizeNullableText(
          canonicalPackage.imageUrl,
        ),

      payment_method_id:
        normalizeNullableText(
          input.paymentMethodId,
        ),

      payment_method_name_ar:
        input.paymentMethodNameAr,

      customer_name:
        input.customerName.trim(),

      customer_phone:
        input.customerPhone.trim(),

      address:
        input.address.trim(),

      landmark:
        normalizeNullableText(
          input.landmark,
        ),

      service_area_name:
        normalizeNullableText(
          input.serviceAreaName,
        ),

      whatsapp_number:
        input.whatsappNumber.trim(),

      status:
        'awaiting-whatsapp-send',
    })
    .select(
      SERVICE_BOOKING_SELECT,
    )
    .single();

  if (error) {
    throw new Error(
      `Supabase service booking create failed: ${error.message}`,
    );
  }

  return mapServiceBooking(
    data as ServiceBookingRow,
  );
}

export async function markServiceBookingWhatsAppOpened(
  bookingId: string,
): Promise<ServiceBooking> {
  const {
    data,
    error,
  } = await getServiceBookingsTable()
    .update({
      status:
        'waiting-confirmation',

      whatsapp_opened_at:
        new Date().toISOString(),

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      'id',
      bookingId,
    )
    .select(
      SERVICE_BOOKING_SELECT,
    )
    .single();

  if (error) {
    throw new Error(
      `Supabase service booking confirmation failed: ${error.message}`,
    );
  }

  return mapServiceBooking(
    data as ServiceBookingRow,
  );
}

export async function cancelServiceBookingAfterOpenFailure(
  bookingId: string,
  reason: string,
): Promise<void> {
  const nowIso =
    new Date().toISOString();

  const {
    error,
  } = await getServiceBookingsTable()
    .update({
      status:
        'cancelled',

      cancellation_reason:
        reason,

      cancelled_at:
        nowIso,

      updated_at:
        nowIso,
    })
    .eq(
      'id',
      bookingId,
    );

  if (error) {
    throw new Error(
      `Supabase service booking cancellation failed: ${error.message}`,
    );
  }
}

export async function getServiceBookingById(
  bookingId: string,
): Promise<ServiceBooking | null> {
  const normalizedId =
    bookingId.trim();

  if (!normalizedId) {
    return null;
  }

  const {
    data,
    error,
  } = await getServiceBookingsTable()
    .select(
      SERVICE_BOOKING_SELECT,
    )
    .eq(
      'id',
      normalizedId,
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Supabase service booking fetch failed: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  return mapServiceBooking(
    data as ServiceBookingRow,
  );
}

export default getServiceBookingById;
