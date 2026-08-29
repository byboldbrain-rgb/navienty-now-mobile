import {
  isV1PublicCategorySlug,
  V1_UNAVAILABLE_CATEGORY_MESSAGE,
} from '../config/v1-release-scope';
import { publicSupabase } from '../lib/supabase';

export type StoreCategorySlug =
  | 'restaurants'
  | 'supermarket'
  | 'personal-care'
  | 'bookstore'
  | 'bookstores';

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

function normalizeSlug(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getStoreCategoryAliases(
  categorySlug: StoreCategorySlug,
): string[] {
  const normalizedSlug =
    normalizeSlug(categorySlug);

  if (
    normalizedSlug === 'bookstore' ||
    normalizedSlug === 'bookstores'
  ) {
    return [
      'bookstore',
      'bookstores',
    ];
  }

  return [normalizedSlug];
}

/* ============================================================
 * STORE SUMMARY
 * ============================================================
 */

export type StoreSummary = {
  id: string;
  slug: string;

  categoryId: string;
  categorySlug: string;
  categoryName: string;
  categorySubtitle: string;

  name: string;
  description: string;
  icon: string;

  logoUrl: string | null;
  coverImageUrl: string | null;

  rating: number;
  ratingCount: number;

  deliveryTime: string;
  deliveryFee: number;
  minimumOrder: number;

  estimatedDeliveryMinutes:
    | number
    | null;

  isFeatured: boolean;
  isManuallyClosed: boolean;

  manualClosedNote:
    | string
    | null;
};

/* ============================================================
 * PRODUCT
 * ============================================================
 */

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

  /**
   * Category التي المنتج مربوط بها مباشرة.
   */
  catalogCategoryId: string;

  name: string;
  nameEn: string | null;

  description: string;
  descriptionEn: string | null;

  price: number;

  compareAtPrice:
    | number
    | null;

  sku: string | null;
  barcode: string | null;

  unitLabelAr:
    | string
    | null;

  unitLabelEn:
    | string
    | null;

  icon: string;

  imageUrl:
    | string
    | null;

  isAgeRestricted: boolean;

  variants: ProductVariant[];
  images: ProductImage[];
};

/* ============================================================
 * CATALOG CATEGORY
 *
 * مثال:
 *
 * Dairy & Eggs
 *   ↓
 * Milk
 *      ↓
 * Fresh Milk
 *      ↓
 * Products
 * ============================================================
 */

export type CatalogSection = {
  id: string;
  slug: string;

  name: string;
  nameEn: string | null;

  imageUrl:
    | string
    | null;

  /**
   * NULL = Main Category
   *
   * UUID = Subcategory
   */
  parentId:
    | string
    | null;

  /**
   * مستوى Category داخل الشجرة.
   *
   * 0 = Main Category
   * 1 = Subcategory
   * 2 = Sub-subcategory
   */
  depth: number;

  sortOrder: number;

  /**
   * المنتجات المرتبطة مباشرة
   * بهذه Category فقط.
   */
  products: CatalogProduct[];

  /**
   * Categories الموجودة تحتها.
   */
  children: CatalogSection[];
};

/* ============================================================
 * STORE DETAILS
 * ============================================================
 */

export type StoreDetails = {
  id: string;
  slug: string;

  categoryId: string;
  categorySlug: string;
  categoryName: string;
  categorySubtitle: string;

  name: string;
  nameEn: string | null;

  shortDescription: string;
  shortDescriptionEn:
    | string
    | null;

  fullDescription:
    | string
    | null;

  fullDescriptionEn:
    | string
    | null;

  icon: string;

  logoUrl:
    | string
    | null;

  coverImageUrl:
    | string
    | null;

  rating: number;
  ratingCount: number;

  deliveryTime: string;

  phone:
    | string
    | null;

  whatsappNumber:
    | string
    | null;

  addressAr:
    | string
    | null;

  addressEn:
    | string
    | null;

  latitude:
    | number
    | null;

  longitude:
    | number
    | null;

  averagePreparationMinutes:
    | number
    | null;

  isFeatured: boolean;

  isManuallyClosed: boolean;

  manualClosedNote:
    | string
    | null;
};

/* ============================================================
 * DELIVERY
 * ============================================================
 */

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

/* ============================================================
 * BUSINESS HOURS
 * ============================================================
 */

export type StoreBusinessHour = {
  dayOfWeek: number;

  isOpen: boolean;

  openTime:
    | string
    | null;

  closeTime:
    | string
    | null;
};

/* ============================================================
 * FULL STORE CATALOG
 * ============================================================
 */

export type StoreCatalog = {
  store: StoreDetails;

  delivery: StoreDelivery;

  businessHours:
    StoreBusinessHour[];

  /**
   * Flat list.
   *
   * موجودة للحفاظ على توافق
   * كل الواجهات القديمة.
   */
  sections: CatalogSection[];

  /**
   * Hierarchical Category Tree.
   *
   * مثال:
   *
   * Dairy & Eggs
   *  └─ Milk
   *      └─ Fresh Milk
   */
  categoryTree: CatalogSection[];
};

/* ============================================================
 * RAW TYPES
 * ============================================================
 */

type RawStoreSummary = {
  id: string;
  slug: string;

  category_id: string;

  category_slug: string;

  category_name_ar: string;

  category_subtitle_ar:
    | string
    | null;

  name_ar: string;

  short_description_ar:
    | string
    | null;

  icon:
    | string
    | null;

  logo_url:
    | string
    | null;

  cover_image_url:
    | string
    | null;

  rating_avg:
    NumericValue;

  rating_count?:
    NumericValue;

  delivery_time_label_ar:
    | string
    | null;

  delivery_fee:
    NumericValue;

  minimum_order_amount:
    NumericValue;

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

  name_en:
    | string
    | null;

  price: NumericValue;

  compare_at_price:
    NumericValue;

  sku:
    | string
    | null;

  barcode:
    | string
    | null;

  is_default: boolean;
};

type RawProductImage = {
  id: string;

  image_url: string;

  alt_text_ar:
    | string
    | null;

  alt_text_en:
    | string
    | null;

  is_cover: boolean;
};

type RawCatalogProduct = {
  id: string;
  slug: string;

  name_ar: string;

  name_en:
    | string
    | null;

  description_ar:
    | string
    | null;

  description_en:
    | string
    | null;

  base_price:
    NumericValue;

  compare_at_price:
    NumericValue;

  sku:
    | string
    | null;

  barcode:
    | string
    | null;

  unit_label_ar:
    | string
    | null;

  unit_label_en:
    | string
    | null;

  icon:
    | string
    | null;

  image_url:
    | string
    | null;

  is_age_restricted: boolean;

  variants:
    RawProductVariant[];

  images:
    RawProductImage[];
};

type RawCatalogSection = {
  id: string;
  slug: string;

  name_ar: string;

  name_en:
    | string
    | null;

  image_url:
    | string
    | null;

  /**
   * الـRPC القديم ممكن مايرجعهمش،
   * لذلك Optional.
   */
  parent_id?:
    | string
    | null;

  sort_order?: NumericValue;

  products:
    RawCatalogProduct[];
};

type RawCatalogCategoryMeta = {
  id: string;

  parent_id:
    | string
    | null;

  slug: string;

  name_ar: string;

  name_en:
    | string
    | null;

  image_url:
    | string
    | null;

  sort_order: NumericValue;
};

type RawStoreCatalog = {
  store: {
    id: string;
    slug: string;

    category_id: string;

    category_slug: string;

    category_name_ar: string;

    category_subtitle_ar:
      | string
      | null;

    name_ar: string;

    name_en:
      | string
      | null;

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

    icon:
      | string
      | null;

    logo_url:
      | string
      | null;

    cover_image_url:
      | string
      | null;

    rating_avg:
      NumericValue;

    rating_count?:
      NumericValue;

    delivery_time_label_ar:
      | string
      | null;

    phone:
      | string
      | null;

    whatsapp_number:
      | string
      | null;

    address_line_ar:
      | string
      | null;

    address_line_en:
      | string
      | null;

    latitude:
      NumericValue;

    longitude:
      NumericValue;

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

    delivery_fee:
      NumericValue;

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

    open_time:
      | string
      | null;

    close_time:
      | string
      | null;
  }>;

  catalog_categories:
    RawCatalogSection[];
};

/* ============================================================
 * MAPPERS
 * ============================================================
 */

function mapStoreSummary(
  store: RawStoreSummary,
): StoreSummary {
  return {
    id: store.id,
    slug: store.slug,

    categoryId:
      store.category_id,

    categorySlug:
      store.category_slug,

    categoryName:
      store.category_name_ar,

    categorySubtitle:
      store.category_subtitle_ar ??
      '',

    name:
      store.name_ar,

    description:
      store.short_description_ar ??
      '',

    icon:
      store.icon ??
      '🏪',

    logoUrl:
      store.logo_url,

    coverImageUrl:
      store.cover_image_url,

    rating:
      toNumber(
        store.rating_avg,
      ),

    ratingCount:
      toNumber(
        store.rating_count,
      ),

    deliveryTime:
      store.delivery_time_label_ar ??
      '',

    deliveryFee:
      toNumber(
        store.delivery_fee,
      ),

    minimumOrder:
      toNumber(
        store.minimum_order_amount,
      ),

    estimatedDeliveryMinutes:
      toNullableNumber(
        store
          .estimated_delivery_minutes,
      ),

    isFeatured:
      store.is_featured,

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
    id:
      variant.id,

    slug:
      variant.slug,

    name:
      variant.name_ar,

    nameEn:
      variant.name_en,

    price:
      toNumber(
        variant.price,
      ),

    compareAtPrice:
      toNullableNumber(
        variant.compare_at_price,
      ),

    sku:
      variant.sku,

    barcode:
      variant.barcode,

    isDefault:
      variant.is_default,
  };
}

function mapProductImage(
  image: RawProductImage,
): ProductImage {
  return {
    id:
      image.id,

    imageUrl:
      image.image_url,

    altTextAr:
      image.alt_text_ar,

    altTextEn:
      image.alt_text_en,

    isCover:
      image.is_cover,
  };
}

function mapCatalogProduct(
  product: RawCatalogProduct,
  catalogCategoryId: string,
): CatalogProduct {
  return {
    id:
      product.id,

    slug:
      product.slug,

    catalogCategoryId,

    name:
      product.name_ar,

    nameEn:
      product.name_en,

    description:
      product.description_ar ??
      '',

    descriptionEn:
      product.description_en,

    price:
      toNumber(
        product.base_price,
      ),

    compareAtPrice:
      toNullableNumber(
        product.compare_at_price,
      ),

    sku:
      product.sku,

    barcode:
      product.barcode,

    unitLabelAr:
      product.unit_label_ar,

    unitLabelEn:
      product.unit_label_en,

    icon:
      product.icon ??
      '📦',

    imageUrl:
      product.image_url,

    isAgeRestricted:
      product.is_age_restricted,

    variants:
      (
        product.variants ??
        []
      ).map(
        mapProductVariant,
      ),

    images:
      (
        product.images ??
        []
      ).map(
        mapProductImage,
      ),
  };
}

/* ============================================================
 * CATEGORY TREE BUILDER
 * ============================================================
 */

function buildCatalogSections(
  rawSections: RawCatalogSection[],
  categoryMeta:
    RawCatalogCategoryMeta[],
): {
  sections: CatalogSection[];
  categoryTree: CatalogSection[];
} {
  /**
   * المنتجات الراجعة من
   * get_store_catalog
   * مربوطة بـ Category ID.
   */
  const rawSectionById =
    new Map<
      string,
      RawCatalogSection
    >();

  for (
    const section of rawSections
  ) {
    rawSectionById.set(
      section.id,
      section,
    );
  }

  /**
   * نبني Flat List أولاً.
   */
  const sections:
    CatalogSection[] =
    categoryMeta.map(
      (category) => {
        const rawSection =
          rawSectionById.get(
            category.id,
          );

        return {
          id:
            category.id,

          slug:
            category.slug,

          name:
            category.name_ar,

          nameEn:
            category.name_en,

          imageUrl:
            category.image_url,

          parentId:
            category.parent_id,

          depth: 0,

          sortOrder:
            toNumber(
              category.sort_order,
            ),

          products:
            (
              rawSection?.products ??
              []
            ).map(
              (product) =>
                mapCatalogProduct(
                  product,
                  category.id,
                ),
            ),

          children: [],
        };
      },
    );

  /**
   * Fallback:
   *
   * لو الـRPC رجع Category
   * ولم ترجع من query لأي سبب،
   * نحتفظ بها حتى ما نكسرش
   * الواجهات القديمة.
   */
  const existingIds =
    new Set(
      sections.map(
        (section) =>
          section.id,
      ),
    );

  for (
    const rawSection of rawSections
  ) {
    if (
      existingIds.has(
        rawSection.id,
      )
    ) {
      continue;
    }

    sections.push({
      id:
        rawSection.id,

      slug:
        rawSection.slug,

      name:
        rawSection.name_ar,

      nameEn:
        rawSection.name_en,

      imageUrl:
        rawSection.image_url,

      parentId:
        rawSection.parent_id ??
        null,

      depth: 0,

      sortOrder:
        toNumber(
          rawSection.sort_order,
        ),

      products:
        (
          rawSection.products ??
          []
        ).map(
          (product) =>
            mapCatalogProduct(
              product,
              rawSection.id,
            ),
        ),

      children: [],
    });
  }

  const sectionMap =
    new Map<
      string,
      CatalogSection
    >();

  for (
    const section of sections
  ) {
    sectionMap.set(
      section.id,
      section,
    );
  }

  const roots:
    CatalogSection[] = [];

  /**
   * نربط Child بالـ Parent.
   */
  for (
    const section of sections
  ) {
    if (
      section.parentId
    ) {
      const parent =
        sectionMap.get(
          section.parentId,
        );

      if (parent) {
        parent.children.push(
          section,
        );

        continue;
      }
    }

    roots.push(section);
  }

  function sortCategories(
    categories:
      CatalogSection[],
  ) {
    categories.sort(
      (first, second) => {
        if (
          first.sortOrder !==
          second.sortOrder
        ) {
          return (
            first.sortOrder -
            second.sortOrder
          );
        }

        return (
          first.name.localeCompare(
            second.name,
            'ar',
          )
        );
      },
    );

    for (
      const category of categories
    ) {
      sortCategories(
        category.children,
      );
    }
  }

  function assignDepth(
    categories:
      CatalogSection[],
    depth: number,
  ) {
    for (
      const category of categories
    ) {
      category.depth =
        depth;

      assignDepth(
        category.children,
        depth + 1,
      );
    }
  }

  sortCategories(roots);

  assignDepth(
    roots,
    0,
  );

  /**
   * Flat list تظل مرتبة أيضًا.
   */
  sections.sort(
    (first, second) => {
      if (
        first.depth !==
        second.depth
      ) {
        return (
          first.depth -
          second.depth
        );
      }

      if (
        first.sortOrder !==
        second.sortOrder
      ) {
        return (
          first.sortOrder -
          second.sortOrder
        );
      }

      return (
        first.name.localeCompare(
          second.name,
          'ar',
        )
      );
    },
  );

  return {
    sections,
    categoryTree: roots,
  };
}

/* ============================================================
 * STORE CATALOG MAPPER
 * ============================================================
 */

function mapStoreCatalog(
  catalog: RawStoreCatalog,
  categoryMeta:
    RawCatalogCategoryMeta[],
): StoreCatalog {
  const {
    sections,
    categoryTree,
  } = buildCatalogSections(
    catalog.catalog_categories ??
      [],
    categoryMeta,
  );

  return {
    store: {
      id:
        catalog.store.id,

      slug:
        catalog.store.slug,

      categoryId:
        catalog.store
          .category_id,

      categorySlug:
        catalog.store
          .category_slug,

      categoryName:
        catalog.store
          .category_name_ar,

      categorySubtitle:
        catalog.store
          .category_subtitle_ar ??
        '',

      name:
        catalog.store.name_ar,

      nameEn:
        catalog.store.name_en,

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

      rating:
        toNumber(
          catalog.store
            .rating_avg,
        ),

      ratingCount:
        toNumber(
          catalog.store
            .rating_count,
        ),

      deliveryTime:
        catalog.store
          .delivery_time_label_ar ??
        '',

      phone:
        catalog.store.phone,

      whatsappNumber:
        catalog.store
          .whatsapp_number,

      addressAr:
        catalog.store
          .address_line_ar,

      addressEn:
        catalog.store
          .address_line_en,

      latitude:
        toNullableNumber(
          catalog.store
            .latitude,
        ),

      longitude:
        toNullableNumber(
          catalog.store
            .longitude,
        ),

      averagePreparationMinutes:
        toNullableNumber(
          catalog.store
            .average_preparation_minutes,
        ),

      isFeatured:
        catalog.store
          .is_featured,

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

      deliveryFee:
        toNumber(
          catalog.delivery
            .delivery_fee,
        ),

      minimumOrder:
        toNumber(
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

    businessHours:
      (
        catalog.business_hours ??
        []
      ).map(
        (businessHour) => ({
          dayOfWeek:
            businessHour
              .day_of_week,

          isOpen:
            businessHour.is_open,

          openTime:
            businessHour.open_time,

          closeTime:
            businessHour.close_time,
        }),
      ),

    sections,

    categoryTree,
  };
}

/* ============================================================
 * CATEGORY HELPERS
 *
 * تستخدمهم في الواجهات.
 * ============================================================
 */

/**
 * البحث عن Category بالـID.
 */
export function findCatalogSectionById(
  catalog: StoreCatalog,
  categoryId: string,
): CatalogSection | null {
  return (
    catalog.sections.find(
      (section) =>
        section.id ===
        categoryId,
    ) ?? null
  );
}

/**
 * البحث عن Category بالـSlug.
 */
export function findCatalogSectionBySlug(
  catalog: StoreCatalog,
  slug: string,
): CatalogSection | null {
  const normalizedSlug =
    normalizeSlug(slug);

  return (
    catalog.sections.find(
      (section) =>
        normalizeSlug(
          section.slug,
        ) ===
        normalizedSlug,
    ) ?? null
  );
}

/**
 * يرجع Main Categories فقط.
 *
 * مثال:
 *
 * Fruit & Veg
 * Bakery
 * Dairy & Eggs
 * Beverages
 */
export function getRootCatalogSections(
  catalog: StoreCatalog,
): CatalogSection[] {
  return catalog.categoryTree;
}

/**
 * يرجع الـSubcategories المباشرة.
 *
 * مثال:
 *
 * Dairy & Eggs
 *      ↓
 * Milk
 * Cheese
 * Yogurt
 * Eggs
 */
export function getCatalogSectionChildren(
  section: CatalogSection,
): CatalogSection[] {
  return section.children;
}

/**
 * يرجع كل Descendants
 * الموجودة تحت Category.
 */
export function getCatalogSectionDescendants(
  section: CatalogSection,
): CatalogSection[] {
  const result:
    CatalogSection[] = [];

  function walk(
    category:
      CatalogSection,
  ) {
    for (
      const child of
        category.children
    ) {
      result.push(child);

      walk(child);
    }
  }

  walk(section);

  return result;
}

/**
 * يرجع المنتجات.
 *
 * includeDescendants = false
 * المنتجات المرتبطة بالـCategory نفسها فقط.
 *
 * includeDescendants = true
 * المنتجات الموجودة في Category
 * وكل الـSubcategories الموجودة تحتها.
 *
 * وده مهم جدًا لزر "الكل".
 */
export function getCatalogSectionProducts(
  section: CatalogSection,
  includeDescendants = true,
): CatalogProduct[] {
  if (!includeDescendants) {
    return section.products;
  }

  const products =
    new Map<
      string,
      CatalogProduct
    >();

  function collect(
    category:
      CatalogSection,
  ) {
    for (
      const product of
        category.products
    ) {
      products.set(
        product.id,
        product,
      );
    }

    for (
      const child of
        category.children
    ) {
      collect(child);
    }
  }

  collect(section);

  return Array.from(
    products.values(),
  );
}

/**
 * يرجع المنتجات اللي عليها عرض
 * من Category وكل أبنائها.
 *
 * compareAtPrice > price
 */
export function getCatalogSectionOffers(
  section: CatalogSection,
): CatalogProduct[] {
  return getCatalogSectionProducts(
    section,
    true,
  ).filter(
    (product) =>
      product.compareAtPrice !==
        null &&
      product.compareAtPrice >
        product.price,
  );
}

/* ============================================================
 * LIST STORES
 * ============================================================
 */

const PUBLIC_CATALOG_CACHE_TTL_MS =
  60 * 1000;

type TimedCacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const storeListCache =
  new Map<
    string,
    TimedCacheEntry<StoreSummary[]>
  >();

const storeListRequests =
  new Map<
    string,
    Promise<StoreSummary[]>
  >();

const storeCatalogCache =
  new Map<
    string,
    TimedCacheEntry<StoreCatalog>
  >();

const storeCatalogRequests =
  new Map<
    string,
    Promise<StoreCatalog>
  >();

function readTimedCache<T>(
  cache: Map<
    string,
    TimedCacheEntry<T>
  >,
  key: string,
): T | null {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function writeTimedCache<T>(
  cache: Map<
    string,
    TimedCacheEntry<T>
  >,
  key: string,
  value: T,
) {
  cache.set(key, {
    value,
    expiresAt:
      Date.now() +
      PUBLIC_CATALOG_CACHE_TTL_MS,
  });
}

function getStoreListCacheKey(
  options: {
    serviceAreaId?: string;
    categorySlug?: StoreCategorySlug;
  },
) {
  const serviceAreaKey =
    options.serviceAreaId?.trim() || '*';

  const categoryKey =
    options.categorySlug
      ? normalizeSlug(
          options.categorySlug,
        )
      : '*';

  return `${serviceAreaKey}:${categoryKey}`;
}

function filterStoresByCategory(
  stores: StoreSummary[],
  categorySlug: StoreCategorySlug,
) {
  const categoryAliases =
    new Set(
      getStoreCategoryAliases(
        categorySlug,
      ),
    );

  return stores.filter(
    (store) =>
      isV1PublicCategorySlug(
        store.categorySlug,
      ) &&
      categoryAliases.has(
        normalizeSlug(
          store.categorySlug,
        ),
      ),
  );
}

function filterV1PublicStores(
  stores: StoreSummary[],
): StoreSummary[] {
  return stores.filter((store) =>
    isV1PublicCategorySlug(
      store.categorySlug,
    ),
  );
}

async function loadStoresFromSupabase(
  options: {
    serviceAreaId?: string;
    categorySlug?:
      StoreCategorySlug;
  } = {},
): Promise<StoreSummary[]> {
  const rpcArguments: {
    p_service_area_id?:
      string;

    p_category_slug?:
      StoreCategorySlug;
  } = {};

  if (
    options.serviceAreaId
  ) {
    rpcArguments.p_service_area_id =
      options.serviceAreaId;
  }

  if (
    options.categorySlug
  ) {
    rpcArguments.p_category_slug =
      options.categorySlug;
  }

  const primaryResult =
    Object.keys(
      rpcArguments,
    ).length === 0
      ? await publicSupabase.rpc(
          'list_stores',
        )
      : await publicSupabase.rpc(
          'list_stores',
          rpcArguments,
        );

  if (primaryResult.error) {
    throw new Error(
      `Loading stores failed: ${primaryResult.error.message}`,
    );
  }

  const primaryRows =
    Array.isArray(
      primaryResult.data,
    )
      ? (
          primaryResult.data as RawStoreSummary[]
        )
      : [];

  if (
    primaryRows.length > 0 ||
    !options.categorySlug
  ) {
    return filterV1PublicStores(
      primaryRows.map(
        mapStoreSummary,
      ),
    );
  }

  /**
   * Defensive fallback:
   *
   * بعض نسخ list_stores القديمة قد تكون
   * لا تتعامل مع bookstore/bookstores في
   * p_category_slug، رغم أن المتجر نفسه
   * يظهر عند جلب متاجر منطقة الخدمة كلها.
   *
   * لذلك لو الفلترة من الـRPC رجعت صفر:
   * 1. نعيد نفس الاستعلام لنفس Service Area
   *    بدون فلتر Category.
   * 2. نفلتر محليًا بالـslug.
   *
   * مهم:
   * لا نتجاهل Service Area، وبالتالي لن
   * نعرض متجرًا غير قابل للتوصيل للمنطقة.
   */
  const fallbackArguments: {
    p_service_area_id?: string;
  } = {};

  if (
    options.serviceAreaId
  ) {
    fallbackArguments.p_service_area_id =
      options.serviceAreaId;
  }

  const fallbackResult =
    Object.keys(
      fallbackArguments,
    ).length === 0
      ? await publicSupabase.rpc(
          'list_stores',
        )
      : await publicSupabase.rpc(
          'list_stores',
          fallbackArguments,
        );

  if (fallbackResult.error) {
    throw new Error(
      `Loading stores fallback failed: ${fallbackResult.error.message}`,
    );
  }

  if (
    !Array.isArray(
      fallbackResult.data,
    )
  ) {
    return [];
  }

  const fallbackStores =
    filterV1PublicStores(
      (
        fallbackResult.data as RawStoreSummary[]
      ).map(
        mapStoreSummary,
      ),
    );

  writeTimedCache(
    storeListCache,
    getStoreListCacheKey({
      serviceAreaId:
        options.serviceAreaId,
    }),
    fallbackStores,
  );

  return filterStoresByCategory(
    fallbackStores,
    options.categorySlug,
  );
}

export async function listStores(
  options: {
    serviceAreaId?: string;
    categorySlug?:
      StoreCategorySlug;
  } = {},
): Promise<StoreSummary[]> {
  if (
    options.categorySlug &&
    !isV1PublicCategorySlug(
      options.categorySlug,
    )
  ) {
    return [];
  }

  const cacheKey =
    getStoreListCacheKey(options);

  const cachedStores =
    readTimedCache(
      storeListCache,
      cacheKey,
    );

  if (cachedStores) {
    return cachedStores;
  }

  if (options.categorySlug) {
    const allStoresKey =
      getStoreListCacheKey({
        serviceAreaId:
          options.serviceAreaId,
      });

    const cachedAllStores =
      readTimedCache(
        storeListCache,
        allStoresKey,
      );

    if (cachedAllStores) {
      const filteredStores =
        filterStoresByCategory(
          cachedAllStores,
          options.categorySlug,
        );

      writeTimedCache(
        storeListCache,
        cacheKey,
        filteredStores,
      );

      return filteredStores;
    }

    const allStoresRequest =
      storeListRequests.get(
        allStoresKey,
      );

    if (allStoresRequest) {
      const allStores =
        await allStoresRequest;

      const filteredStores =
        filterStoresByCategory(
          allStores,
          options.categorySlug,
        );

      writeTimedCache(
        storeListCache,
        cacheKey,
        filteredStores,
      );

      return filteredStores;
    }
  }

  const pendingRequest =
    storeListRequests.get(cacheKey);

  if (pendingRequest) {
    return pendingRequest;
  }

  const request =
    loadStoresFromSupabase(
      options,
    ).then((stores) => {
      writeTimedCache(
        storeListCache,
        cacheKey,
        stores,
      );

      return stores;
    });

  storeListRequests.set(
    cacheKey,
    request,
  );

  try {
    return await request;
  } finally {
    if (
      storeListRequests.get(
        cacheKey,
      ) === request
    ) {
      storeListRequests.delete(
        cacheKey,
      );
    }
  }
}

/* ============================================================
 * LOAD CATEGORY METADATA
 *
 * الجزء ده بيجيب parent_id
 * مباشرة من now.catalog_categories.
 *
 * get_store_catalog القديم
 * يفضل شغال عادي.
 * ============================================================
 */

async function loadCatalogCategoryMeta(
  storeId: string,
): Promise<
  RawCatalogCategoryMeta[]
> {
  /**
   * بنستخدم schema('now')
   * لأن الجدول موجود داخل:
   *
   * now.catalog_categories
   */
  const nowClient =
    (publicSupabase as any).schema(
      'now',
    );

  const {
    data,
    error,
  } = await nowClient
    .from(
      'catalog_categories',
    )
    .select(
      [
        'id',
        'parent_id',
        'slug',
        'name_ar',
        'name_en',
        'image_url',
        'sort_order',
      ].join(','),
    )
    .eq(
      'store_id',
      storeId,
    )
    .eq(
      'is_active',
      true,
    )
    .order(
      'sort_order',
      {
        ascending: true,
      },
    )
    .order(
      'created_at',
      {
        ascending: true,
      },
    );

  if (error) {
    throw new Error(
      `Loading catalog category hierarchy failed: ${error.message}`,
    );
  }

  if (
    !Array.isArray(data)
  ) {
    return [];
  }

  return (
    data as RawCatalogCategoryMeta[]
  );
}

/* ============================================================
 * GET STORE CATALOG
 * ============================================================
 */

async function loadStoreCatalogFromSupabase(
  storeId: string,
  serviceAreaId?: string,
): Promise<StoreCatalog> {
  if (
    !storeId.trim()
  ) {
    throw new Error(
      'A store ID is required.',
    );
  }

  const rpcArguments: {
    p_store_id: string;

    p_service_area_id?:
      string;
  } = {
    p_store_id:
      storeId,
  };

  if (
    serviceAreaId
  ) {
    rpcArguments.p_service_area_id =
      serviceAreaId;
  }

  /**
   * بنجيب:
   *
   * 1. الـCatalog القديم بالمنتجات
   * 2. Category hierarchy الجديدة
   *
   * في نفس الوقت.
   */
  const [
    catalogResult,
    categoryMeta,
  ] = await Promise.all([
    publicSupabase.rpc(
      'get_store_catalog',
      rpcArguments,
    ),

    loadCatalogCategoryMeta(
      storeId,
    ),
  ]);

  const {
    data,
    error,
  } = catalogResult;

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
    categoryMeta,
  );
}

export async function getStoreCatalog(
  storeId: string,
  serviceAreaId?: string,
): Promise<StoreCatalog> {
  const normalizedStoreId =
    storeId.trim();

  if (!normalizedStoreId) {
    throw new Error(
      'A store ID is required.',
    );
  }

  const normalizedServiceAreaId =
    serviceAreaId?.trim() || undefined;

  const cacheKey =
    `${normalizedStoreId}:` +
    `${normalizedServiceAreaId ?? '*'}`;

  const cachedCatalog =
    readTimedCache(
      storeCatalogCache,
      cacheKey,
    );

  if (cachedCatalog) {
    if (
      !isV1PublicCategorySlug(
        cachedCatalog.store.categorySlug,
      )
    ) {
      storeCatalogCache.delete(
        cacheKey,
      );

      throw new Error(
        V1_UNAVAILABLE_CATEGORY_MESSAGE,
      );
    }

    return cachedCatalog;
  }

  const pendingRequest =
    storeCatalogRequests.get(
      cacheKey,
    );

  if (pendingRequest) {
    return pendingRequest;
  }

  const request =
    loadStoreCatalogFromSupabase(
      normalizedStoreId,
      normalizedServiceAreaId,
    ).then((catalog) => {
      if (
        !isV1PublicCategorySlug(
          catalog.store.categorySlug,
        )
      ) {
        throw new Error(
          V1_UNAVAILABLE_CATEGORY_MESSAGE,
        );
      }

      writeTimedCache(
        storeCatalogCache,
        cacheKey,
        catalog,
      );

      return catalog;
    });

  storeCatalogRequests.set(
    cacheKey,
    request,
  );

  try {
    return await request;
  } finally {
    if (
      storeCatalogRequests.get(
        cacheKey,
      ) === request
    ) {
      storeCatalogRequests.delete(
        cacheKey,
      );
    }
  }
}
