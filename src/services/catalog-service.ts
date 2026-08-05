import { supabase } from '../lib/supabase';

export type StoreCategorySlug =
  | 'restaurants'
  | 'supermarket'
  | 'pharmacy';

type NumericValue =
  | number
  | string
  | null
  | undefined;

function toNumber(
  value: NumericValue,
): number {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return 0;
}

function toNullableNumber(
  value: NumericValue,
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalizedValue =
    toNumber(value);

  return Number.isFinite(
    normalizedValue,
  )
    ? normalizedValue
    : null;
}

export type StoreSummary = {
  id: string;
  slug: string;

  categoryId: string;
  categorySlug: StoreCategorySlug;
  categoryName: string;
  categorySubtitle: string;

  name: string;
  description: string;
  icon: string;

  logoUrl: string | null;
  coverImageUrl: string | null;

  rating: number;

  deliveryTime: string;
  deliveryFee: number;
  minimumOrder: number;
  estimatedDeliveryMinutes:
    | number
    | null;

  isFeatured: boolean;
  isManuallyClosed: boolean;
  manualClosedNote: string | null;
};

export type ProductVariant = {
  id: string;
  slug: string;
  name: string;
  nameEn: string | null;
  price: number;
  compareAtPrice: number | null;
  sku: string | null;
  barcode: string | null;
  isDefault: boolean;
};

export type ProductImage = {
  id: string;
  imageUrl: string;
  altTextAr: string | null;
  altTextEn: string | null;
  isCover: boolean;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  productType:
    | 'food'
    | 'grocery'
    | 'pharmacy';

  name: string;
  nameEn: string | null;

  description: string;
  descriptionEn: string | null;

  price: number;
  compareAtPrice: number | null;

  sku: string | null;
  barcode: string | null;

  unitLabelAr: string | null;
  unitLabelEn: string | null;

  icon: string;
  imageUrl: string | null;

  requiresPrescription: boolean;
  isAgeRestricted: boolean;

  variants: ProductVariant[];
  images: ProductImage[];
};

export type CatalogSection = {
  id: string;
  slug: string;
  name: string;
  nameEn: string | null;
  imageUrl: string | null;
  products: CatalogProduct[];
};

export type StoreDetails = {
  id: string;
  slug: string;

  categoryId: string;
  categorySlug: StoreCategorySlug;
  categoryName: string;
  categorySubtitle: string;

  name: string;
  nameEn: string | null;

  shortDescription: string;
  shortDescriptionEn: string | null;

  fullDescription: string | null;
  fullDescriptionEn: string | null;

  icon: string;
  logoUrl: string | null;
  coverImageUrl: string | null;

  rating: number;
  deliveryTime: string;

  phone: string | null;
  whatsappNumber: string | null;

  addressAr: string | null;
  addressEn: string | null;

  latitude: number | null;
  longitude: number | null;

  averagePreparationMinutes:
    | number
    | null;

  isFeatured: boolean;
  isManuallyClosed: boolean;
  manualClosedNote: string | null;
};

export type StoreDelivery = {
  serviceAreaId: string;
  serviceAreaCode: string;
  serviceAreaName: string;

  deliveryFee: number;
  minimumOrder: number;
  estimatedDeliveryMinutes:
    | number
    | null;

  deliveryTime: string;
};

export type StoreBusinessHour = {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
};

export type StoreCatalog = {
  store: StoreDetails;
  delivery: StoreDelivery;
  businessHours: StoreBusinessHour[];
  sections: CatalogSection[];
};

type RawStoreSummary = {
  id: string;
  slug: string;
  category_id: string;
  category_slug: StoreCategorySlug;
  category_name_ar: string;
  category_subtitle_ar: string | null;
  name_ar: string;
  short_description_ar: string | null;
  icon: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  rating_avg: NumericValue;
  delivery_time_label_ar: string | null;
  delivery_fee: NumericValue;
  minimum_order_amount: NumericValue;
  estimated_delivery_minutes:
    NumericValue;
  is_featured: boolean;
  is_manually_closed: boolean;
  manual_closed_note_ar:
    | string
    | null;
};

type RawProductVariant = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  price: NumericValue;
  compare_at_price: NumericValue;
  sku: string | null;
  barcode: string | null;
  is_default: boolean;
};

type RawProductImage = {
  id: string;
  image_url: string;
  alt_text_ar: string | null;
  alt_text_en: string | null;
  is_cover: boolean;
};

type RawCatalogProduct = {
  id: string;
  slug: string;
  product_type:
    | 'food'
    | 'grocery'
    | 'pharmacy';
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  base_price: NumericValue;
  compare_at_price: NumericValue;
  sku: string | null;
  barcode: string | null;
  unit_label_ar: string | null;
  unit_label_en: string | null;
  icon: string | null;
  image_url: string | null;
  requires_prescription: boolean;
  is_age_restricted: boolean;
  variants: RawProductVariant[];
  images: RawProductImage[];
};

type RawCatalogSection = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  image_url: string | null;
  products: RawCatalogProduct[];
};

type RawStoreCatalog = {
  store: {
    id: string;
    slug: string;
    category_id: string;
    category_slug: StoreCategorySlug;
    category_name_ar: string;
    category_subtitle_ar:
      | string
      | null;
    name_ar: string;
    name_en: string | null;
    short_description_ar:
      | string
      | null;
    short_description_en:
      | string
      | null;
    full_description_ar:
      | string
      | null;
    full_description_en:
      | string
      | null;
    icon: string | null;
    logo_url: string | null;
    cover_image_url: string | null;
    rating_avg: NumericValue;
    delivery_time_label_ar:
      | string
      | null;
    phone: string | null;
    whatsapp_number: string | null;
    address_line_ar: string | null;
    address_line_en: string | null;
    latitude: NumericValue;
    longitude: NumericValue;
    average_preparation_minutes:
      NumericValue;
    is_featured: boolean;
    is_manually_closed: boolean;
    manual_closed_note_ar:
      | string
      | null;
  };

  delivery: {
    service_area_id: string;
    service_area_code: string;
    service_area_name_ar: string;
    delivery_fee: NumericValue;
    minimum_order_amount:
      NumericValue;
    estimated_delivery_minutes:
      NumericValue;
    delivery_time_label_ar:
      | string
      | null;
  };

  business_hours: Array<{
    day_of_week: number;
    is_open: boolean;
    open_time: string | null;
    close_time: string | null;
  }>;

  catalog_categories:
    RawCatalogSection[];
};

function mapStoreSummary(
  store: RawStoreSummary,
): StoreSummary {
  return {
    id: store.id,
    slug: store.slug,

    categoryId: store.category_id,
    categorySlug:
      store.category_slug,
    categoryName:
      store.category_name_ar,
    categorySubtitle:
      store.category_subtitle_ar ?? '',

    name: store.name_ar,
    description:
      store.short_description_ar ?? '',
    icon: store.icon ?? '🏪',

    logoUrl: store.logo_url,
    coverImageUrl:
      store.cover_image_url,

    rating: toNumber(
      store.rating_avg,
    ),

    deliveryTime:
      store.delivery_time_label_ar ??
      '',

    deliveryFee: toNumber(
      store.delivery_fee,
    ),

    minimumOrder: toNumber(
      store.minimum_order_amount,
    ),

    estimatedDeliveryMinutes:
      toNullableNumber(
        store
          .estimated_delivery_minutes,
      ),

    isFeatured: store.is_featured,

    isManuallyClosed:
      store.is_manually_closed,

    manualClosedNote:
      store.manual_closed_note_ar,
  };
}

function mapProductVariant(
  variant: RawProductVariant,
): ProductVariant {
  return {
    id: variant.id,
    slug: variant.slug,
    name: variant.name_ar,
    nameEn: variant.name_en,
    price: toNumber(variant.price),
    compareAtPrice:
      toNullableNumber(
        variant.compare_at_price,
      ),
    sku: variant.sku,
    barcode: variant.barcode,
    isDefault: variant.is_default,
  };
}

function mapProductImage(
  image: RawProductImage,
): ProductImage {
  return {
    id: image.id,
    imageUrl: image.image_url,
    altTextAr: image.alt_text_ar,
    altTextEn: image.alt_text_en,
    isCover: image.is_cover,
  };
}

function mapCatalogProduct(
  product: RawCatalogProduct,
): CatalogProduct {
  return {
    id: product.id,
    slug: product.slug,
    productType:
      product.product_type,

    name: product.name_ar,
    nameEn: product.name_en,

    description:
      product.description_ar ?? '',
    descriptionEn:
      product.description_en,

    price: toNumber(
      product.base_price,
    ),

    compareAtPrice:
      toNullableNumber(
        product.compare_at_price,
      ),

    sku: product.sku,
    barcode: product.barcode,

    unitLabelAr:
      product.unit_label_ar,
    unitLabelEn:
      product.unit_label_en,

    icon: product.icon ?? '📦',
    imageUrl: product.image_url,

    requiresPrescription:
      product.requires_prescription,

    isAgeRestricted:
      product.is_age_restricted,

    variants: (
      product.variants ?? []
    ).map(mapProductVariant),

    images: (
      product.images ?? []
    ).map(mapProductImage),
  };
}

function mapCatalogSection(
  section: RawCatalogSection,
): CatalogSection {
  return {
    id: section.id,
    slug: section.slug,
    name: section.name_ar,
    nameEn: section.name_en,
    imageUrl: section.image_url,
    products: (
      section.products ?? []
    ).map(mapCatalogProduct),
  };
}

function mapStoreCatalog(
  catalog: RawStoreCatalog,
): StoreCatalog {
  return {
    store: {
      id: catalog.store.id,
      slug: catalog.store.slug,

      categoryId:
        catalog.store.category_id,

      categorySlug:
        catalog.store.category_slug,

      categoryName:
        catalog.store
          .category_name_ar,

      categorySubtitle:
        catalog.store
          .category_subtitle_ar ??
        '',

      name: catalog.store.name_ar,
      nameEn: catalog.store.name_en,

      shortDescription:
        catalog.store
          .short_description_ar ??
        '',

      shortDescriptionEn:
        catalog.store
          .short_description_en,

      fullDescription:
        catalog.store
          .full_description_ar,

      fullDescriptionEn:
        catalog.store
          .full_description_en,

      icon:
        catalog.store.icon ??
        '🏪',

      logoUrl:
        catalog.store.logo_url,

      coverImageUrl:
        catalog.store
          .cover_image_url,

      rating: toNumber(
        catalog.store.rating_avg,
      ),

      deliveryTime:
        catalog.store
          .delivery_time_label_ar ??
        '',

      phone: catalog.store.phone,

      whatsappNumber:
        catalog.store
          .whatsapp_number,

      addressAr:
        catalog.store
          .address_line_ar,

      addressEn:
        catalog.store
          .address_line_en,

      latitude: toNullableNumber(
        catalog.store.latitude,
      ),

      longitude: toNullableNumber(
        catalog.store.longitude,
      ),

      averagePreparationMinutes:
        toNullableNumber(
          catalog.store
            .average_preparation_minutes,
        ),

      isFeatured:
        catalog.store.is_featured,

      isManuallyClosed:
        catalog.store
          .is_manually_closed,

      manualClosedNote:
        catalog.store
          .manual_closed_note_ar,
    },

    delivery: {
      serviceAreaId:
        catalog.delivery
          .service_area_id,

      serviceAreaCode:
        catalog.delivery
          .service_area_code,

      serviceAreaName:
        catalog.delivery
          .service_area_name_ar,

      deliveryFee: toNumber(
        catalog.delivery.delivery_fee,
      ),

      minimumOrder: toNumber(
        catalog.delivery
          .minimum_order_amount,
      ),

      estimatedDeliveryMinutes:
        toNullableNumber(
          catalog.delivery
            .estimated_delivery_minutes,
        ),

      deliveryTime:
        catalog.delivery
          .delivery_time_label_ar ??
        '',
    },

    businessHours: (
      catalog.business_hours ?? []
    ).map((businessHour) => ({
      dayOfWeek:
        businessHour.day_of_week,
      isOpen: businessHour.is_open,
      openTime:
        businessHour.open_time,
      closeTime:
        businessHour.close_time,
    })),

    sections: (
      catalog.catalog_categories ??
      []
    ).map(mapCatalogSection),
  };
}

export async function listStores(
  options: {
    serviceAreaId?: string;
    categorySlug?: StoreCategorySlug;
  } = {},
): Promise<StoreSummary[]> {
  const rpcArguments: {
    p_service_area_id?: string;
    p_category_slug?:
      StoreCategorySlug;
  } = {};

  if (options.serviceAreaId) {
    rpcArguments.p_service_area_id =
      options.serviceAreaId;
  }

  if (options.categorySlug) {
    rpcArguments.p_category_slug =
      options.categorySlug;
  }

  const { data, error } =
    Object.keys(rpcArguments)
      .length === 0
      ? await supabase.rpc(
          'list_stores',
        )
      : await supabase.rpc(
          'list_stores',
          rpcArguments,
        );

  if (error) {
    throw new Error(
      `Loading stores failed: ${error.message}`,
    );
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return (
    data as RawStoreSummary[]
  ).map(mapStoreSummary);
}

export async function getStoreCatalog(
  storeId: string,
  serviceAreaId?: string,
): Promise<StoreCatalog> {
  if (!storeId.trim()) {
    throw new Error(
      'A store ID is required.',
    );
  }

  const rpcArguments: {
    p_store_id: string;
    p_service_area_id?: string;
  } = {
    p_store_id: storeId,
  };

  if (serviceAreaId) {
    rpcArguments.p_service_area_id =
      serviceAreaId;
  }

  const { data, error } =
    await supabase.rpc(
      'get_store_catalog',
      rpcArguments,
    );

  if (error) {
    throw new Error(
      `Loading store catalog failed: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      'The store catalog was empty.',
    );
  }

  return mapStoreCatalog(
    data as RawStoreCatalog,
  );
}
