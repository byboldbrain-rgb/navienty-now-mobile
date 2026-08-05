import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
    createJSONStorage,
    persist,
} from 'zustand/middleware';

export type CartProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
};

export type CartItem = CartProduct & {
  quantity: number;
};

export type CartStoreInformation = {
  id: string;
  name: string;
  icon: string;
  deliveryFee: number;
  minimumOrder: number;
};

export type AddItemResult =
  | 'added'
  | 'different-store';

type CartState = {
  storeId: string | null;
  storeName: string | null;
  storeIcon: string | null;
  deliveryFee: number;
  minimumOrder: number;
  items: CartItem[];

  hasHydrated: boolean;

  addItem: (
    store: CartStoreInformation,
    product: CartProduct,
  ) => AddItemResult;

  increaseItem: (productId: string) => void;
  decreaseItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;

  setHasHydrated: (
    hasHydrated: boolean,
  ) => void;
};

type PersistedCartState = Pick<
  CartState,
  | 'storeId'
  | 'storeName'
  | 'storeIcon'
  | 'deliveryFee'
  | 'minimumOrder'
  | 'items'
>;

const initialCartState: PersistedCartState = {
  storeId: null,
  storeName: null,
  storeIcon: null,
  deliveryFee: 0,
  minimumOrder: 0,
  items: [],
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      ...initialCartState,

      hasHydrated: false,

      addItem: (store, product) => {
        let result: AddItemResult = 'added';

        set((state) => {
          const cartContainsAnotherStore =
            state.items.length > 0 &&
            state.storeId !== null &&
            state.storeId !== store.id;

          if (cartContainsAnotherStore) {
            result = 'different-store';

            return state;
          }

          const existingItem = state.items.find(
            (item) => item.id === product.id,
          );

          const nextItems = existingItem
            ? state.items.map((item) =>
                item.id === product.id
                  ? {
                      ...item,
                      quantity:
                        item.quantity + 1,
                    }
                  : item,
              )
            : [
                ...state.items,
                {
                  ...product,
                  quantity: 1,
                },
              ];

          return {
            storeId: store.id,
            storeName: store.name,
            storeIcon: store.icon,
            deliveryFee: store.deliveryFee,
            minimumOrder: store.minimumOrder,
            items: nextItems,
          };
        });

        return result;
      },

      increaseItem: (productId) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === productId
              ? {
                  ...item,
                  quantity:
                    item.quantity + 1,
                }
              : item,
          ),
        }));
      },

      decreaseItem: (productId) => {
        set((state) => {
          const selectedItem =
            state.items.find(
              (item) =>
                item.id === productId,
            );

          if (!selectedItem) {
            return state;
          }

          const nextItems =
            selectedItem.quantity <= 1
              ? state.items.filter(
                  (item) =>
                    item.id !== productId,
                )
              : state.items.map((item) =>
                  item.id === productId
                    ? {
                        ...item,
                        quantity:
                          item.quantity - 1,
                      }
                    : item,
                );

          if (nextItems.length === 0) {
            return {
              ...initialCartState,
            };
          }

          return {
            items: nextItems,
          };
        });
      },

      removeItem: (productId) => {
        set((state) => {
          const nextItems =
            state.items.filter(
              (item) =>
                item.id !== productId,
            );

          if (nextItems.length === 0) {
            return {
              ...initialCartState,
            };
          }

          return {
            items: nextItems,
          };
        });
      },

      clearCart: () => {
        set({
          ...initialCartState,
        });
      },

      setHasHydrated: (hasHydrated) => {
        set({
          hasHydrated,
        });
      },
    }),

    {
      name: 'navienty-now-cart',

      storage: createJSONStorage(
        () => AsyncStorage,
      ),

      partialize: (
        state,
      ): PersistedCartState => ({
        storeId: state.storeId,
        storeName: state.storeName,
        storeIcon: state.storeIcon,
        deliveryFee: state.deliveryFee,
        minimumOrder: state.minimumOrder,
        items: state.items,
      }),

      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },

      version: 1,
    },
  ),
);

export const selectCartItemCount = (
  state: CartState,
) =>
  state.items.reduce(
    (total, item) =>
      total + item.quantity,
    0,
  );

export const selectCartSubtotal = (
  state: CartState,
) =>
  state.items.reduce(
    (total, item) =>
      total +
      item.price * item.quantity,
    0,
  );

export const selectCartTotal = (
  state: CartState,
) => {
  const subtotal =
    selectCartSubtotal(state);

  if (state.items.length === 0) {
    return 0;
  }

  return subtotal + state.deliveryFee;
};
