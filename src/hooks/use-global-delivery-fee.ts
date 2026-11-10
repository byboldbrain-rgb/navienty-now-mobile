import { useEffect, useState } from 'react';

import {
  getDeliveryLocationErrorMessage,
  resolveDeliveryLocation,
} from '../services/delivery-location-service';

type FeeQuote = {
  key: string;
  deliveryFee: number | null;
  error: string | null;
};

/**
 * Location-aware checkout quote. Resolves each store against the authoritative
 * DB fee matrix, retaining explicit zeroes. One shared fee is the maximum
 * store fee (not the sum or an area-wide fixed amount).
 *
 * A quote belongs to a specific (stores, latitude, longitude) key, so an old
 * location's fee is never displayed while the new request is in flight.
 */
export function useGlobalDeliveryFee(
  storeIds: readonly string[],
  latitude: number | null | undefined,
  longitude: number | null | undefined,
) {
  const idsKey = storeIds.filter(Boolean).join('|');
  const hasLocation =
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude);
  const key = `${idsKey}/${latitude ?? ''}/${longitude ?? ''}`;
  const [quote, setQuote] = useState<FeeQuote | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!idsKey || !hasLocation) {
      return () => { cancelled = true; };
    }

    const ids = idsKey.split('|');
    void Promise.all(
      ids.map((storeId) =>
        resolveDeliveryLocation({
          storeId,
          latitude: latitude as number,
          longitude: longitude as number,
        }),
      ),
    ).then((results) => {
      if (cancelled) return;
      const unavailable = results.find(
        (result) => !result.serviceable || result.storeAvailable !== true,
      );
      if (unavailable) {
        setQuote({
          key,
          deliveryFee: null,
          error: getDeliveryLocationErrorMessage(unavailable.reason),
        });
        return;
      }
      const fees = results.map((result) => result.deliveryFee);
      if (fees.some((fee) => fee === null || !Number.isFinite(fee) || fee < 0)) {
        setQuote({ key, deliveryFee: null, error: 'تعذر حساب رسوم التوصيل.' });
        return;
      }
      setQuote({
        key,
        deliveryFee: Math.max(...(fees as number[])),
        error: null,
      });
    }).catch(() => {
      if (!cancelled) {
        setQuote({
          key,
          deliveryFee: null,
          error: 'تعذر حساب رسوم التوصيل. حاول مرة أخرى.',
        });
      }
    });

    return () => { cancelled = true; };
  }, [idsKey, key, hasLocation, latitude, longitude]);

  const current = quote?.key === key ? quote : null;
  return {
    deliveryFee: hasLocation && idsKey ? current?.deliveryFee ?? null : null,
    error: current?.error ?? null,
    isLoading: Boolean(idsKey && hasLocation && !current),
  };
}
