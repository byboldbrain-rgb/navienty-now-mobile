import { publicSupabase } from '../lib/supabase';

export type ShoppingSpotlight = {
  id: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  posterUrl: string | null;
  eyebrowAr: string | null;
  titleAr: string;
  buttonLabelAr: string;
  categoryKey: string;
};

type SpotlightRow = {
  id: string;
  media_type: string;
  media_url: string;
  poster_url: string | null;
  eyebrow_ar: string | null;
  title_ar: string;
  button_label_ar: string;
  category_key: string;
  starts_at: string | null;
  ends_at: string | null;
};

export async function getShoppingSpotlight(storeId: string): Promise<ShoppingSpotlight | null> {
  const { data, error } = await publicSupabase
    .from('supermarket_spotlight_cards')
    .select('id,media_type,media_url,poster_url,eyebrow_ar,title_ar,button_label_ar,category_key,starts_at,ends_at')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(4);
  if (error) throw error;
  const currentTime = Date.now();
  for (const row of (data ?? []) as SpotlightRow[]) {
    if (row.starts_at && Date.parse(row.starts_at) > currentTime) continue;
    if (row.ends_at && Date.parse(row.ends_at) <= currentTime) continue;
    if (!/^https:\/\//i.test(row.media_url) || !['image','video'].includes(row.media_type)) continue;
    return {
      id: row.id,
      mediaType: row.media_type as 'image' | 'video',
      mediaUrl: row.media_url,
      posterUrl: row.poster_url,
      eyebrowAr: row.eyebrow_ar,
      titleAr: row.title_ar,
      buttonLabelAr: row.button_label_ar,
      categoryKey: row.category_key,
    };
  }
  return null;
}
