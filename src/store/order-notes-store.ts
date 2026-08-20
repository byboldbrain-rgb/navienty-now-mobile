import { create } from 'zustand';

type OrderNotesState = {
  notes: Record<string, string>;

  setNote: (
    storeId: string,
    note: string,
  ) => void;

  clearNote: (
    storeId: string,
  ) => void;

  clearAllNotes: () => void;
};

/**
 * Order notes are scoped to each store cart.
 *
 * They stay in memory while the customer moves from Cart -> Location ->
 * Checkout, then they are cleared when the cart is cleared or when the
 * order is created successfully.
 */
export const useOrderNotesStore =
  create<OrderNotesState>((set) => ({
    notes: {},

    setNote: (
      storeId,
      note,
    ) => {
      const normalizedStoreId =
        storeId.trim();

      if (!normalizedStoreId) {
        return;
      }

      set((state) => {
        const nextNotes = {
          ...state.notes,
        };

        if (note.length > 0) {
          nextNotes[
            normalizedStoreId
          ] = note;
        } else {
          delete nextNotes[
            normalizedStoreId
          ];
        }

        return {
          notes: nextNotes,
        };
      });
    },

    clearNote: (
      storeId,
    ) => {
      const normalizedStoreId =
        storeId.trim();

      if (!normalizedStoreId) {
        return;
      }

      set((state) => {
        if (
          !Object.prototype.hasOwnProperty.call(
            state.notes,
            normalizedStoreId,
          )
        ) {
          return state;
        }

        const nextNotes = {
          ...state.notes,
        };

        delete nextNotes[
          normalizedStoreId
        ];

        return {
          notes: nextNotes,
        };
      });
    },

    clearAllNotes: () => {
      set({
        notes: {},
      });
    },
  }));
