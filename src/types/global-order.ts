import type {
  PrintJobOrderPayload,
} from './printing';

export type GlobalOrderGroupStoreInput = {
  storeId: string;
  items: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
    printJob?: PrintJobOrderPayload;
  }>;
};

export type CreateGlobalOrderGroupInput = {
  serviceAreaId?: string | null;
  deliveryLatitude: number;
  deliveryLongitude: number;
  paymentMethodId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  landmark: string;
  notes: string;
  stores: GlobalOrderGroupStoreInput[];
};

export type GlobalOrderGroupChild = {
  id: string;
  orderCode: string;
  accessToken: string;
  storeId: string;
  storeName: string;
  subtotal: number;
  deliveryFee: number;
  paymentProcessingFee: number;
  total: number;
};

export type GlobalOrderGroup = {
  id: string;
  groupCode: string;
  accessToken: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  paymentProcessingFee: number;
  total: number;
  currencyCode: string;
  currencySymbol: string;
  whatsappNumber: string;
  whatsappMessage: string;
  orders: GlobalOrderGroupChild[];
};
