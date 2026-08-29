import {
    type Order,
} from '../store/orders-store';
import {
    searchGlobalCatalog,
    type GlobalSearchResult,
} from './global-search-service';
import {
    getRecentlyViewedItems,
    type RecentlyViewedItem,
} from './recently-viewed-service';
import {
    getRecentSearches,
} from './search-history-service';

export type ForYouRecommendation = {
  id: string;
  result: Exclude<
    GlobalSearchResult,
    {
      kind: 'service';
    }
  >;
  reason: string;
  score: number;
};

type RecommendationSignal = {
  query: string;
  label: string;
  source:
    | 'search'
    | 'viewed'
    | 'order';
  weight: number;
};

type RankedCandidate = {
  result: Exclude<
    GlobalSearchResult,
    {
      kind: 'service';
    }
  >;
  score: number;
  reason: string;
};

const MAX_SIGNALS = 10;
const MAX_RECOMMENDATIONS = 8;
const MIN_PRIMARY_RECOMMENDATIONS = 4;

function normalizeText(
  value: string | null | undefined,
): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(
      /[\u064B-\u065F\u0670]/g,
      '',
    )
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLocaleLowerCase('ar')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getOrderTimestamp(
  order: Order,
): number {
  return new Date(
    order.deliveredAt ??
      order.updatedAt ??
      order.createdAt,
  ).getTime();
}

function deduplicateSignals(
  signals:
    readonly RecommendationSignal[],
): RecommendationSignal[] {
  const byKey =
    new Map<
      string,
      RecommendationSignal
    >();

  for (const signal of signals) {
    const normalizedQuery =
      normalizeText(signal.query);

    if (
      normalizedQuery.length < 2
    ) {
      continue;
    }

    const key =
      `${signal.source}:` +
      normalizedQuery;

    const existing =
      byKey.get(key);

    if (
      !existing ||
      signal.weight >
        existing.weight
    ) {
      byKey.set(key, signal);
    }
  }

  return Array.from(
    byKey.values(),
  )
    .sort(
      (first, second) =>
        second.weight -
        first.weight,
    )
    .slice(0, MAX_SIGNALS);
}

function buildSignals(
  recentSearches:
    readonly string[],
  recentlyViewed:
    readonly RecentlyViewedItem[],
  orders:
    readonly Order[],
): RecommendationSignal[] {
  const signals:
    RecommendationSignal[] = [];

  recentSearches
    .slice(0, 4)
    .forEach(
      (search, index) => {
        signals.push({
          query: search,
          label: search,
          source: 'search',
          weight:
            15 - index * 1.5,
        });
      },
    );

  recentlyViewed
    .slice(0, 5)
    .forEach(
      (item, index) => {
        signals.push({
          query: item.title,
          label: item.title,
          source: 'viewed',
          weight:
            11 - index,
        });

        if (
          item.subtitle &&
          item.kind !== 'store'
        ) {
          signals.push({
            query: item.subtitle,
            label: item.subtitle,
            source: 'viewed',
            weight:
              7.5 - index * 0.5,
          });
        }
      },
    );

  orders
    .filter(
      (order) =>
        order.status ===
        'delivered',
    )
    .sort(
      (first, second) =>
        getOrderTimestamp(second) -
        getOrderTimestamp(first),
    )
    .slice(0, 4)
    .forEach(
      (order, orderIndex) => {
        if (order.storeName) {
          signals.push({
            query:
              order.storeName,
            label:
              order.storeName,
            source: 'order',
            weight:
              10 -
              orderIndex * 0.75,
          });
        }

        order.items
          .slice(0, 2)
          .forEach(
            (item, itemIndex) => {
              signals.push({
                query: item.name,
                label: item.name,
                source: 'order',
                weight:
                  9 -
                  orderIndex * 0.7 -
                  itemIndex * 0.6,
              });
            },
          );
      },
    );

  return deduplicateSignals(
    signals,
  );
}

function getKindBoost(
  result: Exclude<
    GlobalSearchResult,
    {
      kind: 'service';
    }
  >,
): number {
  switch (result.kind) {
    case 'product':
      return 6;
    case 'store':
      return 3.5;
    case 'category':
      return 2.5;
  }
}

function getSignalReason(
  signal: RecommendationSignal,
): string {
  switch (signal.source) {
    case 'search':
      return `على حسب بحثك عن ${signal.label}`;

    case 'viewed':
      return `لأنك شوفت ${signal.label}`;

    case 'order':
      return 'من طلباتك السابقة';
  }
}

function isSameAsRecentlyViewed(
  result: Exclude<
    GlobalSearchResult,
    {
      kind: 'service';
    }
  >,
  recentlyViewed:
    readonly RecentlyViewedItem[],
): boolean {
  for (
    const item of
    recentlyViewed
  ) {
    if (
      result.kind === 'store' &&
      item.kind === 'store' &&
      result.storeId ===
        item.storeId
    ) {
      return true;
    }

    if (
      result.kind === 'category' &&
      item.kind === 'category' &&
      result.storeId ===
        item.storeId &&
      (
        result.sectionId ===
          item.sectionId ||
        result.sectionSlug ===
          item.sectionSlug
      )
    ) {
      return true;
    }

    if (
      result.kind === 'product' &&
      item.kind === 'product' &&
      result.storeId ===
        item.storeId &&
      normalizeText(
        result.title,
      ) ===
        normalizeText(
          item.title,
        )
    ) {
      return true;
    }
  }

  return false;
}

function shouldUseResult(
  result: GlobalSearchResult,
): result is Exclude<
  GlobalSearchResult,
  {
    kind: 'service';
  }
> {
  if (
    result.kind === 'service'
  ) {
    return false;
  }

  if (
    result.kind === 'store' &&
    result.isManuallyClosed
  ) {
    return false;
  }

  return true;
}

function mergeCandidate(
  target:
    Map<string, RankedCandidate>,
  result: Exclude<
    GlobalSearchResult,
    {
      kind: 'service';
    }
  >,
  contribution: number,
  reason: string,
) {
  const current =
    target.get(result.id);

  if (!current) {
    target.set(
      result.id,
      {
        result,
        score:
          contribution +
          getKindBoost(result),
        reason,
      },
    );

    return;
  }

  target.set(
    result.id,
    {
      ...current,
      score:
        current.score +
        contribution * 0.62,
      reason:
        contribution >
        current.score * 0.45
          ? reason
          : current.reason,
    },
  );
}

export async function getForYouRecommendations(
  options: {
    serviceAreaId?: string | null;
    orders: readonly Order[];
  },
): Promise<
  ForYouRecommendation[]
> {
  const [
    recentSearches,
    recentlyViewed,
  ] = await Promise.all([
    getRecentSearches(6),
    getRecentlyViewedItems(10),
  ]);

  const signals =
    buildSignals(
      recentSearches,
      recentlyViewed,
      options.orders,
    );

  if (signals.length === 0) {
    return [];
  }

  const responses =
    (
      await Promise.all(
        signals.map(
          async (signal) => {
            try {
              return {
                signal,
                response:
                  await searchGlobalCatalog(
                    signal.query,
                    options.serviceAreaId,
                  ),
              };
            } catch {
              /*
               * One failed signal must not remove the whole For You rail.
               * Other searches can still produce useful recommendations.
               */
              return null;
            }
          },
        ),
      )
    ).filter(
      (
        item,
      ): item is {
        signal: RecommendationSignal;
        response: Awaited<
          ReturnType<
            typeof searchGlobalCatalog
          >
        >;
      } => item !== null,
    );

  const primary =
    new Map<
      string,
      RankedCandidate
    >();

  const fallback =
    new Map<
      string,
      RankedCandidate
    >();

  for (
    const {
      signal,
      response,
    } of responses
  ) {
    response.results
      .slice(0, 14)
      .forEach(
        (result, index) => {
          if (
            !shouldUseResult(
              result,
            )
          ) {
            return;
          }

          const rankFactor =
            Math.max(
              0.25,
              1 -
                index *
                  0.055,
            );

          const contribution =
            signal.weight *
            rankFactor;

          const reason =
            getSignalReason(
              signal,
            );

          const target =
            isSameAsRecentlyViewed(
              result,
              recentlyViewed,
            )
              ? fallback
              : primary;

          mergeCandidate(
            target,
            result,
            contribution,
            reason,
          );
        },
      );
  }

  const sortCandidates = (
    source:
      Map<
        string,
        RankedCandidate
      >,
  ) =>
    Array.from(
      source.values(),
    ).sort(
      (first, second) =>
        second.score -
          first.score ||
        first.result.title.localeCompare(
          second.result.title,
          'ar',
        ),
    );

  const primaryItems =
    sortCandidates(primary);

  const fallbackItems =
    sortCandidates(fallback);

  const selected =
    primaryItems.slice(
      0,
      MAX_RECOMMENDATIONS,
    );

  if (
    selected.length <
    MIN_PRIMARY_RECOMMENDATIONS
  ) {
    const missing =
      MAX_RECOMMENDATIONS -
      selected.length;

    selected.push(
      ...fallbackItems.slice(
        0,
        missing,
      ),
    );
  }

  return selected
    .slice(
      0,
      MAX_RECOMMENDATIONS,
    )
    .map(
      (candidate) => ({
        id:
          `for-you:` +
          candidate.result.id,
        result:
          candidate.result,
        reason:
          candidate.reason,
        score:
          candidate.score,
      }),
    );
}
