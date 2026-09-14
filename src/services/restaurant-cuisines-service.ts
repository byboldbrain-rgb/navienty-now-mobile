import { supabase } from '../lib/supabase';

type RestaurantCuisineRow = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  image_url: string | null;
  sort_order: number;
};

type StoreRestaurantCuisineRow = {
  store_id: string;
  cuisine_id: string;
};

export type RestaurantCuisine = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  imageUrl: string | null;
  sortOrder: number;
  storeIds: string[];
};

export async function listRestaurantCuisines(): Promise<
  RestaurantCuisine[]
> {
  const { data, error } = await supabase
    .schema('now')
    .from('restaurant_cuisines')
    .select(
      `
        id,
        slug,
        name_ar,
        name_en,
        image_url,
        sort_order
      `,
    )
    .eq('is_active', true)
    .order('sort_order', {
      ascending: true,
    })
    .order('name_ar', {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  const cuisineRows =
    (data ?? []) as RestaurantCuisineRow[];

  if (cuisineRows.length === 0) {
    return [];
  }

  const cuisineIds = cuisineRows.map(
    (cuisine) => cuisine.id,
  );

  const {
    data: storeCuisineData,
    error: storeCuisineError,
  } = await supabase
    .schema('now')
    .from('store_restaurant_cuisines')
    .select(
      `
        store_id,
        cuisine_id
      `,
    )
    .eq('is_active', true)
    .in('cuisine_id', cuisineIds);

  if (storeCuisineError) {
    throw storeCuisineError;
  }

  const storeCuisineRows =
    (storeCuisineData ?? []) as StoreRestaurantCuisineRow[];

  const storeIdsByCuisine =
    new Map<string, string[]>();

  for (const row of storeCuisineRows) {
    const storeIds =
      storeIdsByCuisine.get(row.cuisine_id) ?? [];

    if (!storeIds.includes(row.store_id)) {
      storeIds.push(row.store_id);
    }

    storeIdsByCuisine.set(
      row.cuisine_id,
      storeIds,
    );
  }

  return cuisineRows.map((cuisine) => ({
    id: cuisine.id,
    slug: cuisine.slug,
    nameAr: cuisine.name_ar,
    nameEn: cuisine.name_en,
    imageUrl: cuisine.image_url,
    sortOrder: cuisine.sort_order,
    storeIds:
      storeIdsByCuisine.get(cuisine.id) ?? [],
  }));
}

export default listRestaurantCuisines;
