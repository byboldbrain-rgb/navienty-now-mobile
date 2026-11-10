import { publicSupabase } from '../lib/supabase';

/** All artwork, logos and product-brand relationships are maintained in Supabase. */
export type SupermarketBrandBanner = {
  id: string;
  brandId: string;
  title: string;
  heroImageUrl: string;
  logoUrl: string | null;
  backgroundColor: string;
  imageFit: 'contain' | 'cover';
};

type BrandBannerRow = {
  id: string;
  brand_id: string;
  title_ar: string;
  hero_image_url: string;
  logo_url: string | null;
  background_color: string;
  image_fit: string;
  starts_at: string | null;
  ends_at: string | null;
};

type BrandLogoRow = {
  id: string;
  logo_url: string | null;
};

const isHttpsUrl = (url: string | null | undefined): url is string =>
  typeof url === 'string' && /^https:\/\//i.test(url.trim());

/**
 * Brand banners have their own placement. They are NOT home_banners or
 * supermarket_media_cards. RLS supplies only public, active rows; the
 * client additionally guards time windows and malformed media URLs.
 *
 * A banner-specific logo_url overrides the canonical now.brands.logo_url.
 * If the banner's logo is absent, use the image attached to the brand.
 * No brand names or logo image URLs are hard-coded in the mobile app.
 */
export async function listSupermarketBrandBanners(
  storeId: string,
): Promise<SupermarketBrandBanner[]> {
  if (!storeId.trim()) return [];

  const { data, error } = await publicSupabase
    .schema('now')
    .from('supermarket_brand_banners')
    .select('id,brand_id,title_ar,hero_image_url,logo_url,background_color,image_fit,starts_at,ends_at')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(24);

  if (error) throw error;
  const currentTime = Date.now();

  const visibleRows = ((data ?? []) as BrandBannerRow[]).filter(row => {
    if (row.starts_at && Date.parse(row.starts_at) > currentTime) return false;
    if (row.ends_at && Date.parse(row.ends_at) <= currentTime) return false;
    return Boolean(row.brand_id && isHttpsUrl(row.hero_image_url));
  });

  // Only make the extra database lookup when a banner has no logo itself.
  const brandIdsWithMissingLogo = Array.from(new Set(
    visibleRows
      .filter(row => !isHttpsUrl(row.logo_url))
      .map(row => row.brand_id),
  ));
  const fallbackBrandLogos = new Map<string, string>();

  if (brandIdsWithMissingLogo.length > 0) {
    const { data: brandData, error: brandError } = await publicSupabase
      .schema('now')
      .from('brands')
      .select('id,logo_url')
      .in('id', brandIdsWithMissingLogo);

    if (brandError) {
      // Do not hide the whole banner row if brand logo lookup fails.
      console.warn('Unable to load fallback brand logos:', brandError);
    } else {
      for (const brand of (brandData ?? []) as BrandLogoRow[]) {
        if (isHttpsUrl(brand.logo_url)) {
          fallbackBrandLogos.set(brand.id, brand.logo_url.trim());
        }
      }
    }
  }

  return visibleRows.map(row => ({
    id: row.id,
    brandId: row.brand_id,
    title: row.title_ar?.trim() || 'العلامة التجارية',
    heroImageUrl: row.hero_image_url.trim(),
    logoUrl: isHttpsUrl(row.logo_url)
      ? row.logo_url.trim()
      : (fallbackBrandLogos.get(row.brand_id) ?? null),
    backgroundColor: /^#[0-9a-fA-F]{6}$/.test(row.background_color)
      ? row.background_color
      : '#F5F0E8',
    imageFit: row.image_fit === 'cover' ? 'cover' : 'contain',
  }));
}
