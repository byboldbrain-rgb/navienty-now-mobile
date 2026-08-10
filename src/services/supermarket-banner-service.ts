import { supabase } from '../lib/supabase';

type BannerAudience =
  | 'all'
  | 'signed_out'
  | 'signed_in';

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
};

type HomeBannerProductRow = {
  banner_id: string;
  product_id: string;
  sort_order: number;
};

export type SupermarketPromotionBanner = {
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

type ListSupermarketPromotionBannersParams = {
  storeId: string;
};

function isBannerVisibleNow(
  banner: HomeBannerRow,
  now: number,
) {
  if (
    banner.starts_at &&
    new Date(banner.starts_at).getTime() >
      now
  ) {
    return false;
  }

  if (
    banner.ends_at &&
    new Date(banner.ends_at).getTime() <
      now
  ) {
    return false;
  }

  return true;
}

export async function listSupermarketPromotionBanners({
  storeId,
}: ListSupermarketPromotionBannersParams): Promise<
  SupermarketPromotionBanner[]
> {
  const {
    data: sessionData,
  } = await supabase.auth.getSession();

  const allowedAudiences: BannerAudience[] =
    sessionData.session
      ? ['all', 'signed_in']
      : ['all', 'signed_out'];

  const { data, error } = await supabase
    .schema('now')
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
        ends_at
      `,
    )
    .eq('placement', 'supermarket')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .in('audience', allowedAudiences)
    .order('sort_order', {
      ascending: true,
    })
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  const now = Date.now();

  const visibleBanners = (
    (data ?? []) as HomeBannerRow[]
  ).filter((banner) =>
    isBannerVisibleNow(banner, now),
  );

  if (visibleBanners.length === 0) {
    return [];
  }

  const bannerIds = visibleBanners.map(
    (banner) => banner.id,
  );

  const {
    data: bannerProductsData,
    error: bannerProductsError,
  } = await supabase
    .schema('now')
    .from('home_banner_products')
    .select(
      `
        banner_id,
        product_id,
        sort_order
      `,
    )
    .in('banner_id', bannerIds)
    .eq('is_active', true)
    .order('sort_order', {
      ascending: true,
    })
    .order('created_at', {
      ascending: true,
    });

  if (bannerProductsError) {
    throw bannerProductsError;
  }

  const bannerProducts =
    (bannerProductsData ??
      []) as HomeBannerProductRow[];

  const productIdsByBanner =
    new Map<string, string[]>();

  for (const row of bannerProducts) {
    const productIds =
      productIdsByBanner.get(
        row.banner_id,
      ) ?? [];

    productIds.push(row.product_id);

    productIdsByBanner.set(
      row.banner_id,
      productIds,
    );
  }

  return visibleBanners.map(
    (banner) => ({
      id: banner.id,
      adminLabel: banner.admin_label,
      imageUrl: banner.image_url,
      storagePath: banner.storage_path,
      altTextAr: banner.alt_text_ar,
      altTextEn: banner.alt_text_en,
      linkUrl: banner.link_url,
      sortOrder: banner.sort_order,
      productIds:
        productIdsByBanner.get(
          banner.id,
        ) ?? [],
    }),
  );
}

export default listSupermarketPromotionBanners;
