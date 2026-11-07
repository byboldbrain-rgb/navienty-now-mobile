import { useQuery } from '@tanstack/react-query';

import { listSupermarketMediaCards } from '../services/supermarket-media-card-service';

/**
 * Separate public query. Media failures do not block the supermarket.
 * Unlike product data, promotional cards are not written to disk cache.
 */
export function useSupermarketMediaCardsQuery(storeId: string | null) {
  return useQuery({
    queryKey: ['public', 'supermarket', 'top-media', storeId],
    queryFn: () => listSupermarketMediaCards(storeId!),
    enabled: Boolean(storeId),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
    meta: { persist: false },
  });
}
