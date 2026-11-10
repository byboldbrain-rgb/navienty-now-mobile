import {
  isV1PublicCategorySlug,
} from '../config/v1-release-scope';
import { publicSupabase } from '../lib/supabase';
import { isRetryablePublicQueryError } from '../lib/user-facing-error';
import {
  isUsableAppBootstrap,
  readCachedAppBootstrap,
  writeCachedAppBootstrap,
} from './bootstrap-cache-service';
import {
  recordStartupTimingOnce,
} from './startup-performance-service';

export type AppArtworkMap = Record<string, string>;

export type AppSettings = {
  app_name: string;
  app_slug: string;
  app_logo_url: string | null;
  artwork?: AppArtworkMap;
  default_locale: string;
  timezone: string;
  currency_code: string;
  currency_symbol: string;
  default_city_id: string | null;
  default_service_area_id: string | null;
  whatsapp_number: string | null;
  support_phone: string | null;
  support_whatsapp: string | null;
  support_email: string | null;
  catalog_enabled: boolean;
  orders_enabled: boolean;
  maintenance_mode: boolean;
  maintenance_message_ar: string | null;
  maintenance_message_en: string | null;
  minimum_supported_app_version:
    | string
    | null;
  privacy_url: string | null;
  terms_url: string | null;
};

export type ServiceArea = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  default_delivery_fee: number;
  default_minimum_order_amount:
    | number
    | null;
  default_estimated_delivery_minutes:
    | number
    | null;
};

export type City = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  areas: ServiceArea[];
};

export type StoreCategory = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  subtitle_ar?: string | null;
  subtitle_en?: string | null;
  icon: string | null;
  image_url: string | null;
};

export type PaymentMethod = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  subtitle_ar: string | null;
  subtitle_en: string | null;
  icon: string | null;
  icon_url: string | null;
  instructions_ar?: string | null;
  instructions_en?: string | null;
  processing_fee_enabled?: boolean | null;
  processing_fee_type?: string | null;
  processing_fee_percentage?: number | string | null;
  processing_fee_fixed_amount?: number | string | null;
  processing_fee_min_amount?: number | string | null;
  processing_fee_max_amount?: number | string | null;
  processing_fee_charge_customer?: boolean | null;
  processing_fee_label_ar?: string | null;
  processing_fee_label_en?: string | null;
  requires_payment_proof?: boolean | null;
};

export type AppBootstrap = {
  settings: AppSettings;
  cities: City[];
  store_categories: StoreCategory[];
  payment_methods: PaymentMethod[];
};

export type ResolvedServiceArea = {
  city: City;
  area: ServiceArea;
};

type ServiceCategoryRow = {
  id: number | string;
  slug: string;
  name_ar: string;
  name_en: string;
  icon: string | null;
};

const APP_BOOTSTRAP_CACHE_TTL_MS =
  5 * 60 * 1000;
// Keep cached fallback briefly in memory so a restored connection can refresh.
const APP_BOOTSTRAP_FALLBACK_MEMORY_TTL_MS = 30 * 1000;
// The initial request plus two bounded retries for transient transport errors.
const APP_BOOTSTRAP_RETRY_DELAYS_MS = [300, 900] as const;

let cachedAppBootstrap:
  | {
      value: AppBootstrap;
      expiresAt: number;
    }
  | null = null;

let appBootstrapRequest:
  | Promise<AppBootstrap>
  | null = null;

function isBookstoreSlug(
  slug: string,
): boolean {
  const normalizedSlug =
    slug.trim().toLowerCase();

  return (
    normalizedSlug === 'bookstore' ||
    normalizedSlug === 'bookstores'
  );
}

async function getBookstoreCategory():
  Promise<StoreCategory | null> {
  const { data, error } = await publicSupabase
    .from('service_categories')
    .select(`
      id,
      slug,
      name_ar,
      name_en,
      icon
    `)
    .in('slug', [
      'bookstore',
      'bookstores',
    ])
    .eq('is_active', true)
    .order('sort_order', {
      ascending: true,
    })
    .limit(1)
    .maybeSingle<ServiceCategoryRow>();

  if (error) {
    console.warn(
      'Could not load bookstore category:',
      error.message,
    );

    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: String(data.id),
    slug: data.slug,
    name_ar: data.name_ar,
    name_en: data.name_en,
    icon: data.icon,
    image_url: null,
  };
}

function findServiceAreaById(
  bootstrap: AppBootstrap,
  serviceAreaId: string | null | undefined,
): ResolvedServiceArea | null {
  if (!serviceAreaId) {
    return null;
  }

  for (const city of bootstrap.cities) {
    const area = city.areas.find(
      (currentArea) =>
        currentArea.id === serviceAreaId,
    );

    if (area) {
      return {
        city,
        area,
      };
    }
  }

  return null;
}

async function loadAppBootstrap():
  Promise<AppBootstrap> {
  const rpcStartedAt = Date.now();
  let rpcOutcome:
    | 'success'
    | 'error' = 'success';

  try {
    const { data, error } =
      await publicSupabase.rpc(
        'get_app_bootstrap',
      );

    if (error) {
      throw new Error(
        `Supabase bootstrap failed: ${error.message}`,
      );
    }

    if (!data) {
      throw new Error(
        'Supabase bootstrap returned no data.',
      );
    }

    if (!isUsableAppBootstrap(data)) {
      throw new Error('Supabase bootstrap returned invalid data.');
    }

    const bootstrap = data;

    const currentCategories =
      Array.isArray(
        bootstrap.store_categories,
      )
        ? bootstrap.store_categories
        : [];

    const publicCategories =
      currentCategories.filter(
        (category) =>
          isV1PublicCategorySlug(
            category.slug,
          ),
      );

    const bookstoreExists =
      publicCategories.some((category) => {
        const slug =
          category.slug
            .trim()
            .toLowerCase();

        return (
          slug === 'bookstore' ||
          slug === 'bookstores'
        );
      });

    if (bookstoreExists) {
      return {
        ...bootstrap,
        store_categories:
          publicCategories,
      };
    }

    const bookstoreCategory: StoreCategory = {
      id: 'bookstores',
      slug: 'bookstores',
      name_ar: 'المكتبات',
      name_en: 'Bookstores',
      icon: 'bookstore',
      image_url: null,
    };

    return {
      ...bootstrap,
      store_categories: [
        ...publicCategories,
        bookstoreCategory,
      ],
    };
  } catch (error) {
    rpcOutcome = 'error';
    throw error;
  } finally {
    recordStartupTimingOnce(
      'app-bootstrap-rpc',
      Date.now() - rpcStartedAt,
      {
        outcome: rpcOutcome,
      },
    );
  }
}

type ResolvedBootstrap = {
  bootstrap: AppBootstrap;
  fromPersistentCache: boolean;
};

/**
 * A canceled native fetch, timeout, or 5xx is recoverable; permissions and
 * malformed payloads aren't. Avoid infinite loops and duplicate RPC bursts.
 * The persistent fallback is only for valid public data and is read after
 * transient transport failures. Maintenance/force-update checks remain in
 * the independent, network-backed app-launch gate.
 */
async function loadBootstrapWithRecovery(): Promise<ResolvedBootstrap> {
  let lastTransientError: unknown = null;

  for (
    let attempt = 0;
    attempt <= APP_BOOTSTRAP_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    try {
      const bootstrap = await loadAppBootstrap();
      // Don't slow the first usable render down with disk writes.
      void writeCachedAppBootstrap(bootstrap);
      return { bootstrap, fromPersistentCache: false };
    } catch (error) {
      // Never mask authorization, schema, or configuration errors with a
      // stale snapshot; only known transient transport failures qualify.
      if (!isRetryablePublicQueryError(error)) {
        throw error;
      }

      lastTransientError = error;

      if (attempt < APP_BOOTSTRAP_RETRY_DELAYS_MS.length) {
        if (__DEV__) {
          console.warn(
            '[bootstrap] Temporary network error, retrying.',
            { attempt: attempt + 1, error },
          );
        }

        await new Promise<void>((resolve) => {
          setTimeout(resolve, APP_BOOTSTRAP_RETRY_DELAYS_MS[attempt]);
        });
      }
    }
  }

  const persisted = await readCachedAppBootstrap();
  if (persisted) {
    if (__DEV__) {
      console.warn(
        '[bootstrap] Using a recent cached snapshot after network failure.',
      );
    }

    return { bootstrap: persisted, fromPersistentCache: true };
  }

  throw lastTransientError ??
    new Error('Bootstrap network unavailable and no valid cache exists.');
}

export function getCachedAppBootstrap(): AppBootstrap | null {
  const currentTime = Date.now();

  if (
    cachedAppBootstrap &&
    cachedAppBootstrap.expiresAt >
      currentTime
  ) {
    return cachedAppBootstrap.value;
  }

  if (cachedAppBootstrap) {
    cachedAppBootstrap = null;
  }

  return null;
}

async function getAppBootstrap():
  Promise<AppBootstrap> {
  const startedAt = Date.now();
  let path:
    | 'memory-cache'
    | 'inflight'
    | 'remote' = 'remote';
  let outcome:
    | 'success'
    | 'error' = 'success';

  try {
    const currentTime = Date.now();

    if (
      cachedAppBootstrap &&
      cachedAppBootstrap.expiresAt >
        currentTime
    ) {
      path = 'memory-cache';
      return cachedAppBootstrap.value;
    }

    if (appBootstrapRequest) {
      path = 'inflight';
      return await appBootstrapRequest;
    }

    appBootstrapRequest =
      loadBootstrapWithRecovery().then(
        ({ bootstrap, fromPersistentCache }) => {
          cachedAppBootstrap = {
            value: bootstrap,
            expiresAt:
              Date.now() +
              (fromPersistentCache
                ? APP_BOOTSTRAP_FALLBACK_MEMORY_TTL_MS
                : APP_BOOTSTRAP_CACHE_TTL_MS),
          };

          return bootstrap;
        },
      );

    return await appBootstrapRequest;
  } catch (error) {
    outcome = 'error';
    throw error;
  } finally {
    recordStartupTimingOnce(
      'app-bootstrap-total',
      Date.now() - startedAt,
      {
        outcome,
        path,
      },
    );

    if (path === 'remote') {
      appBootstrapRequest = null;
    }
  }
}

export {
  findServiceAreaById,
  getAppBootstrap
};
export default getAppBootstrap;
