import { supabase } from '../lib/supabase';

export type GlobalOrderStoreInput = {
  storeId: string;
  items: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
  }>;
};

export type GlobalOrderGroup = {
  id: string;
  groupCode: string;
  accessToken: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  paymentProcessingFee: number;
  totalAmount: number;
  whatsappNumber: string;
  whatsappMessage: string;
  orders: Array<{
    id: string;
    orderCode: string;
    accessToken: string;
    storeId: string;
    storeName: string;
    subtotal: number;
    deliveryFee: number;
    paymentProcessingFee: number;
    totalAmount: number;
  }>;
};

type RawGlobalOrderGroup = {
  id?: string;
  group_code?: string;
  access_token?: string;
  status?: string;
  subtotal?: string | number;
  delivery_fee?: string | number;
  payment_processing_fee?: string | number;
  total_amount?: string | number;
  whatsapp_number?: string | null;
  whatsapp_message?: string | null;
  orders?: Array<{
    id: string;
    order_code: string;
    access_token: string;
    store_id: string;
    store_name: string;
    subtotal: string | number;
    delivery_fee: string | number;
    payment_processing_fee: string | number;
    total_amount: string | number;
  }>;
};

function numeric(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    throw new Error('بيانات المبلغ المستلمة من قاعدة البيانات غير صالحة.');
  }
  return parsed;
}

function parseGroup(data: unknown): GlobalOrderGroup {
  const raw = data as RawGlobalOrderGroup | null;
  if (
    !raw?.id ||
    !raw.access_token ||
    !raw.group_code ||
    !Array.isArray(raw.orders) ||
    raw.orders.length === 0
  ) {
    throw new Error('قاعدة البيانات لم ترجع تفاصيل الطلبات المجمّعة.');
  }

  return {
    id: raw.id,
    groupCode: raw.group_code,
    accessToken: raw.access_token,
    status: raw.status ?? 'created',
    subtotal: numeric(raw.subtotal),
    deliveryFee: numeric(raw.delivery_fee),
    paymentProcessingFee: numeric(raw.payment_processing_fee),
    totalAmount: numeric(raw.total_amount),
    whatsappNumber: raw.whatsapp_number ?? '',
    whatsappMessage: raw.whatsapp_message ?? '',
    orders: raw.orders.map((order) => ({
      id: order.id,
      orderCode: order.order_code,
      accessToken: order.access_token,
      storeId: order.store_id,
      storeName: order.store_name,
      subtotal: numeric(order.subtotal),
      deliveryFee: numeric(order.delivery_fee),
      paymentProcessingFee: numeric(order.payment_processing_fee),
      totalAmount: numeric(order.total_amount),
    })),
  };
}

function describeError(error: { message?: string }): string {
  const message = error.message ?? '';
  if (message.includes('minimum_order_not_reached')) {
    return 'أحد الطلبات أقل من الحد الأدنى للمتجر. راجع تفاصيل كل مطعم.';
  }
  if (message.includes('store_not_available')) {
    return 'أحد المتاجر غير متاح لعنوان التوصيل المحدد.';
  }
  if (message.includes('outside_service_area')) {
    return 'العنوان المختار خارج نطاق التوصيل المتاح.';
  }
  if (message.includes('payment_method_not_available')) {
    return 'طريقة الدفع المختارة غير متاحة حاليًا.';
  }
  if (message.includes('product_not_available')) {
    return 'أحد المنتجات غير متاح حاليًا. حدّث السلة قبل المتابعة.';
  }
  return message || 'تعذر إتمام الطلبات. حاول مرة أخرى.';
}

// Match the idempotency UUID format expected by create_global_order_group_v1.
export function createGlobalCheckoutRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const digit = Math.floor(Math.random() * 16);
    return (char === 'x' ? digit : (digit & 0x3) | 0x8).toString(16);
  });
}

export async function createGlobalOrderGroup(input: {
  clientRequestId: string;
  stores: GlobalOrderStoreInput[];
  serviceAreaId: string | null;
  latitude: number;
  longitude: number;
  paymentMethodId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  landmark: string;
  notes: string;
}): Promise<GlobalOrderGroup> {
  const { data, error } = await supabase.rpc('create_global_order_group_v1', {
    p_payload: {
      client_request_id: input.clientRequestId,
      service_area_id: input.serviceAreaId,
      delivery_latitude: input.latitude,
      delivery_longitude: input.longitude,
      payment_method_id: input.paymentMethodId,
      customer_name: input.customerName.trim(),
      customer_phone: input.customerPhone.trim(),
      address: input.address.trim(),
      landmark: input.landmark.trim(),
      notes: input.notes.trim(),
      stores: input.stores.map((store) => ({
        store_id: store.storeId,
        items: store.items.map((item) => ({
          product_id: item.productId,
          variant_id: item.variantId ?? null,
          quantity: item.quantity,
        })),
      })),
    },
  });
  if (error) throw new Error(describeError(error));
  return parseGroup(data);
}

export async function getGlobalOrderGroup(
  accessToken: string,
): Promise<GlobalOrderGroup> {
  const { data, error } = await supabase.rpc('get_global_order_group_v1', {
    p_access_token: accessToken,
  });
  if (error) throw new Error(describeError(error));
  return parseGroup(data);
}

export async function submitGlobalOrderGroup(
  accessToken: string,
): Promise<GlobalOrderGroup> {
  const { data, error } = await supabase.rpc('submit_global_order_group_v1', {
    p_access_token: accessToken,
  });
  if (error) throw new Error(describeError(error));
  return parseGroup(data);
}
