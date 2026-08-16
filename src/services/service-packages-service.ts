import { supabase } from '../lib/supabase';

export type ServicePackage = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  price: number;
  compareAtPrice: number | null;
  currencyCode: string;
  currencySymbol: string;
  imageUrl: string | null;
  isActive: boolean;
};

type ServicePackageRow = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  price: number | string;
  compare_at_price: number | string | null;
  currency_code: string;
  currency_symbol: string;
  image_url: string | null;
  is_active: boolean;
};

function toNumber(
  value: number | string | null,
): number | null {
  if (value === null) {
    return null;
  }

  const parsed =
    typeof value === 'number'
      ? value
      : Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

async function getServicePackageById(
  packageId: string,
): Promise<ServicePackage | null> {
  const normalizedId = packageId.trim();

  if (!normalizedId) {
    return null;
  }

  const { data, error } = await supabase
    .from('service_packages')
    .select(
      [
        'id',
        'slug',
        'name_ar',
        'name_en',
        'description_ar',
        'description_en',
        'price',
        'compare_at_price',
        'currency_code',
        'currency_symbol',
        'image_url',
        'is_active',
      ].join(','),
    )
    .eq('id', normalizedId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Supabase service package failed: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  const row = data as ServicePackageRow;
  const price = toNumber(row.price);

  if (price === null || price < 0) {
    throw new Error(
      'Service package returned an invalid price.',
    );
  }

  return {
    id: row.id,
    slug: row.slug,
    nameAr: row.name_ar,
    nameEn:
      row.name_en?.trim() || null,
    descriptionAr:
      row.description_ar?.trim() || null,
    descriptionEn:
      row.description_en?.trim() || null,
    price,
    compareAtPrice:
      toNumber(row.compare_at_price),
    currencyCode:
      row.currency_code,
    currencySymbol:
      row.currency_symbol,
    imageUrl:
      row.image_url?.trim() || null,
    isActive:
      row.is_active,
  };
}

export {
    getServicePackageById
};

export default getServicePackageById;
