import { publicSupabase } from '../lib/supabase';
import type {
  PrintJobInput,
  PrintJobSnapshot,
  PrintingColorOption,
  PrintingRate,
  PrintingServiceConfig,
  PrintingSideOption,
} from '../types/printing';
import {
  normalizePrintingUiCopy,
  normalizePrintingUiIcons,
} from '../types/printing';

type NumericValue =
  | number
  | string
  | null
  | undefined;

type RawPrintingColorOption = {
  id: string;
  key: string;
  label_ar: string;
  helper_ar: string;
  icon_name: string;
  is_default: boolean;
  sort_order: NumericValue;
};

type RawPrintingSideOption = {
  id: string;
  key: string;
  label_ar: string;
  helper_ar: string;
  icon_name: string;
  pages_per_sheet: NumericValue;
  is_default: boolean;
  sort_order: NumericValue;
};

type RawPrintingRate = {
  id: string;
  color_option_id: string;
  side_option_id: string;
  product_variant_id: string;
  price_per_sheet: NumericValue;
  sort_order: NumericValue;
};

type RawPrintingServiceConfig = {
  id: string;
  store_id: string;
  catalog_category_id: string;
  category_slug: string;
  product_id: string;
  product_name_ar: string;
  product_icon: string | null;

  eyebrow_ar: string;
  title_ar: string;
  subtitle_ar: string;
  page_size_label_ar: string;
  color_section_title_ar: string;
  sides_section_title_ar: string;
  page_count_label_ar: string;
  page_count_helper_ar: string;
  copy_count_label_ar: string;
  copy_count_helper_ar: string;
  summary_title_ar: string;
  sheets_per_copy_label_ar: string;
  total_sheets_label_ar: string;
  price_per_sheet_label_ar: string;
  total_label_ar: string;
  file_notice_title_ar: string;
  file_notice_body_ar: string;
  add_cta_label_ar: string;
  update_cta_label_ar: string;
  whatsapp_file_prompt_ar: string;
  ui_copy?: unknown;
  ui_icons?: unknown;

  accent_color: string;
  accent_dark_color: string;
  hero_background_color: string;

  minimum_page_count: NumericValue;
  maximum_page_count: NumericValue;
  default_page_count: NumericValue;
  page_count_presets: NumericValue[];
  minimum_copy_count: NumericValue;
  maximum_copy_count: NumericValue;
  default_copy_count: NumericValue;
  maximum_total_sheets: NumericValue;

  color_options: RawPrintingColorOption[];
  side_options: RawPrintingSideOption[];
  rates: RawPrintingRate[];
};

type RawPrintJobQuote = {
  printing_service_id: string;
  store_id: string;
  catalog_category_id: string;
  category_slug: string;
  product_id: string;
  product_variant_id: string;
  product_name_ar: string;
  product_icon: string | null;
  color_option_id: string;
  color_key: string;
  color_label_ar: string;
  side_option_id: string;
  side_key: string;
  side_label_ar: string;
  pages_per_sheet: NumericValue;
  page_size_label_ar: string;
  page_count: NumericValue;
  copy_count: NumericValue;
  sheets_per_copy: NumericValue;
  total_sheets: NumericValue;
  price_per_sheet: NumericValue;
  total_price: NumericValue;
  summary_ar: string;
  whatsapp_file_prompt_ar: string;
  ui_copy?: unknown;
  ui_icons?: unknown;
};

export type LocalPrintJobQuote = {
  colorOption: PrintingColorOption | null;
  sideOption: PrintingSideOption | null;
  rate: PrintingRate | null;
  pageCount: number;
  copyCount: number;
  sheetsPerCopy: number;
  totalSheets: number;
  totalPrice: number;
  pageCountIsValid: boolean;
  copyCountIsValid: boolean;
  totalSheetsIsValid: boolean;
  isValid: boolean;
};

const CONFIG_CACHE_TTL_MS =
  60 * 1000;

const configCache = new Map<
  string,
  {
    value: PrintingServiceConfig;
    expiresAt: number;
  }
>();

const configRequests = new Map<
  string,
  Promise<PrintingServiceConfig>
>();

function toNumber(
  value: NumericValue,
): number {
  const parsedValue =
    typeof value === 'number'
      ? value
      : Number(value ?? 0);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : 0;
}

function toInteger(
  value: NumericValue,
): number {
  return Math.trunc(
    toNumber(value),
  );
}

function mapColorOption(
  option: RawPrintingColorOption,
): PrintingColorOption {
  return {
    id: option.id,
    key: option.key,
    label: option.label_ar,
    helper: option.helper_ar,
    iconName:
      option.icon_name ||
      'document-text-outline',
    isDefault:
      option.is_default === true,
    sortOrder:
      toInteger(option.sort_order),
  };
}

function mapSideOption(
  option: RawPrintingSideOption,
): PrintingSideOption {
  return {
    id: option.id,
    key: option.key,
    label: option.label_ar,
    helper: option.helper_ar,
    iconName:
      option.icon_name ||
      'documents-outline',
    pagesPerSheet: Math.max(
      toInteger(
        option.pages_per_sheet,
      ),
      1,
    ),
    isDefault:
      option.is_default === true,
    sortOrder:
      toInteger(option.sort_order),
  };
}

function mapRate(
  rate: RawPrintingRate,
): PrintingRate {
  return {
    id: rate.id,
    colorOptionId:
      rate.color_option_id,
    sideOptionId:
      rate.side_option_id,
    productVariantId:
      rate.product_variant_id,
    pricePerSheet:
      toNumber(
        rate.price_per_sheet,
      ),
    sortOrder:
      toInteger(rate.sort_order),
  };
}

function mapConfig(
  config: RawPrintingServiceConfig,
): PrintingServiceConfig {
  const colorOptions = (
    config.color_options ?? []
  )
    .map(mapColorOption)
    .sort(
      (first, second) =>
        first.sortOrder -
        second.sortOrder,
    );

  const sideOptions = (
    config.side_options ?? []
  )
    .map(mapSideOption)
    .sort(
      (first, second) =>
        first.sortOrder -
        second.sortOrder,
    );

  const rates = (
    config.rates ?? []
  )
    .map(mapRate)
    .sort(
      (first, second) =>
        first.sortOrder -
        second.sortOrder,
    );

  if (
    colorOptions.length === 0 ||
    sideOptions.length === 0 ||
    rates.length === 0
  ) {
    throw new Error(
      'إعدادات أسعار الطباعة غير مكتملة في Supabase.',
    );
  }

  return {
    id: config.id,
    storeId: config.store_id,
    catalogCategoryId:
      config.catalog_category_id,
    categorySlug:
      config.category_slug,
    productId: config.product_id,
    productName:
      config.product_name_ar,
    productIcon:
      config.product_icon || '🖨️',

    eyebrow: config.eyebrow_ar,
    title: config.title_ar,
    subtitle: config.subtitle_ar,
    pageSizeLabel:
      config.page_size_label_ar,
    colorSectionTitle:
      config.color_section_title_ar,
    sidesSectionTitle:
      config.sides_section_title_ar,
    pageCountLabel:
      config.page_count_label_ar,
    pageCountHelper:
      config.page_count_helper_ar,
    copyCountLabel:
      config.copy_count_label_ar,
    copyCountHelper:
      config.copy_count_helper_ar,
    summaryTitle:
      config.summary_title_ar,
    sheetsPerCopyLabel:
      config.sheets_per_copy_label_ar,
    totalSheetsLabel:
      config.total_sheets_label_ar,
    pricePerSheetLabel:
      config.price_per_sheet_label_ar,
    totalLabel:
      config.total_label_ar,
    fileNoticeTitle:
      config.file_notice_title_ar,
    fileNoticeBody:
      config.file_notice_body_ar,
    addCtaLabel:
      config.add_cta_label_ar,
    updateCtaLabel:
      config.update_cta_label_ar,
    whatsappFilePrompt:
      config.whatsapp_file_prompt_ar,
    uiCopy:
      normalizePrintingUiCopy(
        config.ui_copy,
      ),
    uiIcons:
      normalizePrintingUiIcons(
        config.ui_icons,
      ),

    accentColor:
      config.accent_color ||
      '#00B14F',
    accentDarkColor:
      config.accent_dark_color ||
      '#009245',
    heroBackgroundColor:
      config.hero_background_color ||
      '#EAF8F0',

    minimumPageCount: Math.max(
      toInteger(
        config.minimum_page_count,
      ),
      1,
    ),
    maximumPageCount: Math.max(
      toInteger(
        config.maximum_page_count,
      ),
      1,
    ),
    defaultPageCount: Math.max(
      toInteger(
        config.default_page_count,
      ),
      1,
    ),
    pageCountPresets: (
      config.page_count_presets ?? []
    )
      .map(toInteger)
      .filter(
        (value) => value > 0,
      ),
    minimumCopyCount: Math.max(
      toInteger(
        config.minimum_copy_count,
      ),
      1,
    ),
    maximumCopyCount: Math.max(
      toInteger(
        config.maximum_copy_count,
      ),
      1,
    ),
    defaultCopyCount: Math.max(
      toInteger(
        config.default_copy_count,
      ),
      1,
    ),
    maximumTotalSheets: Math.max(
      toInteger(
        config.maximum_total_sheets,
      ),
      1,
    ),

    colorOptions,
    sideOptions,
    rates,
  };
}

function mapQuote(
  quote: RawPrintJobQuote,
): PrintJobSnapshot {
  return {
    printingServiceId:
      quote.printing_service_id,
    storeId: quote.store_id,
    catalogCategoryId:
      quote.catalog_category_id,
    categorySlug:
      quote.category_slug,
    productId: quote.product_id,
    productVariantId:
      quote.product_variant_id,
    productName:
      quote.product_name_ar,
    productIcon:
      quote.product_icon || '🖨️',

    colorOptionId:
      quote.color_option_id,
    colorKey: quote.color_key,
    colorLabel:
      quote.color_label_ar,
    sideOptionId:
      quote.side_option_id,
    sideKey: quote.side_key,
    sideLabel:
      quote.side_label_ar,

    pagesPerSheet: Math.max(
      toInteger(
        quote.pages_per_sheet,
      ),
      1,
    ),
    pageSizeLabel:
      quote.page_size_label_ar,
    pageCount:
      toInteger(quote.page_count),
    copyCount:
      toInteger(quote.copy_count),
    sheetsPerCopy:
      toInteger(
        quote.sheets_per_copy,
      ),
    totalSheets:
      toInteger(
        quote.total_sheets,
      ),
    pricePerSheet:
      toNumber(
        quote.price_per_sheet,
      ),
    totalPrice:
      toNumber(quote.total_price),
    summary: quote.summary_ar,
    whatsappFilePrompt:
      quote.whatsapp_file_prompt_ar,
    uiCopy:
      normalizePrintingUiCopy(
        quote.ui_copy,
      ),
    uiIcons:
      normalizePrintingUiIcons(
        quote.ui_icons,
      ),
  };
}

function getErrorMessage(
  error: unknown,
): string {
  const rawMessage =
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message
      : '';

  const knownErrors: Array<
    [string, string]
  > = [
    [
      'printing_service_not_available',
      'خدمة الطباعة غير متاحة حاليًا.',
    ],
    [
      'printing_color_option_not_available',
      'نوع الطباعة المختار لم يعد متاحًا.',
    ],
    [
      'printing_side_option_not_available',
      'اختيار وجه/وجهين لم يعد متاحًا.',
    ],
    [
      'printing_rate_not_available',
      'سعر هذا الاختيار غير متاح حاليًا.',
    ],
    [
      'invalid_printing_page_count',
      'عدد صفحات الملف خارج الحد المسموح.',
    ],
    [
      'invalid_printing_copy_count',
      'عدد النسخ خارج الحد المسموح.',
    ],
    [
      'printing_total_sheets_limit_exceeded',
      'إجمالي أوراق الطباعة أكبر من الحد المسموح للطلب الواحد.',
    ],
  ];

  return (
    knownErrors.find(
      ([code]) =>
        rawMessage.includes(code),
    )?.[1] ||
    rawMessage ||
    'تعذر تحميل خدمة الطباعة. حاول مرة أخرى.'
  );
}

function getConfigCacheKey(
  storeId: string,
  catalogCategoryId: string,
) {
  return `${storeId.trim()}:${catalogCategoryId.trim()}`;
}

async function loadPrintingServiceConfig(
  storeId: string,
  catalogCategoryId: string,
): Promise<PrintingServiceConfig> {
  const nowClient =
    (publicSupabase as any).schema(
      'now',
    );

  const { data, error } =
    await nowClient.rpc(
      'get_printing_service_config',
      {
        p_store_id: storeId,
        p_catalog_category_id:
          catalogCategoryId,
      },
    );

  if (error) {
    throw new Error(
      getErrorMessage(error),
    );
  }

  if (
    !data ||
    typeof data !== 'object'
  ) {
    throw new Error(
      'خدمة الطباعة غير متاحة حاليًا.',
    );
  }

  return mapConfig(
    data as RawPrintingServiceConfig,
  );
}

export async function getPrintingServiceConfig(
  storeId: string,
  catalogCategoryId: string,
): Promise<PrintingServiceConfig> {
  const cacheKey =
    getConfigCacheKey(
      storeId,
      catalogCategoryId,
    );

  const cached =
    configCache.get(cacheKey);

  if (
    cached &&
    cached.expiresAt > Date.now()
  ) {
    return cached.value;
  }

  const pending =
    configRequests.get(cacheKey);

  if (pending) {
    return pending;
  }

  const request =
    loadPrintingServiceConfig(
      storeId,
      catalogCategoryId,
    ).then((config) => {
      configCache.set(cacheKey, {
        value: config,
        expiresAt:
          Date.now() +
          CONFIG_CACHE_TTL_MS,
      });

      return config;
    });

  configRequests.set(
    cacheKey,
    request,
  );

  try {
    return await request;
  } finally {
    if (
      configRequests.get(cacheKey) ===
      request
    ) {
      configRequests.delete(cacheKey);
    }
  }
}

export function calculateLocalPrintJobQuote(
  config: PrintingServiceConfig,
  input: {
    colorOptionId: string;
    sideOptionId: string;
    pageCount: number;
    copyCount: number;
  },
): LocalPrintJobQuote {
  const pageCount = Math.trunc(
    Number(input.pageCount ?? 0),
  );

  const copyCount = Math.trunc(
    Number(input.copyCount ?? 0),
  );

  const colorOption =
    config.colorOptions.find(
      (option) =>
        option.id ===
        input.colorOptionId,
    ) ?? null;

  const sideOption =
    config.sideOptions.find(
      (option) =>
        option.id ===
        input.sideOptionId,
    ) ?? null;

  const rate =
    config.rates.find(
      (candidate) =>
        candidate.colorOptionId ===
          input.colorOptionId &&
        candidate.sideOptionId ===
          input.sideOptionId,
    ) ?? null;

  const pageCountIsValid =
    pageCount >=
      config.minimumPageCount &&
    pageCount <=
      config.maximumPageCount;

  const copyCountIsValid =
    copyCount >=
      config.minimumCopyCount &&
    copyCount <=
      config.maximumCopyCount;

  const sheetsPerCopy =
    sideOption && pageCount > 0
      ? Math.ceil(
          pageCount /
            sideOption.pagesPerSheet,
        )
      : 0;

  const totalSheets =
    sheetsPerCopy *
    Math.max(copyCount, 0);

  const totalSheetsIsValid =
    totalSheets > 0 &&
    totalSheets <=
      config.maximumTotalSheets;

  const totalPrice = rate
    ? Number(
        (
          rate.pricePerSheet *
          totalSheets
        ).toFixed(2),
      )
    : 0;

  return {
    colorOption,
    sideOption,
    rate,
    pageCount,
    copyCount,
    sheetsPerCopy,
    totalSheets,
    totalPrice,
    pageCountIsValid,
    copyCountIsValid,
    totalSheetsIsValid,
    isValid:
      !!colorOption &&
      !!sideOption &&
      !!rate &&
      pageCountIsValid &&
      copyCountIsValid &&
      totalSheetsIsValid,
  };
}

export async function quotePrintJob(
  input: PrintJobInput,
): Promise<PrintJobSnapshot> {
  const nowClient =
    (publicSupabase as any).schema(
      'now',
    );

  const { data, error } =
    await nowClient.rpc(
      'quote_print_job',
      {
        p_printing_service_id:
          input.printingServiceId,
        p_color_option_id:
          input.colorOptionId,
        p_side_option_id:
          input.sideOptionId,
        p_page_count:
          input.pageCount,
        p_copy_count:
          input.copyCount,
      },
    );

  if (error) {
    throw new Error(
      getErrorMessage(error),
    );
  }

  if (
    !data ||
    typeof data !== 'object'
  ) {
    throw new Error(
      'لم ترجع قاعدة البيانات سعر الطباعة.',
    );
  }

  return mapQuote(
    data as RawPrintJobQuote,
  );
}
