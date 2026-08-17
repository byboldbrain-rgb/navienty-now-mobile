import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createClientRequestId,
  getOrderRequestFingerprint,
} from '../domain/order-idempotency';
import { supabase } from '../lib/supabase';
import type {
  CreateWhatsAppOrderInput,
  Order,
  OrderStatus,
  PaymentStatus,
} from '../types/supabase-order';

type NumericValue =
  | number
  | string
  | null
  | undefined;

type RawOrderStatus =
  | 'awaiting_whatsapp_send'
  | 'waiting_confirmation'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

type RawPaymentStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

type RawOrderDetails = {
  id: string;
  order_code: string;
  access_token: string;
  client_request_id: string;

  app?: {
    name?: string | null;
  };

  status: RawOrderStatus;
  payment_status: RawPaymentStatus;

  store: {
    id: string;
    name_ar: string;
    icon?: string | null;
  };

  customer: {
    name: string;
    phone: string;
  };

  delivery: {
    service_area_id: string;
    area_name_ar: string;
    address: string;
    landmark: string | null;
    notes: string | null;
  };

  payment: {
    payment_method_id: string;
    payment_method_name: string;
  };

  summary: {
    subtotal: NumericValue;
    delivery_fee: NumericValue;
    total_amount: NumericValue;
    currency_code: string;
    currency_symbol: string;
  };

  whatsapp: {
    message: string | null;
    opened_at: string | null;
    sent_confirmed_at: string | null;
    number: string | null;
  };

  items: Array<{
    id: string;
    product_id: string | null;
    product_variant_id: string | null;
    name_ar: string;
    variant_name_ar: string | null;
    sku: string | null;
    icon?: string | null;
    image_url: string | null;
    quantity: number;
    unit_price: NumericValue;
    line_total: NumericValue;
    requires_prescription: boolean;
    is_age_restricted: boolean;
  }>;

  status_history: Array<{
    old_status: RawOrderStatus | null;
    new_status: RawOrderStatus;
    note: string | null;
    changed_by_type: string;
    actor_reference: string | null;
    created_at: string;
  }>;

  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  preparing_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

type RawCreatedOrder = {
  id: string;
  order_code: string;
  access_token: string;
};

function toNumber(
  value: NumericValue,
): number {
  const parsedValue =
    typeof value === 'number'
      ? value
      : Number(value ?? 0);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : 0;
}

function mapStatus(
  status: RawOrderStatus,
): OrderStatus {
  const statusMap: Record<
    RawOrderStatus,
    OrderStatus
  > = {
    awaiting_whatsapp_send:
      'awaiting-whatsapp-send',
    waiting_confirmation:
      'waiting-confirmation',
    confirmed: 'confirmed',
    preparing: 'preparing',
    out_for_delivery:
      'out-for-delivery',
    delivered: 'delivered',
    cancelled: 'cancelled',
  };

  return statusMap[status];
}

function mapPaymentStatus(
  status: RawPaymentStatus,
): PaymentStatus {
  const statusMap: Record<
    RawPaymentStatus,
    PaymentStatus
  > = {
    pending: 'pending',
    awaiting_payment:
      'awaiting-payment',
    paid: 'paid',
    failed: 'failed',
    refunded: 'refunded',
    partially_refunded:
      'partially-refunded',
  };

  return statusMap[status];
}

function mapOrder(
  rawOrder: RawOrderDetails,
): Order {
  const items = (
    rawOrder.items ?? []
  ).map((item) => ({
    id: item.id,
    productId: item.product_id,
    productVariantId:
      item.product_variant_id,

    name: item.name_ar,
    variantName:
      item.variant_name_ar,

    description:
      item.variant_name_ar ??
      item.sku ??
      '',

    price: toNumber(
      item.unit_price,
    ),

    lineTotal: toNumber(
      item.line_total,
    ),

    icon: item.icon ?? '📦',
    imageUrl: item.image_url,
    quantity: item.quantity,

    requiresPrescription:
      item.requires_prescription,

    isAgeRestricted:
      item.is_age_restricted,
  }));

  return {
    id: rawOrder.id,
    orderCode: rawOrder.order_code,
    accessToken:
      rawOrder.access_token,
    clientRequestId:
      rawOrder.client_request_id,

    appName:
      rawOrder.app?.name ??
      'Navienty Now',

    createdAt: rawOrder.created_at,
    updatedAt: rawOrder.updated_at,

    submittedAt:
      rawOrder.whatsapp
        .sent_confirmed_at,

    confirmedAt:
      rawOrder.confirmed_at,

    preparingAt:
      rawOrder.preparing_at,

    outForDeliveryAt:
      rawOrder
        .out_for_delivery_at,

    deliveredAt:
      rawOrder.delivered_at,

    cancelledAt:
      rawOrder.cancelled_at,

    cancellationReason:
      rawOrder
        .cancellation_reason,

    status: mapStatus(
      rawOrder.status,
    ),

    paymentStatus:
      mapPaymentStatus(
        rawOrder.payment_status,
      ),

    storeId: rawOrder.store.id,
    storeName:
      rawOrder.store.name_ar,
    storeIcon:
      rawOrder.store.icon ?? '🏪',

    items,

    itemCount: items.reduce(
      (total, item) =>
        total + item.quantity,
      0,
    ),

    subtotal: toNumber(
      rawOrder.summary.subtotal,
    ),

    deliveryFee: toNumber(
      rawOrder.summary.delivery_fee,
    ),

    total: toNumber(
      rawOrder.summary.total_amount,
    ),

    currencyCode:
      rawOrder.summary.currency_code,

    currencySymbol:
      rawOrder.summary
        .currency_symbol,

    customerName:
      rawOrder.customer.name,

    phoneNumber:
      rawOrder.customer.phone,

    serviceAreaId:
      rawOrder.delivery
        .service_area_id,

    area:
      rawOrder.delivery.area_name_ar,

    address:
      rawOrder.delivery.address,

    landmark:
      rawOrder.delivery.landmark ??
      '',

    notes:
      rawOrder.delivery.notes ?? '',

    paymentMethod:
      rawOrder.payment
        .payment_method_id,

    paymentMethodTitle:
      rawOrder.payment
        .payment_method_name,

    whatsappNumber:
      rawOrder.whatsapp.number ??
      '',

    whatsappMessage:
      rawOrder.whatsapp.message ??
      '',

    whatsappOpenedAt:
      rawOrder.whatsapp.opened_at,

    whatsappSentConfirmedAt:
      rawOrder.whatsapp
        .sent_confirmed_at,

    statusHistory: (
      rawOrder.status_history ?? []
    ).map((historyItem) => ({
      oldStatus:
        historyItem.old_status
          ? mapStatus(
              historyItem.old_status,
            )
          : null,

      newStatus: mapStatus(
        historyItem.new_status,
      ),

      note: historyItem.note,

      changedByType:
        historyItem.changed_by_type,

      actorReference:
        historyItem.actor_reference,

      createdAt:
        historyItem.created_at,
    })),
  };
}

const PENDING_ORDER_ATTEMPT_STORAGE_KEY =
  '@navienty-now/pending-order-create-v1';

const PENDING_ORDER_ATTEMPT_MAX_AGE_MS =
  10 * 60 * 1000;

type PendingOrderAttempt = {
  fingerprint: string;
  clientRequestId: string;
  createdAt: number;
};

let memoryPendingOrderAttempt:
  | PendingOrderAttempt
  | null = null;

function isReusablePendingOrderAttempt(
  attempt: PendingOrderAttempt | null,
  fingerprint: string,
  currentTime: number,
): attempt is PendingOrderAttempt {
  return (
    attempt !== null &&
    attempt.fingerprint === fingerprint &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      attempt.clientRequestId,
    ) &&
    Number.isFinite(attempt.createdAt) &&
    attempt.createdAt > 0 &&
    currentTime - attempt.createdAt >= 0 &&
    currentTime - attempt.createdAt <=
      PENDING_ORDER_ATTEMPT_MAX_AGE_MS
  );
}

function parsePendingOrderAttempt(
  value: string | null,
): PendingOrderAttempt | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<PendingOrderAttempt>;

    if (
      typeof parsed.fingerprint !== 'string' ||
      typeof parsed.clientRequestId !== 'string' ||
      typeof parsed.createdAt !== 'number'
    ) {
      return null;
    }

    return {
      fingerprint: parsed.fingerprint,
      clientRequestId: parsed.clientRequestId,
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

async function getOrCreatePendingOrderAttempt(
  input: CreateWhatsAppOrderInput,
): Promise<PendingOrderAttempt> {
  const fingerprint =
    getOrderRequestFingerprint(input);
  const currentTime = Date.now();

  if (
    isReusablePendingOrderAttempt(
      memoryPendingOrderAttempt,
      fingerprint,
      currentTime,
    )
  ) {
    return memoryPendingOrderAttempt;
  }

  try {
    const persistedAttempt =
      parsePendingOrderAttempt(
        await AsyncStorage.getItem(
          PENDING_ORDER_ATTEMPT_STORAGE_KEY,
        ),
      );

    if (
      isReusablePendingOrderAttempt(
        persistedAttempt,
        fingerprint,
        currentTime,
      )
    ) {
      memoryPendingOrderAttempt =
        persistedAttempt;
      return persistedAttempt;
    }
  } catch {
    // Idempotency still works for this process through the in-memory fallback.
  }

  const nextAttempt: PendingOrderAttempt = {
    fingerprint,
    clientRequestId: createClientRequestId(),
    createdAt: currentTime,
  };

  // Set memory before awaiting persistence so two rapid taps in the same
  // process cannot generate separate client_request_id values.
  memoryPendingOrderAttempt = nextAttempt;

  try {
    await AsyncStorage.setItem(
      PENDING_ORDER_ATTEMPT_STORAGE_KEY,
      JSON.stringify(nextAttempt),
    );
  } catch {
    // The in-memory attempt still protects retries while this process lives.
  }

  return nextAttempt;
}

async function clearPendingOrderAttempt(
  attempt: PendingOrderAttempt,
): Promise<void> {
  if (
    memoryPendingOrderAttempt?.clientRequestId ===
      attempt.clientRequestId &&
    memoryPendingOrderAttempt.fingerprint ===
      attempt.fingerprint
  ) {
    memoryPendingOrderAttempt = null;
  }

  try {
    const persistedAttempt =
      parsePendingOrderAttempt(
        await AsyncStorage.getItem(
          PENDING_ORDER_ATTEMPT_STORAGE_KEY,
        ),
      );

    if (
      persistedAttempt?.clientRequestId ===
        attempt.clientRequestId &&
      persistedAttempt.fingerprint ===
        attempt.fingerprint
    ) {
      await AsyncStorage.removeItem(
        PENDING_ORDER_ATTEMPT_STORAGE_KEY,
      );
    }
  } catch {
    // A stale attempt expires automatically after the short retry window.
  }
}

function getErrorMessage(
  error: unknown,
): string {
  const fallbackMessage =
    'حدث خطأ أثناء تنفيذ الطلب. حاول مرة أخرى.';

  if (
    !error ||
    typeof error !== 'object'
  ) {
    return fallbackMessage;
  }

  const message =
    'message' in error &&
    typeof error.message === 'string'
      ? error.message
      : '';

  const details =
    'details' in error &&
    typeof error.details === 'string'
      ? error.details
      : '';

  const combinedText =
    `${message} ${details}`;

  const knownErrors: Array<
    [string, string]
  > = [
    [
      'authentication_required',
      'تعذر تحديد حساب الجهاز. أغلق التطبيق وافتحه مرة أخرى ثم حاول مجددًا.',
    ],
    [
      'orders_disabled',
      'استقبال الطلبات متوقف حاليًا من إعدادات Supabase.',
    ],
    [
      'whatsapp_number_not_configured',
      'رقم واتساب غير مضبوط في إعدادات Supabase.',
    ],
    [
      'app_under_maintenance',
      'التطبيق تحت الصيانة حاليًا.',
    ],
    [
      'catalog_disabled',
      'الكتالوج متوقف حاليًا.',
    ],
    [
      'delivery_location_required',
      'حدد موقع التوصيل من الخريطة قبل إتمام الطلب.',
    ],
    [
      'invalid_delivery_coordinates',
      'إحداثيات موقع التوصيل غير صالحة. اختر الموقع مرة أخرى.',
    ],
    [
      'outside_service_area',
      'الموقع المحدد خارج نطاق توصيل Navienty Now حاليًا.',
    ],
    [
      'store_not_available_in_service_area',
      'المتجر غير متاح في منطقة التوصيل الحالية.',
    ],
    [
      'store_not_available',
      'المتجر مغلق أو غير متاح حاليًا.',
    ],
    [
      'payment_method_not_available',
      'طريقة الدفع المختارة غير متاحة حاليًا.',
    ],
    [
      'product_not_available',
      'أحد المنتجات لم يعد متاحًا. ارجع إلى المتجر وحدّث السلة.',
    ],
    [
      'prescription_required',
      'هذا الطلب يحتوي على دواء يحتاج روشتة. ارفع الروشتة من صفحة إتمام الطلب ثم حاول مرة أخرى.',
    ],
    [
      'prescription_approval_required',
      'الروشتة ما زالت تحتاج مراجعة الصيدلية قبل تأكيد الطلب.',
    ],
    [
      'product_variant_required',
      'يجب اختيار نوع أو حجم المنتج قبل إتمام الطلب.',
    ],
    [
      'product_variant_not_available',
      'نوع المنتج المختار غير متاح حاليًا.',
    ],
    [
      'minimum_order_not_reached',
      'قيمة المنتجات أقل من الحد الأدنى المطلوب للمتجر.',
    ],
    [
      'invalid_customer_phone',
      'رقم الموبايل غير صحيح.',
    ],
    [
      'invalid_delivery_address',
      'عنوان التوصيل غير مكتمل.',
    ],
    [
      'order_not_found',
      'لم يتم العثور على الطلب.',
    ],
  ];

  const matchedError =
    knownErrors.find(
      ([errorCode]) =>
        combinedText.includes(
          errorCode,
        ),
    );

  return (
    matchedError?.[1] ||
    message ||
    fallbackMessage
  );
}

export async function getMyOrders():
  Promise<Order[]> {
  const { data, error } =
    await supabase.rpc(
      'get_my_orders',
    );

  if (error) {
    throw new Error(
      getErrorMessage(error),
    );
  }

  if (data == null) {
    return [];
  }

  if (!Array.isArray(data)) {
    throw new Error(
      'استجابة سجل الطلبات من Supabase غير صالحة.',
    );
  }

  return data.map((rawOrder) =>
    mapOrder(
      rawOrder as unknown as RawOrderDetails,
    ),
  );
}

export async function getOrderByToken(
  accessToken: string,
): Promise<Order> {
  const { data, error } =
    await supabase.rpc(
      'get_order_by_token',
      {
        p_access_token:
          accessToken,
      },
    );

  if (error) {
    throw new Error(
      getErrorMessage(error),
    );
  }

  if (!data) {
    throw new Error(
      'لم يتم العثور على الطلب.',
    );
  }

  return mapOrder(
    data as unknown as RawOrderDetails,
  );
}

export async function createWhatsAppOrder(
  input: CreateWhatsAppOrderInput,
): Promise<Order> {
  const pendingAttempt =
    await getOrCreatePendingOrderAttempt(
      input,
    );

  const payload = {
    client_request_id:
      pendingAttempt.clientRequestId,

    store_id: input.storeId,

    /**
     * Compatibility only. When Supabase geofencing is enabled,
     * create_whatsapp_order ignores this and resolves the area
     * from delivery_latitude / delivery_longitude.
     */
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

    address:
      input.address.trim(),

    landmark:
      input.landmark.trim(),

    notes:
      input.notes.trim(),

    items: input.items.map(
      (item) => ({
        product_id:
          item.productId,

        variant_id:
          item.variantId ?? null,

        quantity: item.quantity,
      }),
    ),
  };

  const { data, error } =
    await supabase.rpc(
      'create_whatsapp_order',
      {
        p_payload: payload,
      },
    );

  if (error) {
    throw new Error(
      getErrorMessage(error),
    );
  }

  const createdOrder =
    data as unknown as RawCreatedOrder | null;

  if (
    !createdOrder?.access_token
  ) {
    throw new Error(
      'لم ترجع قاعدة البيانات رمز الوصول إلى الطلب.',
    );
  }

  const order = await getOrderByToken(
    createdOrder.access_token,
  );

  await clearPendingOrderAttempt(
    pendingAttempt,
  );

  return order;
}

export async function confirmWhatsAppOrderSent(
  accessToken: string,
): Promise<Order> {
  const { data, error } =
    await supabase.rpc(
      'confirm_whatsapp_order_sent',
      {
        p_access_token:
          accessToken,
      },
    );

  if (error) {
    throw new Error(
      getErrorMessage(error),
    );
  }

  if (!data) {
    throw new Error(
      'لم ترجع قاعدة البيانات تفاصيل الطلب بعد التأكيد.',
    );
  }

  return mapOrder(
    data as unknown as RawOrderDetails,
  );
}

export async function cancelPendingWhatsAppOrder(
  accessToken: string,
  reason =
    'customer_did_not_send_whatsapp',
): Promise<Order> {
  const { data, error } =
    await supabase.rpc(
      'cancel_pending_whatsapp_order',
      {
        p_access_token:
          accessToken,
        p_reason: reason,
      },
    );

  if (error) {
    throw new Error(
      getErrorMessage(error),
    );
  }

  if (!data) {
    throw new Error(
      'لم ترجع قاعدة البيانات تفاصيل الطلب الملغي.',
    );
  }

  return mapOrder(
    data as unknown as RawOrderDetails,
  );
}
