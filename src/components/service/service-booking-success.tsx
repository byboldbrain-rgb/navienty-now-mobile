import { useFocusEffect } from 'expo-router';
import {
  useCallback,
  useState,
} from 'react';

import { supabase } from '../../lib/supabase';
import ServiceBookingSuccessView from './service-booking-success-view';

type ServiceBookingSuccessProps = {
  serviceBookingId: string;
};

/**
 * Keeps the existing tracking UI untouched while adding a private Realtime
 * invalidation channel. The legacy 8-second polling inside the view remains
 * as a rollout fallback until Realtime is verified on physical builds.
 */
export default function ServiceBookingSuccess({
  serviceBookingId,
}: ServiceBookingSuccessProps) {
  const [realtimeVersion, setRealtimeVersion] =
    useState(0);

  useFocusEffect(
    useCallback(() => {
      let disposed = false;
      let realtimeChannel:
        ReturnType<typeof supabase.channel> | null = null;

      async function connectRealtime() {
        try {
          const {
            data,
            error,
          } = await supabase.auth.getSession();

          if (
            disposed ||
            error ||
            !data.session?.user?.id ||
            !data.session.access_token
          ) {
            if (error) {
              console.warn(
                'Unable to read session for service booking realtime:',
                error,
              );
            }
            return;
          }

          const userId = data.session.user.id;

          await supabase.realtime.setAuth(
            data.session.access_token,
          );

          if (disposed) {
            return;
          }

          const channel = supabase.channel(
            `customer:${userId}:service-bookings`,
            {
              config: {
                private: true,
              },
            },
          );

          channel.on(
            'broadcast',
            {
              event:
                'service_booking_updated',
            },
            (message) => {
              const payload =
                message.payload as {
                  service_booking_id?: unknown;
                };

              if (
                payload
                  ?.service_booking_id !==
                serviceBookingId
              ) {
                return;
              }

              /**
               * Treat Broadcast only as an invalidation signal. Remounting the
               * existing view makes it reload the owner-scoped booking from
               * Supabase rather than trusting status data from the event.
               */
              setRealtimeVersion(
                (version) => version + 1,
              );
            },
          );

          channel.subscribe(
            (status) => {
              if (
                status ===
                'CHANNEL_ERROR'
              ) {
                console.warn(
                  'Service booking realtime channel failed to subscribe.',
                );
              }
            },
          );

          realtimeChannel = channel;
        } catch (error) {
          console.warn(
            'Unable to connect service booking realtime:',
            error,
          );
        }
      }

      void connectRealtime();

      return () => {
        disposed = true;

        if (realtimeChannel) {
          void supabase.removeChannel(
            realtimeChannel,
          );
        }
      };
    }, [serviceBookingId]),
  );

  return (
    <ServiceBookingSuccessView
      key={`${serviceBookingId}:${realtimeVersion}`}
      serviceBookingId={serviceBookingId}
    />
  );
}
