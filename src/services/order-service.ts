import {
  getAggregateGlobalOrderStatus,
} from '../domain/global-order-status';
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
  OrderStatus,
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
  context?: GlobalOrderContext;
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

function getEarliestDate(
  values: Array<string | null | undefined>,
): string | null {
  const validDates = values
    .filter(
      (value): value is string =>
        Boolean(value),
    )
    .map((value) => ({
      value,
      time: new Date(value).getTime(),
    }))
    .filter(({ time }) =>
      Number.isFinite(time),
    );

  if (validDates.length === 0) {
    return null;
  }

  return validDates.reduce(
    (earliest, current) =>
      current.time < earliest.time
        ? current
        : earliest,
  ).value;
}

function getLatestDate(
  values: Array<string | null | undefined>,
): string | null {
  const validDates = values
    .filter(
      (value): value is string =>
        Boolean(value),
    )
    .map((value) => ({
      value,
      time: new Date(value).getTime(),
    }))
    .filter(({ time }) =>
      Number.isFinite(time),
    );

  if (validDates.length === 0) {
    return null;
  }

  return validDates.reduce(
    (latest, current) =>
      current.time > latest.time
        ? current
        : latest,
  ).value;
}

function getFallbackGroupStatus(
  group: GlobalOrderGroup,
): OrderStatus {
  if (group.status === 'cancelled') {
    return 'cancelled';
  }

  if (group.status === 'submitted') {
    return 'waiting-confirmation';
  }

  return 'awaiting-whatsapp-send';
}

function buildSyntheticGlobalOrder(
  group: GlobalOrderGroup,
  context?: GlobalOrderContext,
  serverChildOrders: Order[] = [],
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

  const cachedItems =
    cached?.order.items ?? [];

  const items =
    groups.length > 0
      ? mapCartItemsToOrderItems(
          groups,
        )
      : cachedItems.length > 0
        ? cachedItems
        : serverChildOrders.flatMap(
            (order) => order.items,
          );

  const firstChildOrder =
    serverChildOrders[0] ?? null;

  const createdAt =
    effectiveContext?.createdAt ??
    cached?.order.createdAt ??
    getEarliestDate(
      serverChildOrders.map(
        (order) => order.createdAt,
      ),
    ) ??
    new Date().toISOString();

  const fallbackStatus =
    getFallbackGroupStatus(group);

  const status =
    serverChildOrders.length > 0
      ? getAggregateGlobalOrderStatus(
          serverChildOrders.map(
            (order) => order.status,
          ),
          fallbackStatus,
        )
      : cached?.order.status ??
        fallbackStatus;

  const submitted =
    group.status === 'submitted' ||
    status !==
      'awaiting-whatsapp-send';

  const cancelled =
    status === 'cancelled';

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
        serverChildOrders.reduce(
          (sum, order) =>
            sum + order.itemCount,
          0,
        );

  const allChildrenPaid =
    serverChildOrders.length > 0 &&
    serverChildOrders.every(
      (order) =>
        order.paymentStatus === 'paid',
    );

  const anyChildPaymentFailed =
    serverChildOrders.some(
      (order) =>
        order.paymentStatus === 'failed',
    );

  const paymentStatus =
    allChildrenPaid
      ? 'paid'
      : anyChildPaymentFailed
        ? 'failed'
        : cached?.order.paymentStatus ??
          firstChildOrder?.paymentStatus ??
          'pending';

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
      getLatestDate([
        cached?.order.updatedAt,
        ...serverChildOrders.map(
          (order) => order.updatedAt,
        ),
      ]) ??
      new Date().toISOString(),
    submittedAt:
      cached?.order.submittedAt ??
      getEarliestDate(
        serverChildOrders.map(
          (order) => order.submittedAt,
        ),
      ) ??
      (submitted
        ? new Date().toISOString()
        : null),
    confirmedAt:
      cached?.order.confirmedAt ??
      getEarliestDate(
        serverChildOrders.map(
          (order) => order.confirmedAt,
        ),
      ),
    preparingAt:
      cached?.order.preparingAt ??
      getEarliestDate(
        serverChildOrders.map(
          (order) => order.preparingAt,
        ),
      ),
    outForDeliveryAt:
      cached?.order.outForDeliveryAt ??
      getEarliestDate(
        serverChildOrders.map(
          (order) => order.outForDeliveryAt,
        ),
      ),
    deliveredAt:
      status === 'delivered'
        ? cached?.order.deliveredAt ??
          getLatestDate(
            serverChildOrders.map(
              (order) => order.deliveredAt,
            ),
          )
        : null,
    cancelledAt:
      cancelled
        ? cached?.order.cancelledAt ??
          getLatestDate(
            serverChildOrders.map(
              (order) => order.cancelledAt,
            ),
          ) ??
          new Date().toISOString()
        : null,
    cancellationReason:
      cancelled
        ? cached?.order
            .cancellationReason ??
          'global_order_group_cancelled'
        : null,
    status,
    paymentStatus,
    globalOrderChildIds:
      group.orders.map(
        (child) => child.id,
      ),
    storeId:
      firstChild?.storeId ??
      firstStore?.storeId ??
      firstChildOrder?.storeId ??
      input?.storeId ?? '',
    storeName:
      group.orders.length > 1
        ? `طلب من ${group.orders.length} متاجر`
        : firstChild?.storeName ??
          firstStore?.storeName ??
          firstChildOrder?.storeName ??
          'Navienty Now',
    storeIcon:
      firstStore?.storeIcon ??
      firstChildOrder?.storeIcon ??
      cached?.order.storeIcon ??
      '🛍️',
    items,
    itemCount:
      semanticItemCount,
    subtotal:
      group.subtotal,
    voucherCode:
      input?.voucherCode ??
      cached?.order.voucherCode ??
      null,
    voucherTitle:
      cached?.order.voucherTitle ??
      null,
    voucherDiscountAmount:
      cached?.order
        .voucherDiscountAmount ?? 0,
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
      cached?.order.customerName ??
      firstChildOrder?.customerName ??
      '',
    phoneNumber:
      input?.customerPhone ??
      cached?.order.phoneNumber ??
      firstChildOrder?.phoneNumber ??
      '',
    serviceAreaId:
      input?.serviceAreaId ??
      cached?.order.serviceAreaId ??
      firstChildOrder?.serviceAreaId ??
      '',
    area:
      cached?.order.area ??
      firstChildOrder?.area ?? '',
    address:
      input?.address ??
      cached?.order.address ??
      firstChildOrder?.address ?? '',
    landmark:
      input?.landmark ??
      cached?.order.landmark ??
      firstChildOrder?.landmark ?? '',
    notes:
      input?.notes ??
      cached?.order.notes ??
      firstChildOrder?.notes ?? '',
    paymentMethod:
      input?.paymentMethodId ??
      cached?.order.paymentMethod ??
      firstChildOrder?.paymentMethod ?? '',
    paymentMethodTitle:
      cached?.order
        .paymentMethodTitle ??
      firstChildOrder
        ?.paymentMethodTitle ?? '',
    whatsappNumber:
      group.whatsappNumber,
    whatsappMessage:
      group.whatsappMessage,
    whatsappOpenedAt:
      cached?.order
        .whatsappOpenedAt ?? null,
    whatsappSentConfirmedAt:
      cached?.order
        .whatsappSentConfirmedAt ??
      (submitted
        ? new Date().toISOString()
        : null),
    statusHistory:
      cached?.order.statusHistory ?? [],
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

  const childIds = new Set(
    group.orders.map(
      (child) => child.id,
    ),
  );

  let serverChildOrders: Order[] = [];

  try {
    const serverOrders =
      await legacy.getMyOrders();

    serverChildOrders =
      serverOrders.filter(
        (order) =>
          childIds.has(order.id),
      );
  } catch {
    // The group RPC is still authoritative. Cached parent data remains a safe
    // fallback if the broader order-history refresh is temporarily unavailable.
  }

  const cached =
    globalOrderCache.get(
      globalAccessToken,
    );

  const order =
    buildSyntheticGlobalOrder(
      group,
      cached?.context,
      serverChildOrders,
    );

  globalOrderCache.set(
    globalAccessToken,
    {
      context: cached?.context,
      order,
    },
  );

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

  globalOrderCache.set(
    globalAccessToken,
    {
      context: cached?.context,
      order,
    },
  );

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
