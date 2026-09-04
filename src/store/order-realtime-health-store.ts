import { create } from 'zustand';

export type OrderRealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'subscribed'
  | 'error';

type OrderRealtimeHealthState = {
  userId: string | null;
  status: OrderRealtimeStatus;

  setStatus: (
    userId: string | null,
    status: OrderRealtimeStatus,
  ) => void;

  reset: () => void;
};

/**
 * Ephemeral connection health only. This must never be persisted because
 * realtime subscription state is valid only for the current app process and
 * authenticated session.
 */
export const useOrderRealtimeHealthStore =
  create<OrderRealtimeHealthState>(
    (set) => ({
      userId: null,
      status: 'idle',

      setStatus: (
        userId,
        status,
      ) => {
        set({
          userId,
          status,
        });
      },

      reset: () => {
        set({
          userId: null,
          status: 'idle',
        });
      },
    }),
  );
