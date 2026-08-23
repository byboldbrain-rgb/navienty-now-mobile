import {
  useGlobalSearchParams,
  usePathname,
  useRouter,
} from 'expo-router';
import { useEffect, useRef } from 'react';

import { prepareOrderPaymentProof } from '../services/order-payment-proof-service';
import { prepareServiceBookingPaymentProof } from '../services/service-booking-payment-proof-service';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSingleParam(
  value:
    | string
    | string[]
    | undefined,
): string | undefined {
  return Array.isArray(value)
    ? value[0]
    : value;
}

/**
 * Payment proof rollouts are remotely gated in Supabase.
 *
 * Existing checkout flows continue to navigate to /order-success. This bridge
 * only intercepts a newly-created store order or service booking when its
 * server-side payment-proof snapshot says verification is required.
 */
export default function PaymentProofRouteBridge() {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{
    id?: string | string[];
    serviceBookingId?: string | string[];
  }>();
  const router = useRouter();

  const inFlightKeyRef =
    useRef<string | null>(null);

  useEffect(() => {
    if (pathname !== '/order-success') {
      inFlightKeyRef.current = null;
      return;
    }

    const serviceBookingId =
      getSingleParam(
        params.serviceBookingId,
      );

    const orderId =
      getSingleParam(params.id);

    const hasValidServiceBookingId =
      Boolean(
        serviceBookingId &&
          UUID_PATTERN.test(
            serviceBookingId,
          ),
      );

    const hasValidOrderId =
      Boolean(
        orderId &&
          UUID_PATTERN.test(orderId),
      );

    if (
      !hasValidServiceBookingId &&
      !hasValidOrderId
    ) {
      return;
    }

    const target =
      hasValidServiceBookingId &&
      serviceBookingId
        ? {
            key:
              `service:${serviceBookingId}`,
            kind: 'service' as const,
            id: serviceBookingId,
          }
        : {
            key: `order:${orderId!}`,
            kind: 'order' as const,
            id: orderId!,
          };

    if (
      inFlightKeyRef.current ===
      target.key
    ) {
      return;
    }

    let cancelled = false;
    inFlightKeyRef.current = target.key;

    async function resolvePaymentProofRoute() {
      try {
        if (target.kind === 'service') {
          const preparation =
            await prepareServiceBookingPaymentProof(
              target.id,
            );

          if (
            !cancelled &&
            preparation.required
          ) {
            router.replace({
              pathname:
                '/service-booking-payment-proof',
              params: {
                id: target.id,
              },
            });
          }

          return;
        }

        const preparation =
          await prepareOrderPaymentProof(
            target.id,
          );

        if (
          !cancelled &&
          preparation.required
        ) {
          router.replace({
            pathname: '/payment-proof',
            params: {
              id: target.id,
            },
          });
        }
      } catch (error) {
        /**
         * Payment verification must never make tracking unreachable.
         * Server-side confirmation guards remain authoritative; a temporary
         * network error here leaves the customer on /order-success.
         */
        console.warn(
          'Unable to resolve payment proof route:',
          error,
        );
      }
    }

    void resolvePaymentProofRoute();

    return () => {
      cancelled = true;
    };
  }, [
    pathname,
    params.id,
    params.serviceBookingId,
    router,
  ]);

  return null;
}
