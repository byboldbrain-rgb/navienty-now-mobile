import { supabase } from '../lib/supabase';

export type AppSettings = {
  app_name: string;
  app_slug: string;
  app_logo_url: string | null;
  default_locale: string;
  timezone: string;
  currency_code: string;
  currency_symbol: string;
  default_city_id: string | null;
  default_service_area_id: string | null;
  whatsapp_number: string | null;
  support_phone: string | null;
  support_whatsapp: string | null;
  support_email: string | null;
  catalog_enabled: boolean;
  orders_enabled: boolean;
  maintenance_mode: boolean;
  maintenance_message_ar: string | null;
  maintenance_message_en: string | null;
  minimum_supported_app_version:
    | string
    | null;
  privacy_url: string | null;
  terms_url: string | null;
};

export type ServiceArea = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  default_delivery_fee: number;
  default_minimum_order_amount:
    | number
    | null;
  default_estimated_delivery_minutes:
    | number
    | null;
};

export type City = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  areas: ServiceArea[];
};

export type StoreCategory = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  icon: string | null;
  image_url: string | null;
};

export type PaymentMethod = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  subtitle_ar: string | null;
  subtitle_en: string | null;
  icon: string | null;
  icon_url: string | null;
};

export type AppBootstrap = {
  settings: AppSettings;
  cities: City[];
  store_categories: StoreCategory[];
  payment_methods: PaymentMethod[];
};

type ServiceCategoryRow = {
  id: number | string;
  slug: string;
  name_ar: string;
  name_en: string;
  icon: string | null;
};

function isBookstoreSlug(
  slug: string,
): boolean {
  const normalizedSlug =
    slug.trim().toLowerCase();

  return (
    normalizedSlug === 'bookstore' ||
    normalizedSlug === 'bookstores'
  );
}

async function getBookstoreCategory():
  Promise<StoreCategory | null> {
  const { data, error } = await supabase
    .from('service_categories')
    .select(`
      id,
      slug,
      name_ar,
      name_en,
      icon
    `)
    .in('slug', [
      'bookstore',
      'bookstores',
    ])
    .eq('is_active', true)
    .order('sort_order', {
      ascending: true,
    })
    .limit(1)
    .maybeSingle<ServiceCategoryRow>();

  if (error) {
    console.warn(
      'Could not load bookstore category:',
      error.message,
    );

    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: String(data.id),
    slug: data.slug,
    name_ar: data.name_ar,
    name_en: data.name_en,
    icon: data.icon,
    image_url: null,
  };
}

async function getAppBootstrap():
  Promise<AppBootstrap> {
  const { data, error } =
    await supabase.rpc(
      'get_app_bootstrap',
    );

  if (error) {
    throw new Error(
      `Supabase bootstrap failed: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      'Supabase bootstrap returned no data.',
    );
  }

  const bootstrap = data as AppBootstrap;

  const currentCategories =
    Array.isArray(
      bootstrap.store_categories,
    )
      ? bootstrap.store_categories
      : [];

  const bookstoreExists =
    currentCategories.some((category) => {
      const slug =
        category.slug
          .trim()
          .toLowerCase();

      return (
        slug === 'bookstore' ||
        slug === 'bookstores'
      );
    });

  if (bookstoreExists) {
    return {
      ...bootstrap,
      store_categories:
        currentCategories,
    };
  }

  const bookstoreCategory: StoreCategory = {
    id: 'bookstores',
    slug: 'bookstores',
    name_ar: 'المكتبات',
    name_en: 'Bookstores',
    icon: 'bookstore',
    image_url: null,
  };

  return {
    ...bootstrap,
    store_categories: [
      ...currentCategories,
      bookstoreCategory,
    ],
  };
}

export { getAppBootstrap };
export default getAppBootstrap;