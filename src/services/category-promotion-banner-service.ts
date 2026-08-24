import { publicSupabase } from '../lib/supabase';

type BannerAudience =
  | 'all'
  | 'signed_out'
  | 'signed_in';

export type CategoryPromotionBannerAudience =
  Exclude<BannerAudience, 'all'>;

export type CategoryPromotionBannerPlacement =
  | 'supermarket'
  | 'bookstore';

type HomeBannerProductRow = {
  product_id: string;
  sort_order: number;
  is_active: boolean;
};

type HomeBannerRow = {
  id: string;
  admin_label: string;
  image_url: string;
  storage_path: string | null;
  alt_text_ar: string | null;
  alt_text_en: string | null;
  link_url: string | null;
  audience: BannerAudience;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  home_banner_products:
    | HomeBannerProductRow[]
    | null;
};

export type CategoryPromotionBanner = {
  id: string;
  adminLabel: string;
  imageUrl: string;
  storagePath: string | null;
  altTextAr: string | null;
  altTextEn: string | null;
  linkUrl: string | null;
  sortOrder: number;
  productIds: string[];
};

type ListCategoryPromotionBannersParams = {
  placement: CategoryPromotionBannerPlacement;
  storeId: string;
  audience?: CategoryPromotionBannerAudience;
};

const BANNER_CACHE_TTL_MS =
  60 * 1000;

const bannerCache =
  new Map<
    string,
    {
      value: CategoryPromotionBanner[];
      expiresAt: number;
    }
  >();

const bannerRequests =
  new Map<
    string,
    Promise<CategoryPromotionBanner[]>
  >();

function isBannerVisibleNow(
  banner: HomeBannerRow,
  currentTime: number,
) {
  if (
    banner.starts_at &&
    new Date(
      banner.starts_at,
    ).getTime() > currentTime
  ) {
    return false;
  }

  if (
    banner.ends_at &&
    new Date(
      banner.ends_at,
    ).getTime() < currentTime
  ) {
    return false;
  }

  return true;
}

async function loadCategoryPromotionBanners({
  placement,
  storeId,
  audience,
}: ListCategoryPromotionBannersParams): Promise<
  CategoryPromotionBanner[]
> {
  const allowedAudiences: BannerAudience[] =
    audience
      ? ['all', audience]
      : ['all'];

  /*
   * Fetch banners and their linked products in one PostgREST request.
   * Public category discovery must never wait for native Auth hydration.
   */
  const { data, error } =
    await publicSupabase
      .from('home_banners')
      .select(
        `
          id,
          admin_label,
          image_url,
          storage_path,
          alt_text_ar,
          alt_text_en,
          link_url,
          audience,
          sort_order,
          starts_at,
          ends_at,
          home_banner_products (
            product_id,
            sort_order,
            is_active
          )
        `,
      )
      .eq('placement', placement)
      .eq('store_id', storeId)
      .eq('is_active', true)
      .in(
        'audience',
        allowedAudiences,
      )
      .order('sort_order', {
        ascending: true,
      })
      .order('created_at', {
        ascending: false,
      });

  if (error) {
    throw error;
  }

  const currentTime = Date.now();

  return (
    (data ?? []) as unknown as HomeBannerRow[]
  )
    .filter((banner) =>
      isBannerVisibleNow(
        banner,
        currentTime,
      ),
    )
    .map((banner) => ({
      id: banner.id,
      adminLabel:
        banner.admin_label,
      imageUrl: banner.image_url,
      storagePath:
        banner.storage_path,
      altTextAr:
        banner.alt_text_ar,
      altTextEn:
        banner.alt_text_en,
      linkUrl: banner.link_url,
      sortOrder: banner.sort_order,
      productIds:
        (
          banner.home_banner_products ?? []
        )
          .filter(
            (product) =>
              product.is_active,
          )
          .sort(
            (firstProduct, secondProduct) =>
              firstProduct.sort_order -
              secondProduct.sort_order,
          )
          .map(
            (product) =>
              product.product_id,
          ),
    }));
}

export async function listCategoryPromotionBanners(
  params: ListCategoryPromotionBannersParams,
): Promise<CategoryPromotionBanner[]> {
  const normalizedStoreId =
    params.storeId.trim();

  if (!normalizedStoreId) {
    return [];
  }

  const cacheKey = [
    params.placement,
    normalizedStoreId,
    params.audience ?? 'all',
  ].join(':');

  const cachedEntry =
    bannerCache.get(cacheKey);

  if (
    cachedEntry &&
    cachedEntry.expiresAt > Date.now()
  ) {
    return cachedEntry.value;
  }

  if (cachedEntry) {
    bannerCache.delete(cacheKey);
  }

  const pendingRequest =
    bannerRequests.get(cacheKey);

  if (pendingRequest) {
    return pendingRequest;
  }

  const request =
    loadCategoryPromotionBanners({
      ...params,
      storeId: normalizedStoreId,
    }).then((banners) => {
      bannerCache.set(cacheKey, {
        value: banners,
        expiresAt:
          Date.now() +
          BANNER_CACHE_TTL_MS,
      });

      return banners;
    });

  bannerRequests.set(
    cacheKey,
    request,
  );

  try {
    return await request;
  } finally {
    if (
      bannerRequests.get(cacheKey) ===
      request
    ) {
      bannerRequests.delete(cacheKey);
    }
  }
}
