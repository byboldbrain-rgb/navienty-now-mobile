import type {
  PrintJobOrderPayload,
  PrintJobSnapshot,
} from './printing';

export type OrderStatus =
  | 'awaiting-whatsapp-send'
  | 'waiting-confirmation'
  | 'confirmed'
  | 'preparing'
  | 'out-for-delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus =
  | 'pending'
  | 'awaiting-payment'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially-refunded';

export type OrderItemKind =
  | 'catalog_product'
  | 'print_job';

export type OrderItem = {
  id: string;
  productId: string | null;
  productVariantId: string | null;

  name: string;
  variantName: string | null;
  description: string;

  price: number;
  lineTotal: number;
  icon: string;
  imageUrl: string | null;

  /**
   * Catalog products use the purchased unit count. For a print job this is
   * the server-calculated physical A4 sheet count; customer-facing item
   * counts should treat the whole print job as one semantic line.
   */
  quantity: number;

  itemKind: OrderItemKind;
  printJob: PrintJobSnapshot | null;

  isAgeRestricted: boolean;
};

export type OrderStatusHistoryItem = {
  oldStatus: OrderStatus | null;
  newStatus: OrderStatus;
  note: string | null;
  changedByType: string;
  actorReference: string | null;
  createdAt: string;
};

export type Order = {
  id: string;
  orderCode: string;
  accessToken: string;
  clientRequestId: string;

  appName: string;

  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;

  confirmedAt: string | null;
  preparingAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;

  status: OrderStatus;
  paymentStatus: PaymentStatus;

  /**
   * Present only for the customer-facing parent created by a multi-store
   * global checkout. These references let realtime/history refreshes keep the
   * parent order while hiding its internal per-store child orders.
   */
  globalOrderChildIds?: string[];

  storeId: string;
  storeName: string;
  storeIcon: string;

  items: OrderItem[];
  itemCount: number;

  subtotal: number;
  voucherCode?: string | null;
  voucherTitle?: string | null;
  voucherDiscountAmount?: number;
  deliveryFee: number;
  paymentProcessingFee?: number;
  total: number;

  currencyCode: string;
  currencySymbol: string;

  customerName: string;
  phoneNumber: string;

  serviceAreaId: string;
  area: string;
  address: string;
  landmark: string;
  notes: string;

  paymentMethod: string;
  paymentMethodTitle: string;

  whatsappNumber: string;
  whatsappMessage: string;
  whatsappOpenedAt: string | null;
  whatsappSentConfirmedAt: string | null;

  statusHistory: OrderStatusHistoryItem[];
};

export type CreateWhatsAppOrderInput = {
  storeId: string;

  /**
   * Compatibility fallback while geofencing is disabled in Supabase.
   * Once location_geofencing_enabled = true, the server ignores this
   * value and resolves the service area from the coordinates below.
   */
  serviceAreaId?: string | null;

  deliveryLatitude: number;
  deliveryLongitude: number;

  paymentMethodId: string;

  customerName: string;
  customerPhone: string;

  address: string;
  landmark: string;
  notes: string;

  voucherCode?: string | null;

  /**
   * Optional Spin event associated with this checkout.
   *
   * The server decides whether this event is the source of a pending
   * next-order reward or an already-available reward being redeemed.
   * The client must never decide or persist consumption by itself.
   */
  spinEventId?: string | null;

  items: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
    printJob?: PrintJobOrderPayload | null;
  }>;
};
