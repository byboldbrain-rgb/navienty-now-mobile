import { supabase } from '../lib/supabase';
import {
  getGlobalCartStoreGroups,
  isPrintJobCartItem,
  type StoreCart,
} from '../store/cart-store';
import type {
  CreateWhatsAppOrderInput,
  Order,
  OrderItem,
} from '../types/supabase-order';
import type {
  GlobalOrderGroup,
} from '../types/global-order';
import {
  createGlobalOrderGroup,
  submitGlobalOrderGroup,
} from './global-order-service';
import * as legacy from './order-service-legacy';

export * from './order-service-legacy';

const GLOBAL_TOKEN_PREFIX =
  'global-order-group:';

type GlobalOrderContext = {
  input: CreateWhatsAppOrderInput;
  groups: StoreCart[];
  createdAt: string;
};

type CachedGlobalOrder = {
  context: GlobalOrderContext;
  order: Order;
};

const globalOrderCache = new Map<
  string,
  CachedGlobalOrder
>();

function encodeGlobalToken(
  accessToken: string,
) {
  return `${GLOBAL_TOKEN_PREFIX}${accessToken}`;
}

function decodeGlobalToken(
  accessToken: string,
): string | null {
  return accessToken.startsWith(
    GLOBAL_TOKEN_PREFIX,
  )
    ? accessToken.slice(
        GLOBAL_TOKEN_PREFIX.length,
      )
    : null;
}

function numeric(
  value: unknown,
) {
  const result = Number(value ?? 0);
  return Number.isFinite(result)
    ? result
    : 0;
}

type RawGlobalOrderGroup = {
  id?: string;
  group_code?: string;
  access_token?: string;
  status?: string;
  subtotal?: number | string;
  delivery_fee?: number | string;
  payment_processing_fee?:
    | number
    | string;
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
    payment_processing_fee?:
      | number
      | string;
    total_amount?: number | string;
  }>;
};

function parseGlobalOrderGroup(
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
    accessToken:
      raw.access_token,
    status:
      raw.status ?? 'created',
    subtotal:
      numeric(raw.subtotal),
    deliveryFee:
      numeric(raw.delivery_fee),
    paymentProcessingFee:
      numeric(
        raw.payment_processing_fee,
      ),
    total:
      numeric(raw.total_amount),
    currencyCode:
      raw.currency_code ?? 'EGP',
    currencySymbol:
      raw.currency_symbol ?? 'ج.م',
    whatsappNumber:
      raw.whatsapp_number ?? '',
    whatsappMessage:
      raw.whatsapp_message ?? '',
    orders:
      (raw.orders ?? []).flatMap(
        (child) => {
          if (
            !child.id ||
            !child.order_code ||
            !child.access_token ||
            !child.store_id
          ) {
            return [];
          }

          return [
            {
              id: child.id,
              orderCode:
                child.order_code,
              accessToken:
                child.access_token,
              storeId:
                child.store_id,
              storeName:
                child.store_name ??
                'متجر',
              subtotal:
                numeric(child.subtotal),
              deliveryFee:
                numeric(
                  child.delivery_fee,
                ),
              paymentProcessingFee:
                numeric(
                  child.payment_processing_fee,
                ),
              total:
                numeric(
                  child.total_amount,
                ),
            },
          ];
        },
      ),
  };
}

function mapCartItemsToOrderItems(
  groups: StoreCart[],
): OrderItem[] {
  return groups.flatMap(
    (group) =>
      group.items.map(
        (item): OrderItem => ({
          id:
            `${group.storeId}:${item.lineId}`,
          productId: item.id,
          productVariantId:
            item.variantId,
          name: item.name,
          variantName:
            item.variantName,
          description:
            item.description,
          price: item.price,
          lineTotal:
            item.price *
            item.quantity,
          icon: item.icon,
          imageUrl: null,
          quantity:
            isPrintJobCartItem(
              item,
            )
              ? item.printJob.totalSheets
              : item.quantity,
          itemKind:
            item.itemKind,
          printJob:
            item.printJob,
          isAgeRestricted:
            item.isAgeRestricted,
        }),
      ),
  );
}

function buildSyntheticGlobalOrder(
  group: GlobalOrderGroup,
  context?: GlobalOrderContext,
): Order {
  const cached =
    globalOrderCache.get(
      group.accessToken,
    );

  const effectiveContext =
    context ?? cached?.context;

  const groups =
    effectiveContext?.groups ?? [];

  const input =
    effectiveContext?.input;

  const items =
    groups.length > 0
      ? mapCartItemsToOrderItems(
          groups,
        )
      : cached?.order.items ?? [];

  const createdAt =
    effectiveContext?.createdAt ??
    cached?.order.createdAt ??
    new Date().toISOString();

  const submitted =
    group.status === 'submitted';

  const cancelled =
    group.status === 'cancelled';

  const firstStore =
    groups[0] ?? null;

  const firstChild =
    group.orders[0] ?? null;

  const semanticItemCount =
    groups.length > 0
      ? groups.reduce(
          (sum, storeGroup) =>
            sum +
            storeGroup.items.reduce(
              (
                groupSum,
                item,
              ) =>
                groupSum +
                (
                  isPrintJobCartItem(
                    item,
                  )
                    ? 1
                    : item.quantity
                ),
              0,
            ),
          0,
        )
      : cached?.order.itemCount ??
        items.length;

  return {
    id: group.id,
    orderCode:
      group.groupCode,
    accessToken:
      encodeGlobalToken(
        group.accessToken,
      ),
    clientRequestId:
      group.id,
    appName: 'Navienty Now',
    createdAt,
    updatedAt:
      new Date().toISOString(),
    submittedAt:
      submitted
        ? new Date().toISOString()
        : null,
    confirmedAt: null,
    preparingAt: null,
    outForDeliveryAt: null,
    deliveredAt: null,
    cancelledAt:
      cancelled
        ? new Date().toISOString()
        : null,
    cancellationReason:
      cancelled
        ? 'global_order_group_cancelled'
        : null,
    status:
      cancelled
        ? 'cancelled'
        : submitted
          ? 'waiting-confirmation'
          : 'awaiting-whatsapp-send',
    paymentStatus: 'pending',
    storeId:
      firstChild?.storeId ??
      firstStore?.storeId ??
      input?.storeId ?? '',
    storeName:
      group.orders.length > 1
        ? `طلب من ${group.orders.length} متاجر`
        : firstChild?.storeName ??
          firstStore?.storeName ??
          'Navienty Now',
    storeIcon:
      firstStore?.storeIcon ??
      '🛍️',
    items,
    itemCount:
      semanticItemCount,
    subtotal:
      group.subtotal,
    voucherCode:
      input?.voucherCode ?? null,
    voucherTitle: null,
    voucherDiscountAmount: 0,
    deliveryFee:
      group.deliveryFee,
    paymentProcessingFee:
      group.paymentProcessingFee,
    total: group.total,
    currencyCode:
      group.currencyCode,
    currencySymbol:
      group.currencySymbol,
    customerName:
      input?.customerName ??
      cached?.order.customerName ?? '',
    phoneNumber:
      input?.customerPhone ??
      cached?.order.phoneNumber ?? '',
    serviceAreaId:
      input?.serviceAreaId ??
      cached?.order.serviceAreaId ?? '',
    area:
      cached?.order.area ?? '',
    address:
      input?.address ??
      cached?.order.address ?? '',
    landmark:
      input?.landmark ??
      cached?.order.landmark ?? '',
    notes:
      input?.notes ??
      cached?.order.notes ?? '',
    paymentMethod:
      input?.paymentMethodId ??
      cached?.order.paymentMethod ?? '',
    paymentMethodTitle:
      cached?.order
        .paymentMethodTitle ?? '',
    whatsappNumber:
      group.whatsappNumber,
    whatsappMessage:
      group.whatsappMessage,
    whatsappOpenedAt: null,
    whatsappSentConfirmedAt:
      submitted
        ? new Date().toISOString()
        : null,
    statusHistory: [],
  };
}

async function getGlobalGroup(
  rawAccessToken: string,
) {
  const { data, error } =
    await supabase.rpc(
      'get_global_order_group_v1',
      {
        p_access_token:
          rawAccessToken,
      },
    );

  if (error) {
    throw new Error(
      error.message ||
        'تعذر تحميل الطلب المجمّع.',
    );
  }

  return parseGlobalOrderGroup(
    (data ?? {}) as RawGlobalOrderGroup,
  );
}

export async function getOrderByToken(
  accessToken: string,
): Promise<Order> {
  const globalAccessToken =
    decodeGlobalToken(
      accessToken,
    );

  if (!globalAccessToken) {
    return legacy.getOrderByToken(
      accessToken,
    );
  }

  const group =
    await getGlobalGroup(
      globalAccessToken,
    );

  const order =
    buildSyntheticGlobalOrder(
      group,
    );

  const cached =
    globalOrderCache.get(
      globalAccessToken,
    );

  if (cached) {
    globalOrderCache.set(
      globalAccessToken,
      {
        ...cached,
        order,
      },
    );
  }

  return order;
}

export async function createWhatsAppOrder(
  input: CreateWhatsAppOrderInput,
): Promise<Order> {
  const groups =
    getGlobalCartStoreGroups();

  if (groups.length <= 1) {
    return legacy.createWhatsAppOrder(
      input,
    );
  }

  const anchorIndex =
    groups.findIndex(
      (group) =>
        group.storeId ===
        input.storeId,
    );

  const orderedGroups =
    anchorIndex > 0
      ? [
          groups[anchorIndex],
          ...groups.filter(
            (_, index) =>
              index !== anchorIndex,
          ),
        ]
      : groups;

  const createdAt =
    new Date().toISOString();

  const createdGroup =
    await createGlobalOrderGroup({
      serviceAreaId:
        input.serviceAreaId,
      deliveryLatitude:
        input.deliveryLatitude,
      deliveryLongitude:
        input.deliveryLongitude,
      paymentMethodId:
        input.paymentMethodId,
      customerName:
        input.customerName,
      customerPhone:
        input.customerPhone,
      address: input.address,
      landmark: input.landmark,
      notes: input.notes,
      stores:
        orderedGroups.map(
          (group) => ({
            storeId:
              group.storeId,
            items:
              group.items.map(
                (item) => ({
                  productId:
                    item.id,
                  variantId:
                    item.variantId,
                  quantity:
                    item.quantity,
                  ...(isPrintJobCartItem(
                    item,
                  )
                    ? {
                        printJob: {
                          printingServiceId:
                            item.printJob
                              .printingServiceId,
                          colorOptionId:
                            item.printJob
                              .colorOptionId,
                          sideOptionId:
                            item.printJob
                              .sideOptionId,
                          pageCount:
                            item.printJob
                              .pageCount,
                          copyCount:
                            item.printJob
                              .copyCount,
                        },
                      }
                    : {}),
                })),
          }),
        ),
    });

  const context: GlobalOrderContext = {
    input,
    groups: orderedGroups,
    createdAt,
  };

  const order =
    buildSyntheticGlobalOrder(
      createdGroup,
      context,
    );

  globalOrderCache.set(
    createdGroup.accessToken,
    {
      context,
      order,
    },
  );

  return order;
}

export async function submitOrderForConfirmation(
  accessToken: string,
): Promise<Order> {
  const globalAccessToken =
    decodeGlobalToken(
      accessToken,
    );

  if (!globalAccessToken) {
    return legacy.submitOrderForConfirmation(
      accessToken,
    );
  }

  const group =
    await submitGlobalOrderGroup(
      globalAccessToken,
    );

  const cached =
    globalOrderCache.get(
      globalAccessToken,
    );

  const order =
    buildSyntheticGlobalOrder(
      group,
      cached?.context,
    );

  if (cached) {
    globalOrderCache.set(
      globalAccessToken,
      {
        ...cached,
        order,
      },
    );
  }

  return order;
}

export async function confirmWhatsAppOrderSent(
  accessToken: string,
): Promise<Order> {
  const globalAccessToken =
    decodeGlobalToken(
      accessToken,
    );

  if (!globalAccessToken) {
    return legacy.confirmWhatsAppOrderSent(
      accessToken,
    );
  }

  return getOrderByToken(
    accessToken,
  );
}

export async function cancelPendingWhatsAppOrder(
  accessToken: string,
  reason =
    'customer_did_not_send_whatsapp',
): Promise<Order> {
  const globalAccessToken =
    decodeGlobalToken(
      accessToken,
    );

  if (!globalAccessToken) {
    return legacy.cancelPendingWhatsAppOrder(
      accessToken,
      reason,
    );
  }

  const current =
    await getOrderByToken(
      accessToken,
    );

  return {
    ...current,
    status: 'cancelled',
    cancelledAt:
      new Date().toISOString(),
    cancellationReason: reason,
  };
}
