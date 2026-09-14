import { supabase } from '../lib/supabase';
import {
  type PromoActionPayload,
  type PromoActionType,
  type PromoCampaignContent,
  type PromoCampaignTheme,
  type PromoImageFit,
  type PromoImageBlockAction,
  type PromoPresentationType,
  type PromoSectionStyle,
} from '../types/promo-campaign';

export type HomeBannerAudience =
  | 'all'
  | 'signed_out'
  | 'signed_in';

export type HomeBannerPlacement =
  | 'main'
  | 'exclusive_offers'
  | 'supermarket'
  | 'pharmacy';

export type HomeBannerImage = {
  id: string;
  imageUrl: string;
  altTextAr: string | null;
  sortOrder: number;
};

export type HomeBanner = {
  id: string;
  imageUrl: string;
  altTextAr: string | null;
  altTextEn: string | null;
  linkUrl: string | null;
  sortOrder: number;
  placement: HomeBannerPlacement;
  presentationType: PromoPresentationType;
  actionType: PromoActionType;
  actionPayload: PromoActionPayload;
  templateKey: string;
  content: PromoCampaignContent;
  theme: PromoCampaignTheme;
  serviceAreaIds: string[];
  servicePackageId: string | null;
  additionalImages: HomeBannerImage[];
};

type HomeBannerServiceAreaRow = {
  service_area_id: string;
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
  presentation_type:
    | PromoPresentationType
    | null;
  action_type: PromoActionType | null;
  action_payload: unknown;
  template_key: string | null;
  content: unknown;
  theme: unknown;
  service_package_id: string | null;
  home_banner_service_areas:
    | HomeBannerServiceAreaRow[]
    | null;
};

type HomeBannerImageRow = {
  id: string;
  image_url: string;
  alt_text_ar: string | null;
  sort_order: number;
  is_active: boolean;
};

/**
 * IMPORTANT:
 * The Home carousel intentionally does NOT embed home_banner_images.
 *
 * The Home page only needs banner/card data. Detail images are loaded
 * separately after the customer opens a promo. This prevents a newly-created
 * gallery table / PostgREST relationship / permission issue from making the
 * entire Home banner query fail and hiding every banner.
 */
const HOME_BANNER_SELECT = [
  'id',
  'image_url',
  'alt_text_ar',
  'alt_text_en',
  'link_url',
  'sort_order',
  'placement',
  'starts_at',
  'ends_at',
  'presentation_type',
  'action_type',
  'action_payload',
  'template_key',
  'content',
  'theme',
  'service_package_id',
  'home_banner_service_areas(service_area_id)',
].join(',');

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getString(
  source: Record<string, unknown>,
  key: string,
): string | null {
  const value = source[key];

  return typeof value === 'string' &&
    value.trim().length > 0
    ? value.trim()
    : null;
}

function getArray(
  source: Record<string, unknown>,
  key: string,
): unknown[] {
  const value = source[key];

  return Array.isArray(value) ? value : [];
}

function getNumber(
  source: Record<string, unknown>,
  key: string,
): number | null {
  const value = source[key];

  return typeof value === 'number' &&
    Number.isFinite(value)
    ? value
    : null;
}

function normalizeImageFit(
  value: unknown,
): PromoImageFit | undefined {
  return value === 'contain' || value === 'cover'
    ? value
    : undefined;
}

function normalizeSectionStyle(
  value: unknown,
): PromoSectionStyle | undefined {
  return value === 'plain' ||
    value === 'soft' ||
    value === 'accent' ||
    value === 'dark'
    ? value
    : undefined;
}

function normalizeActionPayload(
  value: unknown,
): PromoActionPayload {
  if (!isRecord(value)) {
    return {};
  }

  return {
    whatsappNumber:
      getString(value, 'whatsapp_number'),
    whatsappMessage:
      getString(value, 'whatsapp_message'),
    url: getString(value, 'url'),
    categorySlug:
      getString(value, 'category_slug'),
    storeId:
      getString(value, 'store_id'),
    route: getString(value, 'route'),
    servicePackageId:
      getString(value, 'service_package_id'),
  };
}

function normalizeContent(
  value: unknown,
): PromoCampaignContent {
  if (!isRecord(value)) {
    return {};
  }

  const imageBlocks = getArray(
    value,
    'image_blocks',
  )
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const imageUrl = getString(
        item,
        'image_url',
      );

      if (!imageUrl) {
        return null;
      }

      const rawAction = getString(
        item,
        'action',
      );

      const action: PromoImageBlockAction =
        rawAction === 'primary'
          ? 'primary'
          : 'none';

      const rawAspectRatio = getNumber(
        item,
        'aspect_ratio',
      );

      return {
        id: getString(item, 'id'),
        imageUrl,
        imageAlt:
          getString(item, 'image_alt'),
        imageFit: normalizeImageFit(
          item.image_fit,
        ),
        aspectRatio:
          rawAspectRatio !== null &&
          rawAspectRatio > 0
            ? rawAspectRatio
            : null,
        action,
        horizontalInset:
          getNumber(
            item,
            'horizontal_inset',
          ),
        cornerRadius:
          getNumber(
            item,
            'corner_radius',
          ),
        gapAfter:
          getNumber(item, 'gap_after'),
        backgroundColor:
          getString(
            item,
            'background_color',
          ),
      };
    })
    .filter(
      (
        item,
      ): item is NonNullable<typeof item> =>
        item !== null,
    );

  const highlights = getArray(
    value,
    'highlights',
  )
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const title = getString(item, 'title');

      if (!title) {
        return null;
      }

      return {
        imageUrl:
          getString(item, 'image_url'),
        imageFit: normalizeImageFit(
          item.image_fit,
        ),
        imageAlt:
          getString(item, 'image_alt'),
        icon: getString(item, 'icon'),
        title,
        description:
          getString(item, 'description'),
      };
    })
    .filter(
      (
        item,
      ): item is NonNullable<typeof item> =>
        item !== null,
    );

  const sections = getArray(value, 'sections')
    .map((section) => {
      if (!isRecord(section)) {
        return null;
      }

      const items = getArray(section, 'items')
        .map((item) => {
          if (!isRecord(item)) {
            return null;
          }

          const title = getString(item, 'title');

          if (!title) {
            return null;
          }

          return {
            imageUrl:
              getString(item, 'image_url'),
            imageFit: normalizeImageFit(
              item.image_fit,
            ),
            imageAlt:
              getString(item, 'image_alt'),
            icon: getString(item, 'icon'),
            title,
            description:
              getString(item, 'description'),
          };
        })
        .filter(
          (
            item,
          ): item is NonNullable<typeof item> =>
            item !== null,
        );

      const normalizedSection = {
        id: getString(section, 'id'),
        eyebrow:
          getString(section, 'eyebrow'),
        title: getString(section, 'title'),
        body: getString(section, 'body'),
        imageUrl:
          getString(section, 'image_url'),
        imageFit: normalizeImageFit(
          section.image_fit,
        ),
        style: normalizeSectionStyle(
          section.style,
        ),
        items,
      };

      if (
        !normalizedSection.eyebrow &&
        !normalizedSection.title &&
        !normalizedSection.body &&
        !normalizedSection.imageUrl &&
        normalizedSection.items.length === 0
      ) {
        return null;
      }

      return normalizedSection;
    })
    .filter(
      (
        section,
      ): section is NonNullable<
        typeof section
      > => section !== null,
    );

  const faq = getArray(value, 'faq')
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const question = getString(
        item,
        'question',
      );
      const answer = getString(item, 'answer');

      if (!question || !answer) {
        return null;
      }

      return {
        question,
        answer,
      };
    })
    .filter(
      (
        item,
      ): item is NonNullable<typeof item> =>
        item !== null,
    );

  return {
    imageBlocks,
    brandLabel:
      getString(value, 'brand_label'),
    badge: getString(value, 'badge'),
    title: getString(value, 'title'),
    titleAccent:
      getString(value, 'title_accent'),
    subtitle: getString(value, 'subtitle'),
    heroImageUrl:
      getString(value, 'hero_image_url'),
    heroImageFit: normalizeImageFit(
      value.hero_image_fit,
    ),
    availabilityLabel:
      getString(value, 'availability_label'),
    highlights,
    sections,
    faq,
    termsText:
      getString(value, 'terms_text'),
    ctaLabel:
      getString(value, 'cta_label'),
    ctaHint:
      getString(value, 'cta_hint'),
  };
}

function normalizeTheme(
  value: unknown,
): PromoCampaignTheme {
  if (!isRecord(value)) {
    return {};
  }

  return {
    backgroundColor:
      getString(value, 'background_color'),
    surfaceColor:
      getString(value, 'surface_color'),
    heroBackgroundColor:
      getString(value, 'hero_background_color'),
    primaryColor:
      getString(value, 'primary_color'),
    buttonColor:
      getString(value, 'button_color'),
    buttonTextColor:
      getString(value, 'button_text_color'),
    textColor:
      getString(value, 'text_color'),
    mutedTextColor:
      getString(value, 'muted_text_color'),
    accentColor:
      getString(value, 'accent_color'),
    borderColor:
      getString(value, 'border_color'),
    darkSectionColor:
      getString(value, 'dark_section_color'),
    darkSectionTextColor:
      getString(
        value,
        'dark_section_text_color',
      ),
  };
}

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

function getServiceAreaIds(
  banner: HomeBannerRow,
): string[] {
  return Array.from(
    new Set(
      (
        banner.home_banner_service_areas ?? []
      )
        .map((row) => row.service_area_id)
        .filter(
          (value) =>
            typeof value === 'string' &&
            value.trim().length > 0,
        ),
    ),
  );
}

function isBannerAvailableForServiceArea(
  banner: HomeBannerRow,
  serviceAreaId: string | null | undefined,
): boolean {
  const targetedServiceAreaIds =
    getServiceAreaIds(banner);

  // No mapping rows = global banner.
  if (targetedServiceAreaIds.length === 0) {
    return true;
  }

  if (!serviceAreaId) {
    return false;
  }

  return targetedServiceAreaIds.includes(
    serviceAreaId,
  );
}

function mapHomeBanner(
  banner: HomeBannerRow,
): HomeBanner {
  const presentationType =
    banner.presentation_type ===
      'detail_screen' ||
    banner.presentation_type === 'direct_link'
      ? banner.presentation_type
      : 'direct_link';

  const actionType =
    banner.action_type ??
    (banner.link_url ? 'external_url' : 'none');

  return {
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
    presentationType,
    actionType,
    actionPayload: normalizeActionPayload(
      banner.action_payload,
    ),
    templateKey:
      banner.template_key?.trim() ||
      'premium_promo_v1',
    content: normalizeContent(banner.content),
    theme: normalizeTheme(banner.theme),
    serviceAreaIds:
      getServiceAreaIds(banner),
    servicePackageId:
      banner.service_package_id?.trim() || null,
    additionalImages: [],
  };
}

async function listHomeBannerImages(
  bannerId: string,
): Promise<HomeBannerImage[]> {
  const { data, error } = await supabase
    .from('home_banner_images')
    .select(
      [
        'id',
        'image_url',
        'alt_text_ar',
        'sort_order',
        'is_active',
      ].join(','),
    )
    .eq('banner_id', bannerId)
    .eq('is_active', true)
    .order('sort_order', {
      ascending: true,
    })
    .order('id', {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Supabase home banner images failed: ${error.message}`,
    );
  }

  return (
    (data ?? []) as unknown as HomeBannerImageRow[]
  )
    .filter(
      (row) =>
        row.is_active &&
        typeof row.image_url === 'string' &&
        row.image_url.trim().length > 0,
    )
    .map((row) => ({
      id: row.id,
      imageUrl: row.image_url.trim(),
      altTextAr:
        row.alt_text_ar?.trim() || null,
      sortOrder: row.sort_order,
    }));
}

async function listHomeBanners(
  audience: HomeBannerAudience,
  placement: HomeBannerPlacement = 'main',
  serviceAreaId?: string | null,
): Promise<HomeBanner[]> {
  const allowedAudiences =
    audience === 'all'
      ? ['all']
      : ['all', audience];

  const { data, error } = await supabase
    .from('home_banners')
    .select(HOME_BANNER_SELECT)
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

  return ((data ?? []) as unknown as HomeBannerRow[])
    .filter(
      (banner) =>
        banner.image_url.trim().length > 0 &&
        isBannerCurrentlyVisible(
          banner,
          currentTime,
        ) &&
        isBannerAvailableForServiceArea(
          banner,
          serviceAreaId,
        ),
    )
    .map(mapHomeBanner);
}

async function getHomeBannerById(
  bannerId: string,
  audience: HomeBannerAudience,
  serviceAreaId?: string | null,
): Promise<HomeBanner | null> {
  const normalizedBannerId = bannerId.trim();

  if (!normalizedBannerId) {
    return null;
  }

  const allowedAudiences =
    audience === 'all'
      ? ['all']
      : ['all', audience];

  const { data, error } = await supabase
    .from('home_banners')
    .select(HOME_BANNER_SELECT)
    .eq('id', normalizedBannerId)
    .eq('is_active', true)
    .in('audience', allowedAudiences)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Supabase home banner failed: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  const banner = data as unknown as HomeBannerRow;

  if (
    !banner.image_url.trim() ||
    !isBannerCurrentlyVisible(
      banner,
      Date.now(),
    ) ||
    !isBannerAvailableForServiceArea(
      banner,
      serviceAreaId,
    )
  ) {
    return null;
  }

  const mappedBanner = mapHomeBanner(banner);

  /*
   * Gallery/detail images are loaded only after the promo is opened.
   * This keeps Home banner discovery independent from the gallery table.
   */
  const additionalImages =
    await listHomeBannerImages(
      normalizedBannerId,
    );

  return {
    ...mappedBanner,
    additionalImages,
  };
}

export {
  getHomeBannerById,
  listHomeBannerImages,
  listHomeBanners
};

export default listHomeBanners;
