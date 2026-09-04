import { supabase } from '../lib/supabase';

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
   * Legacy Checkout snapshots kept temporarily so existing callers compile.
   * They are intentionally ignored by createServiceBooking. Package identity,
   * price, currency, payment method name, and WhatsApp number are resolved by
   * the database RPC from canonical tables.
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
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0
    ? normalized
    : null;
}

function toMoney(
  value: number | string | null | undefined,
): number {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue)
    ? numericValue
    : 0;
}

function mapServiceBooking(
  row: ServiceBookingRow,
): ServiceBooking {
  return {
    id: row.id,
    bookingCode: row.booking_code,
    servicePackageId: row.service_package_id,
    packageSlug: row.package_slug,
    packageNameAr: row.package_name_ar,
    packageNameEn: normalizeNullableText(row.package_name_en),
    packagePrice: toMoney(row.package_price),
    currencyCode: row.currency_code,
    currencySymbol: row.currency_symbol,
    packageImageUrl: normalizeNullableText(row.package_image_url),
    paymentMethodId: normalizeNullableText(row.payment_method_id),
    paymentMethodNameAr: row.payment_method_name_ar,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    address: row.address,
    landmark: normalizeNullableText(row.landmark),
    serviceAreaName: normalizeNullableText(row.service_area_name),
    whatsappNumber: row.whatsapp_number,
    status: row.status,
    cancellationReason: normalizeNullableText(row.cancellation_reason),
    whatsappOpenedAt: row.whatsapp_opened_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getServiceBookingsTable() {
  return (supabase as any)
    .schema('now')
    .from('service_bookings');
}

export async function createServiceBooking(
  input: CreateServiceBookingInput,
): Promise<ServiceBooking> {
  const paymentMethodId =
    normalizeNullableText(input.paymentMethodId);

  if (!paymentMethodId) {
    throw new Error(
      'اختر طريقة الدفع قبل تأكيد الحجز.',
    );
  }

  const { data, error } =
    await supabase.rpc(
      'create_service_booking',
      {
        p_service_package_id:
          input.servicePackageId.trim(),
        p_payment_method_id:
          paymentMethodId,
        p_customer_name:
          input.customerName.trim(),
        p_customer_phone:
          input.customerPhone.trim(),
        p_address:
          input.address.trim(),
        p_landmark:
          normalizeNullableText(input.landmark),
        p_service_area_name:
          normalizeNullableText(input.serviceAreaName),
      },
    );

  if (error) {
    throw new Error(
      `Supabase service booking create failed: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      'Supabase service booking create returned no data.',
    );
  }

  return mapServiceBooking(
    data as ServiceBookingRow,
  );
}

export async function markServiceBookingWhatsAppOpened(
  bookingId: string,
): Promise<ServiceBooking> {
  const { data, error } =
    await supabase.rpc(
      'mark_service_booking_whatsapp_opened',
      {
        p_booking_id: bookingId.trim(),
      },
    );

  if (error) {
    throw new Error(
      `Supabase service booking confirmation failed: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      'Supabase service booking confirmation returned no data.',
    );
  }

  return mapServiceBooking(
    data as ServiceBookingRow,
  );
}

/**
 * Submits a saved service booking without requiring an external messaging
 * app. The database RPC is owner-scoped and idempotent for safe retries.
 */
export async function submitServiceBookingForConfirmation(
  bookingId: string,
): Promise<ServiceBooking> {
  const { data, error } =
    await supabase.rpc(
      'submit_service_booking_for_confirmation',
      {
        p_booking_id:
          bookingId.trim(),
      },
    );

  if (error) {
    throw new Error(
      `Supabase service booking submission failed: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      'Supabase service booking submission returned no data.',
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
  const { data, error } =
    await supabase.rpc(
      'cancel_service_booking_open_failure',
      {
        p_booking_id: bookingId.trim(),
        p_reason:
          normalizeNullableText(reason) ??
          'whatsapp_open_failed',
      },
    );

  if (error) {
    throw new Error(
      `Supabase service booking cancellation failed: ${error.message}`,
    );
  }

  if (data !== true) {
    throw new Error(
      'تعذر إلغاء الحجز المعلّق.',
    );
  }
}

export async function getServiceBookingById(
  bookingId: string,
): Promise<ServiceBooking | null> {
  const normalizedId = bookingId.trim();

  if (!normalizedId) {
    return null;
  }

  const { data, error } =
    await getServiceBookingsTable()
      .select(SERVICE_BOOKING_SELECT)
      .eq('id', normalizedId)
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
