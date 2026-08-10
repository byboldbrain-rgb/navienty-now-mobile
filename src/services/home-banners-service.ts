import { supabase } from '../lib/supabase';

export type HomeBannerAudience =
  | 'all'
  | 'signed_out'
  | 'signed_in';

export type HomeBannerPlacement =
  | 'main'
  | 'exclusive_offers';

export type HomeBanner = {
  id: string;
  imageUrl: string;
  altTextAr: string | null;
  altTextEn: string | null;
  linkUrl: string | null;
  sortOrder: number;
  placement: HomeBannerPlacement;
};

type HomeBannerRow = {
  id: string;
  image_url: string;
  alt_text_ar: string | null;
  alt_text_en: string | null;
  link_url: string | null;
  sort_order: number;
  placement: HomeBannerPlacement;
  starts_at: string | null;
  ends_at: string | null;
};

function isBannerCurrentlyVisible(
  banner: HomeBannerRow,
  currentTime: number,
): boolean {
  const startsAt = banner.starts_at
    ? Date.parse(banner.starts_at)
    : null;

  const endsAt = banner.ends_at
    ? Date.parse(banner.ends_at)
    : null;

  if (
    startsAt !== null &&
    !Number.isNaN(startsAt) &&
    startsAt > currentTime
  ) {
    return false;
  }

  if (
    endsAt !== null &&
    !Number.isNaN(endsAt) &&
    endsAt <= currentTime
  ) {
    return false;
  }

  return true;
}

async function listHomeBanners(
  audience: HomeBannerAudience,
  placement: HomeBannerPlacement = 'main',
): Promise<HomeBanner[]> {
  const allowedAudiences =
    audience === 'all'
      ? ['all']
      : ['all', audience];

  const { data, error } = await supabase
    .from('home_banners')
    .select(
      [
        'id',
        'image_url',
        'alt_text_ar',
        'alt_text_en',
        'link_url',
        'sort_order',
        'placement',
        'starts_at',
        'ends_at',
      ].join(','),
    )
    .eq('is_active', true)
    .eq('placement', placement)
    .in('audience', allowedAudiences)
    .order('sort_order', {
      ascending: true,
    })
    .order('id', {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Supabase home banners failed: ${error.message}`,
    );
  }

  const currentTime = Date.now();

  return ((data ?? []) as HomeBannerRow[])
    .filter(
      (banner) =>
        banner.image_url.trim().length > 0 &&
        isBannerCurrentlyVisible(
          banner,
          currentTime,
        ),
    )
    .map((banner) => ({
      id: banner.id,
      imageUrl: banner.image_url.trim(),
      altTextAr:
        banner.alt_text_ar?.trim() || null,
      altTextEn:
        banner.alt_text_en?.trim() || null,
      linkUrl:
        banner.link_url?.trim() || null,
      sortOrder: banner.sort_order,
      placement: banner.placement,
    }));
}

export { listHomeBanners };
export default listHomeBanners;