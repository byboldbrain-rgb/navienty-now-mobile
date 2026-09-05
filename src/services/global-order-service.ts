import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createClientRequestId,
} from '../domain/order-idempotency';
import {
  ensureAppSession,
} from './anonymous-auth-service';
import { supabase } from '../lib/supabase';
import type {
  CreateGlobalOrderGroupInput,
  GlobalOrderGroup,
} from '../types/global-order';

const PENDING_GROUP_KEY =
  '@navienty-now/pending-global-order-group-v1';
const PENDING_GROUP_MAX_AGE_MS =
  10 * 60 * 1000;

type PendingGroupAttempt = {
  clientRequestId: string;
  fingerprint: string;
  createdAt: number;
};

type RawGlobalOrderGroup = {
  id?: string;
  group_code?: string;
  access_token?: string;
  status?: string;
  subtotal?: number | string;
  delivery_fee?: number | string;
  payment_processing_fee?: number | string;
  total_amount?: number | string;
  currency_code?: string;
  currency_symbol?: string;
  whatsapp_number?: string | null;
  whatsapp_message?: string | null;
  orders?: Array<{
    id?: string;
    order_code?: string;
    access_token?: string;
    store_id?: string;
    store_name?: string;
    subtotal?: number | string;
    delivery_fee?: number | string;
    payment_processing_fee?: number | string;
    total_amount?: number | string;
  }>;
};

function normalizeNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric)
    ? numeric
    : 0;
}

function fingerprintInput(
  input: CreateGlobalOrderGroupInput,
) {
  return JSON.stringify({
    latitude: input.deliveryLatitude,
    longitude: input.deliveryLongitude,
    paymentMethodId: input.paymentMethodId,
    customerPhone: input.customerPhone,
    stores: input.stores.map((store) => ({
      storeId: store.storeId,
      items: store.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        printJob: item.printJob ?? null,
      })),
    })),
  });
}

function parsePending(
  value: string | null,
): PendingGroupAttempt | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as
      Partial<PendingGroupAttempt>;

    if (
      typeof parsed.clientRequestId !== 'string' ||
      typeof parsed.fingerprint !== 'string' ||
      typeof parsed.createdAt !== 'number'
    ) {
      return null;
    }

    return {
      clientRequestId: parsed.clientRequestId,
      fingerprint: parsed.fingerprint,
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

async function getAttempt(
  input: CreateGlobalOrderGroupInput,
) {
  const fingerprint =
    fingerprintInput(input);
  const now = Date.now();

  try {
    const existing = parsePending(
      await AsyncStorage.getItem(
        PENDING_GROUP_KEY,
      ),
    );

    if (
      existing &&
      existing.fingerprint === fingerprint &&
      now - existing.createdAt >= 0 &&
      now - existing.createdAt <=
        PENDING_GROUP_MAX_AGE_MS
    ) {
      return existing;
    }
  } catch {
    // Continue with an in-process request id.
  }

  const attempt: PendingGroupAttempt = {
    clientRequestId: createClientRequestId(),
    fingerprint,
    createdAt: now,
  };

  try {
    await AsyncStorage.setItem(
      PENDING_GROUP_KEY,
      JSON.stringify(attempt),
    );
  } catch {
    // Idempotency still exists server-side for this request id.
  }

  return attempt;
}

function mapGroup(
  raw: RawGlobalOrderGroup,
): GlobalOrderGroup {
  if (
    !raw.id ||
    !raw.group_code ||
    !raw.access_token
  ) {
    throw new Error(
      'لم ترجع قاعدة البيانات بيانات الطلب المجمّع بشكل صحيح.',
    );
  }

  return {
    id: raw.id,
    groupCode: raw.group_code,
    accessToken: raw.access_token,
    status: raw.status ?? 'created',
    subtotal: normalizeNumber(raw.subtotal),
    deliveryFee: normalizeNumber(
      raw.delivery_fee,
    ),
    paymentProcessingFee: normalizeNumber(
      raw.payment_processing_fee,
    ),
    total: normalizeNumber(raw.total_amount),
    currencyCode: raw.currency_code ?? 'EGP',
    currencySymbol: raw.currency_symbol ?? 'ج.م',
    whatsappNumber: raw.whatsapp_number ?? '',
    whatsappMessage: raw.whatsapp_message ?? '',
    orders: (raw.orders ?? []).flatMap((order) => {
      if (
        !order.id ||
        !order.order_code ||
        !order.access_token ||
        !order.store_id
      ) {
        return [];
      }

      return [
        {
          id: order.id,
          orderCode: order.order_code,
          accessToken: order.access_token,
          storeId: order.store_id,
          storeName: order.store_name ?? 'متجر',
          subtotal: normalizeNumber(order.subtotal),
          deliveryFee: normalizeNumber(
            order.delivery_fee,
          ),
          paymentProcessingFee: normalizeNumber(
            order.payment_processing_fee,
          ),
          total: normalizeNumber(order.total_amount),
        },
      ];
    }),
  };
}

function getErrorMessage(error: unknown) {
  const raw =
    error &&
    typeof error === 'object' &&
    'message' in error
      ? String(
          (error as { message?: unknown }).message ?? '',
        )
      : '';

  const known: Array<[string, string]> = [
    ['authentication_required', 'تعذر تحديد جلسة المستخدم. افتح التطبيق وحاول مرة أخرى.'],
    ['global_cart_required', 'السلة المجمّعة فارغة.'],
    ['global_cart_store_required', 'يوجد متجر غير صالح داخل السلة.'],
    ['store_not_available', 'أحد المتاجر غير متاح حاليًا.'],
    ['store_not_available_in_service_area', 'أحد المتاجر لا يوصّل للموقع المختار.'],
    ['outside_service_area', 'الموقع خارج نطاق التوصيل الحالي.'],
    ['product_not_available', 'أحد المنتجات لم يعد متاحًا. حدّث السلة وحاول مرة أخرى.'],
    ['payment_method_not_available', 'طريقة الدفع المختارة غير متاحة حاليًا.'],
  ];

  return (
    known.find(([code]) => raw.includes(code))?.[1] ??
    raw ??
    'تعذر إنشاء الطلب المجمّع.'
  );
}

export async function createGlobalOrderGroup(
  input: CreateGlobalOrderGroupInput,
): Promise<GlobalOrderGroup> {
  await ensureAppSession();

  const attempt = await getAttempt(input);

  const payload = {
    client_request_id:
      attempt.clientRequestId,
    service_area_id:
      input.serviceAreaId ?? null,
    delivery_latitude:
      input.deliveryLatitude,
    delivery_longitude:
      input.deliveryLongitude,
    payment_method_id:
      input.paymentMethodId,
    customer_name:
      input.customerName.trim(),
    customer_phone:
      input.customerPhone.trim(),
    address: input.address.trim(),
    landmark: input.landmark.trim(),
    notes: input.notes.trim(),
    stores: input.stores.map((store) => ({
      store_id: store.storeId,
      items: store.items.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId ?? null,
        quantity: item.quantity,
        ...(item.printJob
          ? {
              print_job: {
                printing_service_id:
                  item.printJob.printingServiceId,
                color_option_id:
                  item.printJob.colorOptionId,
                side_option_id:
                  item.printJob.sideOptionId,
                page_count:
                  item.printJob.pageCount,
                copy_count:
                  item.printJob.copyCount,
              },
            }
          : {}),
      })),
    })),
  };

  const { data, error } = await supabase.rpc(
    'create_global_order_group_v1',
    { p_payload: payload },
  );

  if (error) {
    throw new Error(
      getErrorMessage(error),
    );
  }

  const group = mapGroup(
    (data ?? {}) as RawGlobalOrderGroup,
  );

  return group;
}

export async function submitGlobalOrderGroup(
  accessToken: string,
): Promise<GlobalOrderGroup> {
  await ensureAppSession();

  const { data, error } = await supabase.rpc(
    'submit_global_order_group_v1',
    { p_access_token: accessToken },
  );

  if (error) {
    throw new Error(
      getErrorMessage(error),
    );
  }

  const group = mapGroup(
    (data ?? {}) as RawGlobalOrderGroup,
  );

  try {
    await AsyncStorage.removeItem(
      PENDING_GROUP_KEY,
    );
  } catch {
    // The submitted server group remains authoritative.
  }

  return group;
}
