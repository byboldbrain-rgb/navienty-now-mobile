import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { GLOBAL_CART_DELIVERY_FEE } from '../config/global-cart';
import { isV1PublicCategorySlug } from '../config/v1-release-scope';
import { resilientAsyncStorage } from '../lib/resilient-storage';
import type { PrintJobSnapshot } from '../types/printing';
import {
  normalizePrintingUiCopy,
  normalizePrintingUiIcons,
} from '../types/printing';

export type CartItemKind = 'catalog_product' | 'print_job';

export type CartProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  lineId?: string;
  itemKind?: CartItemKind;
  printJob?: PrintJobSnapshot | null;
  variantId?: string | null;
  variantName?: string | null;
  isAgeRestricted?: boolean;
};

export type CartItem = CartProduct & {
  quantity: number;
  lineId: string;
  itemKind: CartItemKind;
  printJob: PrintJobSnapshot | null;
  variantId: string | null;
  variantName: string | null;
  isAgeRestricted: boolean;
};

export type CartStoreInformation = {
  id: string;
  name: string;
  icon: string;
  categorySlug?: string | null;
  deliveryFee: number;
  minimumOrder: number;
};

export type StoreCart = {
  storeId: string;
  storeName: string;
  storeIcon: string;
  categorySlug: string | null;
  deliveryFee: number;
  minimumOrder: number;
  items: CartItem[];
};

export type AddItemResult =
  | 'added'
  | 'different-restaurant'
  | 'unsupported-category';

export type CartState = {
  /** Store groups inside one customer-facing global Cart. */
  carts: Record<string, StoreCart>;
  activeStoreId: string | null;

  /** Compatibility snapshot for older screens. */
  storeId: string | null;
  storeName: string | null;
  storeIcon: string | null;
  deliveryFee: number;
  minimumOrder: number;
  items: CartItem[];
  hasHydrated: boolean;

  addItem: (store: CartStoreInformation, product: CartProduct) => AddItemResult;
  increaseItem: (productId: string, variantId?: string | null) => void;
  decreaseItem: (productId: string, variantId?: string | null) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  clearCart: () => void;
  setActiveCart: (storeId: string | null) => void;
  increaseStoreItem: (storeId: string, productId: string, variantId?: string | null) => void;
  decreaseStoreItem: (storeId: string, productId: string, variantId?: string | null) => void;
  removeStoreItem: (storeId: string, productId: string, variantId?: string | null) => void;
  removeStoreLine: (storeId: string, lineId: string) => void;
  clearStoreCart: (storeId: string) => void;
  clearAllCarts: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

type Persisted = Pick<CartState, 'carts' | 'activeStoreId'>;

type Legacy = Partial<Pick<
  CartState,
  | 'storeId'
  | 'storeName'
  | 'storeIcon'
  | 'deliveryFee'
  | 'minimumOrder'
  | 'items'
>>;

const emptyLegacy = {
  storeId: null,
  storeName: null,
  storeIcon: null,
  deliveryFee: 0,
  minimumOrder: 0,
  items: [] as CartItem[],
};

const normalizeVariant = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const numberOrZero = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const slug = value.trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
  return slug || null;
}

function normalizePrintJob(value: unknown): PrintJobSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<PrintJobSnapshot>;
  if (
    !raw.printingServiceId ||
    !raw.storeId ||
    !raw.productId ||
    !raw.productVariantId ||
    !raw.colorOptionId ||
    !raw.sideOptionId
  ) return null;

  return {
    ...(raw as PrintJobSnapshot),
    pageCount: Math.max(1, Math.floor(numberOrZero(raw.pageCount))),
    copyCount: Math.max(1, Math.floor(numberOrZero(raw.copyCount))),
    totalSheets: Math.max(1, Math.floor(numberOrZero(raw.totalSheets))),
    pricePerSheet: numberOrZero(raw.pricePerSheet),
    totalPrice: numberOrZero(raw.totalPrice),
    uiCopy: normalizePrintingUiCopy(raw.uiCopy),
    uiIcons: normalizePrintingUiIcons(raw.uiIcons),
  };
}

export function isPrintJobCartItem(
  item: CartItem,
): item is CartItem & { itemKind: 'print_job'; printJob: PrintJobSnapshot } {
  return item.itemKind === 'print_job' && item.printJob !== null;
}

/** Compatibility helper only; restaurant carts are no longer exclusive. */
export function isRestaurantCartCategory(value: string | null | undefined) {
  const slug = normalizeSlug(value);
  return slug === 'restaurant' || slug === 'restaurants';
}

function normalizeProduct(product: CartProduct): Omit<CartItem, 'quantity'> {
  const printJob = product.itemKind === 'print_job'
    ? normalizePrintJob(product.printJob)
    : null;
  const itemKind: CartItemKind = printJob ? 'print_job' : 'catalog_product';
  const variantId = printJob
    ? printJob.productVariantId
    : normalizeVariant(product.variantId);
  const lineId =
    normalizeVariant(product.lineId) ??
    (printJob
      ? `print-job:${printJob.printingServiceId}`
      : `catalog:${product.id}:${variantId ?? 'base'}`);

  return {
    ...product,
    id: printJob?.productId ?? product.id,
    name: printJob?.productName ?? product.name,
    description: printJob?.summary ?? product.description,
    price: printJob ? numberOrZero(printJob.totalPrice) : numberOrZero(product.price),
    icon: printJob?.productIcon ?? product.icon,
    lineId,
    itemKind,
    printJob,
    variantId,
    variantName: printJob?.summary ?? normalizeVariant(product.variantName),
    isAgeRestricted: product.isAgeRestricted === true,
  };
}

function normalizeItem(item: Partial<CartItem>): CartItem | null {
  if (!item.id || !item.name) return null;
  const product = normalizeProduct({
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    price: numberOrZero(item.price),
    icon: item.icon ?? '📦',
    lineId: item.lineId,
    itemKind: item.itemKind,
    printJob: item.printJob,
    variantId: item.variantId,
    variantName: item.variantName,
    isAgeRestricted: item.isAgeRestricted,
  });
  return {
    ...product,
    quantity: product.itemKind === 'print_job'
      ? 1
      : Math.max(1, Math.floor(numberOrZero(item.quantity) || 1)),
  };
}

function normalizeGroup(raw: Partial<StoreCart>, fallbackId?: string): StoreCart | null {
  const storeId = (raw.storeId || fallbackId || '').trim();
  if (!storeId) return null;
  const items = Array.isArray(raw.items)
    ? raw.items.map(normalizeItem).filter((item): item is CartItem => item !== null)
    : [];
  return {
    storeId,
    storeName: typeof raw.storeName === 'string' ? raw.storeName : '',
    storeIcon: typeof raw.storeIcon === 'string' && raw.storeIcon ? raw.storeIcon : '🏪',
    categorySlug: normalizeSlug(raw.categorySlug),
    deliveryFee: numberOrZero(raw.deliveryFee),
    minimumOrder: 0,
    items,
  };
}

function firstStore(carts: Record<string, StoreCart>) {
  return Object.values(carts).find((group) => group.items.length > 0)?.storeId ?? null;
}

function compatibilitySnapshot(
  carts: Record<string, StoreCart>,
  requestedId: string | null,
) {
  const id = requestedId && carts[requestedId] ? requestedId : firstStore(carts);
  if (!id) return { activeStoreId: null, ...emptyLegacy };
  const group = carts[id];
  return {
    activeStoreId: id,
    storeId: id,
    storeName: group.storeName,
    storeIcon: group.storeIcon,
    deliveryFee: GLOBAL_CART_DELIVERY_FEE,
    minimumOrder: 0,
    items: group.items,
  };
}

function normalizePersisted(value: unknown): Persisted {
  if (!value || typeof value !== 'object') return { carts: {}, activeStoreId: null };
  const raw = value as Partial<Persisted & Legacy>;
  const carts: Record<string, StoreCart> = {};

  if (raw.carts && typeof raw.carts === 'object' && !Array.isArray(raw.carts)) {
    Object.entries(raw.carts).forEach(([key, entry]) => {
      const group = normalizeGroup(entry as Partial<StoreCart>, key);
      if (group?.items.length) carts[group.storeId] = group;
    });
  } else if (raw.storeId && Array.isArray(raw.items) && raw.items.length) {
    const group = normalizeGroup({
      storeId: raw.storeId,
      storeName: raw.storeName ?? '',
      storeIcon: raw.storeIcon ?? '🏪',
      deliveryFee: raw.deliveryFee ?? 0,
      minimumOrder: 0,
      items: raw.items,
    });
    if (group) carts[group.storeId] = group;
  }

  const requested = typeof raw.activeStoreId === 'string' ? raw.activeStoreId : null;
  return {
    carts,
    activeStoreId: requested && carts[requested] ? requested : firstStore(carts),
  };
}

function sameCatalogLine(item: CartItem, productId: string, variantId?: string | null) {
  return !isPrintJobCartItem(item) &&
    item.id === productId &&
    normalizeVariant(item.variantId) === normalizeVariant(variantId);
}

function updateGroup(
  state: CartState,
  storeId: string,
  update: (items: CartItem[]) => CartItem[],
): CartState {
  const current = state.carts[storeId];
  if (!current) return state;
  const items = update(current.items);
  const carts = { ...state.carts };
  if (items.length) carts[storeId] = { ...current, items };
  else delete carts[storeId];
  return {
    ...state,
    carts,
    ...compatibilitySnapshot(
      carts,
      state.activeStoreId === storeId && !items.length ? null : state.activeStoreId,
    ),
  };
}

function mutateCatalogQuantity(
  items: CartItem[],
  productId: string,
  variantId: string | null | undefined,
  delta: 1 | -1,
) {
  return items.flatMap((item) => {
    if (!sameCatalogLine(item, productId, variantId)) return [item];
    const next = item.quantity + delta;
    return next <= 0 ? [] : [{ ...item, quantity: next }];
  });
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      carts: {},
      activeStoreId: null,
      ...emptyLegacy,
      hasHydrated: false,

      addItem: (store, product) => {
        let result: AddItemResult = 'added';
        set((state) => {
          const categorySlug = normalizeSlug(store.categorySlug);
          if (categorySlug && !isV1PublicCategorySlug(categorySlug)) {
            result = 'unsupported-category';
            return state;
          }

          const normalized = normalizeProduct(product);
          const existing = state.carts[store.id];
          const currentItems = existing?.items ?? [];
          const found = currentItems.find((item) => item.lineId === normalized.lineId);
          const items = found
            ? currentItems.map((item) => item.lineId === normalized.lineId
                ? { ...normalized, quantity: normalized.itemKind === 'print_job' ? 1 : item.quantity + 1 }
                : item)
            : [...currentItems, { ...normalized, quantity: 1 }];

          const carts = {
            ...state.carts,
            [store.id]: {
              storeId: store.id,
              storeName: store.name,
              storeIcon: store.icon || '🏪',
              categorySlug: categorySlug ?? existing?.categorySlug ?? null,
              deliveryFee: numberOrZero(store.deliveryFee),
              minimumOrder: 0,
              items,
            },
          };
          return { ...state, carts, ...compatibilitySnapshot(carts, store.id) };
        });
        return result;
      },

      increaseItem: (productId, variantId = null) => set((state) => {
        const id = state.activeStoreId ?? firstStore(state.carts);
        return id ? updateGroup(state, id, (items) => mutateCatalogQuantity(items, productId, variantId, 1)) : state;
      }),
      decreaseItem: (productId, variantId = null) => set((state) => {
        const id = state.activeStoreId ?? firstStore(state.carts);
        return id ? updateGroup(state, id, (items) => mutateCatalogQuantity(items, productId, variantId, -1)) : state;
      }),
      removeItem: (productId, variantId = null) => set((state) => {
        const id = state.activeStoreId ?? firstStore(state.carts);
        return id ? updateGroup(state, id, (items) => items.filter((item) => !sameCatalogLine(item, productId, variantId))) : state;
      }),
      clearCart: () => set((state) => ({ ...state, carts: {}, activeStoreId: null, ...emptyLegacy })),
      setActiveCart: (storeId) => set((state) => {
        const snapshot = compatibilitySnapshot(state.carts, storeId);
        if (
          state.activeStoreId === snapshot.activeStoreId &&
          state.storeId === snapshot.storeId &&
          state.storeName === snapshot.storeName &&
          state.storeIcon === snapshot.storeIcon &&
          state.deliveryFee === snapshot.deliveryFee &&
          state.minimumOrder === snapshot.minimumOrder &&
          state.items === snapshot.items
        ) {
          return state;
        }
        return { ...state, ...snapshot };
      }),
      increaseStoreItem: (storeId, productId, variantId = null) => set((state) =>
        updateGroup(state, storeId, (items) => mutateCatalogQuantity(items, productId, variantId, 1))),
      decreaseStoreItem: (storeId, productId, variantId = null) => set((state) =>
        updateGroup(state, storeId, (items) => mutateCatalogQuantity(items, productId, variantId, -1))),
      removeStoreItem: (storeId, productId, variantId = null) => set((state) =>
        updateGroup(state, storeId, (items) => items.filter((item) => !sameCatalogLine(item, productId, variantId)))),
      removeStoreLine: (storeId, lineId) => set((state) =>
        updateGroup(state, storeId, (items) => items.filter((item) => item.lineId !== lineId.trim()))),
      clearStoreCart: (storeId) => set((state) =>
        updateGroup(state, storeId, () => [])),
      clearAllCarts: () => set((state) => ({ ...state, carts: {}, activeStoreId: null, ...emptyLegacy })),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'navienty-now-cart',
      storage: createJSONStorage(() => resilientAsyncStorage),
      partialize: (state): Persisted => ({ carts: state.carts, activeStoreId: state.activeStoreId }),
      version: 5,
      migrate: (value) => normalizePersisted(value),
      merge: (persistedState, currentState) => {
        const persisted = normalizePersisted(persistedState);
        return {
          ...currentState,
          ...persisted,
          ...compatibilitySnapshot(persisted.carts, persisted.activeStoreId),
        } as CartState;
      },
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);

export function selectStoreCart(state: CartState, storeId: string | null | undefined) {
  return storeId ? state.carts[storeId] ?? null : null;
}

export function selectStoreCartItemCount(state: CartState, storeId: string | null | undefined) {
  return selectStoreCart(state, storeId)?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
}

export function selectStoreCartSubtotal(state: CartState, storeId: string | null | undefined) {
  return selectStoreCart(state, storeId)?.items.reduce((sum, item) => sum + item.price * item.quantity, 0) ?? 0;
}

export const selectAllCartItemCount = (state: CartState) =>
  Object.values(state.carts).reduce(
    (sum, group) => sum + group.items.reduce((groupSum, item) => groupSum + item.quantity, 0),
    0,
  );

export const selectAllCartSubtotal = (state: CartState) =>
  Object.values(state.carts).reduce(
    (sum, group) => sum + group.items.reduce((groupSum, item) => groupSum + item.price * item.quantity, 0),
    0,
  );

export const selectCartItemCount = selectAllCartItemCount;
export const selectCartSubtotal = selectAllCartSubtotal;
export const selectCartTotal = (state: CartState) => {
  const count = selectAllCartItemCount(state);
  return count > 0 ? selectAllCartSubtotal(state) + GLOBAL_CART_DELIVERY_FEE : 0;
};
export const selectGlobalCartStoreCount = (state: CartState) =>
  Object.values(state.carts).filter((group) => group.items.length > 0).length;