import { publicSupabase } from '../lib/supabase';

/** Brand promotion slides in the supermarket carousel; all content comes from Supabase. */
export type SupermarketMediaCard = {
  id: string;
  storeId: string;
  mediaType: 'image' | 'video';
  imageUrl?: string;
  videoUrl?: string;
  title?: string;
  subtitle?: string;
  categoryKey?: string;
  companyName?: string;
  companyLogoUrl?: string;
  isDemo: boolean;
  hasCampaignProducts: boolean;
};

type MediaCardRow = {
  id: string;
  store_id: string;
  media_type: string;
  media_url: string;
  poster_url: string | null;
  title_ar: string | null;
  subtitle_ar: string | null;
  category_key: string | null;
  company_name_ar: string | null;
  company_logo_url: string | null;
  is_demo: boolean;
};

type CardProductRow = {
  media_card_id: string;
  product_id: string;
  sort_order: number;
};

const CARD_SELECT =
  'id,store_id,media_type,media_url,poster_url,title_ar,subtitle_ar,category_key,company_name_ar,company_logo_url,is_demo';

function isHttpsUrl(value: string | null | undefined): value is string {
  return Boolean(value?.trim() && /^https:\/\//i.test(value.trim()));
}

function parseCard(row: MediaCardRow, hasCampaignProducts = false): SupermarketMediaCard | null {
  if (!isHttpsUrl(row.media_url)) return null;
  if (row.media_type !== 'image' && row.media_type !== 'video') return null;

  const mediaUrl = row.media_url.trim();
  return {
    id: row.id,
    storeId: row.store_id,
    mediaType: row.media_type,
    imageUrl: row.media_type === 'image'
      ? mediaUrl
      : (isHttpsUrl(row.poster_url) ? row.poster_url!.trim() : undefined),
    videoUrl: row.media_type === 'video' ? mediaUrl : undefined,
    title: row.title_ar?.trim() || undefined,
    subtitle: row.subtitle_ar?.trim() || undefined,
    categoryKey: row.category_key?.trim() || undefined,
    companyName: row.company_name_ar?.trim() || undefined,
    companyLogoUrl: isHttpsUrl(row.company_logo_url) ? row.company_logo_url!.trim() : undefined,
    isDemo: row.is_demo === true,
    hasCampaignProducts,
  };
}

/** RLS exposes only active, in-schedule slides. The store check prevents cross-store content. */
export async function listSupermarketMediaCards(storeId: string): Promise<SupermarketMediaCard[]> {
  const { data, error } = await publicSupabase
    .schema('now')
    .from('supermarket_media_cards')
    .select(CARD_SELECT)
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(25);
  if (error) throw error;
  const rows = (data ?? []) as MediaCardRow[];
  if (rows.length === 0) return [];

  const { data: associated, error: linksError } = await publicSupabase
    .schema('now')
    .from('supermarket_media_card_products')
    .select('media_card_id')
    .in('media_card_id', rows.map(row => row.id))
    .eq('is_active', true);
  // A missing campaign configuration must not break the home supermarket screen.
  if (linksError) console.warn('Unable to fetch brand campaign product links:', linksError.message);
  const campaignCardIds = new Set((associated ?? []).map(row => row.media_card_id as string));
  return rows.flatMap(row => {
    const item = parseCard(row, campaignCardIds.has(row.id));
    return item ? [item] : [];
  });
}

export type SupermarketBrandCampaign = {
  card: SupermarketMediaCard;
  productIds: string[];
};

/** Fetch the selected brand campaign and its ordered, database-linked product IDs. */
export async function getSupermarketBrandCampaign(cardId: string, storeId: string): Promise<SupermarketBrandCampaign> {
  const { data, error } = await publicSupabase
    .schema('now')
    .from('supermarket_media_cards')
    .select(CARD_SELECT)
    .eq('id', cardId)
    .eq('store_id', storeId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('العرض غير متاح حاليًا.');
  const card = parseCard(data as MediaCardRow, true);
  if (!card) throw new Error('محتوى العرض غير صالح.');

  const { data: productLinks, error: productsError } = await publicSupabase
    .schema('now')
    .from('supermarket_media_card_products')
    .select('media_card_id,product_id,sort_order')
    .eq('media_card_id', cardId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (productsError) throw productsError;
  return {
    card,
    productIds: ((productLinks ?? []) as CardProductRow[]).map(link => link.product_id),
  };
}
