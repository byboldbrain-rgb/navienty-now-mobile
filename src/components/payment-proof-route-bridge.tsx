import {
  useGlobalSearchParams,
  usePathname,
  useRouter,
} from 'expo-router';
import { useEffect, useRef } from 'react';

import { prepareOrderPaymentProof } from '../services/order-payment-proof-service';

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
 * Payment proof rollout is remotely gated in Supabase.
 *
 * Checkout keeps its existing route to /order-success, so old builds and the
 * current WhatsApp flow remain untouched while payment proof is disabled.
 * Once the server marks a newly-created order as payment_proof_required,
 * this bridge redirects only that order to the private proof-upload screen.
 */
export default function PaymentProofRouteBridge() {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{
    id?: string | string[];
  }>();
  const router = useRouter();

  const inFlightOrderIdRef =
    useRef<string | null>(null);

  useEffect(() => {
    if (pathname !== '/order-success') {
      inFlightOrderIdRef.current = null;
      return;
    }

    const orderId =
      getSingleParam(params.id);

    if (
      !orderId ||
      !UUID_PATTERN.test(orderId) ||
      inFlightOrderIdRef.current === orderId
    ) {
      return;
    }

    let cancelled = false;
    inFlightOrderIdRef.current = orderId;

    async function resolvePaymentProofRoute() {
      try {
        const preparation =
          await prepareOrderPaymentProof(
            orderId,
          );

        if (
          !cancelled &&
          preparation.required
        ) {
          router.replace({
            pathname: '/payment-proof',
            params: { id: orderId },
          });
        }
      } catch (error) {
        /**
         * Payment verification must never make order tracking unreachable.
         * The server-side confirmation gate is authoritative; a temporary
         * network error here leaves the customer on /order-success and the
         * route will be re-evaluated on the next visit.
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
  }, [pathname, params.id, router]);

  return null;
}
