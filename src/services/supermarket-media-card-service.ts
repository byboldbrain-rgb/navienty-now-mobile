import { publicSupabase } from '../lib/supabase';

export type SupermarketMediaCard = {
  id: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  posterUrl: string | null;
  title: string | null;
  categoryKey: string | null;
};

type RawMediaCard = {
  id: string;
  media_type: string;
  media_url: string;
  poster_url: string | null;
  title_ar: string | null;
  category_key: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

/** Independent of home_banners, which still controls the lower promo rows. */
export async function listSupermarketMediaCards(
  storeId: string,
): Promise<SupermarketMediaCard[]> {
  if (!storeId.trim()) return [];

  const { data, error } = await publicSupabase
    .from('supermarket_media_cards')
    .select(
      'id,media_type,media_url,poster_url,title_ar,category_key,starts_at,ends_at',
    )
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(25);

  if (error) throw error;

  const now = Date.now();
  return ((data ?? []) as RawMediaCard[]).flatMap((row) => {
    if (row.starts_at && Date.parse(row.starts_at) > now) return [];
    if (row.ends_at && Date.parse(row.ends_at) <= now) return [];
    const url = row.media_url?.trim();
    if (!url || !/^https:\/\//i.test(url)) return [];
    if (row.media_type !== 'image' && row.media_type !== 'video') return [];
    const poster = row.poster_url?.trim() || null;
    return [{
      id: row.id,
      mediaType: row.media_type,
      mediaUrl: url,
      posterUrl: poster && /^https:\/\//i.test(poster) ? poster : null,
      title: row.title_ar?.trim() || null,
      categoryKey: row.category_key?.trim() || null,
    }];
  });
}
