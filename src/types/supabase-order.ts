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
  quantity: number;

  requiresPrescription: boolean;
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

  storeId: string;
  storeName: string;
  storeIcon: string;

  items: OrderItem[];
  itemCount: number;

  subtotal: number;
  deliveryFee: number;
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

  items: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
  }>;
};
