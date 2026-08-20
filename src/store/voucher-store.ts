import { create } from 'zustand';

import type {
  VoucherQuote,
} from '../services/voucher-service';

type VoucherState = {
  vouchers: Record<
    string,
    VoucherQuote
  >;

  setVoucher: (
    storeId: string,
    voucher: VoucherQuote | null,
  ) => void;

  clearVoucher: (
    storeId: string,
  ) => void;

  clearAllVouchers: () => void;
};

/**
 * Voucher quotes intentionally stay in memory only.
 *
 * Eligibility, limits, delivery fees and expiry can change at any time,
 * so Checkout revalidates the quote against Supabase whenever the cart
 * subtotal or resolved delivery fee differs from the applied snapshot.
 */
export const useVoucherStore =
  create<VoucherState>((set) => ({
    vouchers: {},

    setVoucher: (
      storeId,
      voucher,
    ) => {
      const normalizedStoreId =
        storeId.trim();

      if (!normalizedStoreId) {
        return;
      }

      set((state) => {
        const nextVouchers = {
          ...state.vouchers,
        };

        if (voucher) {
          nextVouchers[
            normalizedStoreId
          ] = voucher;
        } else {
          delete nextVouchers[
            normalizedStoreId
          ];
        }

        return {
          vouchers: nextVouchers,
        };
      });
    },

    clearVoucher: (
      storeId,
    ) => {
      const normalizedStoreId =
        storeId.trim();

      if (!normalizedStoreId) {
        return;
      }

      set((state) => {
        if (
          !state.vouchers[
            normalizedStoreId
          ]
        ) {
          return state;
        }

        const nextVouchers = {
          ...state.vouchers,
        };

        delete nextVouchers[
          normalizedStoreId
        ];

        return {
          vouchers: nextVouchers,
        };
      });
    },

    clearAllVouchers: () => {
      set({ vouchers: {} });
    },
  }));
