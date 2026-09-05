export type PrintingColorOption = {
  id: string;
  key: string;
  label: string;
  helper: string;
  iconName: string;
  isDefault: boolean;
  sortOrder: number;
};

export type PrintingSideOption = {
  id: string;
  key: string;
  label: string;
  helper: string;
  iconName: string;
  pagesPerSheet: number;
  isDefault: boolean;
  sortOrder: number;
};

export type PrintingRate = {
  id: string;
  colorOptionId: string;
  sideOptionId: string;
  productVariantId: string;
  pricePerSheet: number;
  sortOrder: number;
};

/**
 * Extra printing-specific copy shown outside the main form fields.
 *
 * The database owns these values. Defaults only keep older persisted carts
 * and mixed-version deployments readable while the configuration refreshes.
 */
export type PrintingUiCopy = {
  pageUnitLabel: string;
  pageRangeErrorTemplate: string;
  totalSheetsErrorTemplate: string;
  closedAlertTitle: string;
  closedFallback: string;
  addError: string;
  submitError: string;
  backAccessibilityLabel: string;
  increaseCopiesAccessibilityLabel: string;
  decreaseCopiesAccessibilityLabel: string;
  cartEditLabel: string;
  cartDeleteAccessibilityLabel: string;
  physicalSheetsUnitLabel: string;
  copyUnitLabel: string;
  orderItemsSummaryLabel: string;
  confirmationTitle: string;
  confirmationBody: string;
  confirmationPrimaryCta: string;
  sendFileCtaLabel: string;
  sendFileCtaHelper: string;
  orderFileCtaTitle: string;
  orderFileCtaBody: string;
  whatsappOpenErrorBody: string;
};

export type PrintingUiIcons = {
  hero: string;
  pageSizeBadge: string;
  summary: string;
  fileNotice: string;
  addCta: string;
  updateCta: string;
  confirmation: string;
  orderFile: string;
};

export const DEFAULT_PRINTING_UI_COPY: PrintingUiCopy = {
  pageUnitLabel: 'صفحة',
  pageRangeErrorTemplate:
    'اكتب رقمًا من {min} إلى {max} صفحة.',
  totalSheetsErrorTemplate:
    'الحد الأقصى للطلب الواحد {max} ورقة A4.',
  closedAlertTitle: 'المكتبة مغلقة حاليًا',
  closedFallback: 'لا يمكن إضافة طلب طباعة الآن.',
  addError: 'تعذر إضافة طلب الطباعة إلى هذه السلة.',
  submitError: 'تعذر إضافة طلب الطباعة. حاول مرة أخرى.',
  backAccessibilityLabel: 'رجوع',
  increaseCopiesAccessibilityLabel: 'زيادة عدد النسخ',
  decreaseCopiesAccessibilityLabel: 'تقليل عدد النسخ',
  cartEditLabel: 'تعديل',
  cartDeleteAccessibilityLabel: 'حذف طلب الطباعة',
  physicalSheetsUnitLabel: 'ورقة A4 فعلية',
  copyUnitLabel: 'نسخة',
  orderItemsSummaryLabel: 'عناصر الطلب',
  confirmationTitle: 'طلب الطباعة محفوظ وجاهز',
  confirmationBody:
    'أكد الطلب داخل Navienty Now، وبعدها سيفتح واتساب بالمواصفات تلقائيًا لتُرفق ملف الطباعة.',
  confirmationPrimaryCta:
    'تأكيد الطلب والمتابعة لإرسال الملف',
  sendFileCtaLabel: 'إرسال ملف الطباعة عبر واتساب',
  sendFileCtaHelper: 'خطوة مطلوبة لبدء تجهيز الطباعة',
  orderFileCtaTitle: 'إرسال ملف الطباعة عبر واتساب',
  orderFileCtaBody:
    'أرسل ملف الطباعة على واتساب لبدء التجهيز.',
  whatsappOpenErrorBody:
    'تم إنشاء طلبك بنجاح. افتح واتساب من شاشة الطلب وأرسل ملف الطباعة.',
};

export const DEFAULT_PRINTING_UI_ICONS: PrintingUiIcons = {
  hero: 'print-outline',
  pageSizeBadge: 'document-text-outline',
  summary: 'receipt-outline',
  fileNotice: 'logo-whatsapp',
  addCta: 'bag-add-outline',
  updateCta: 'checkmark',
  confirmation: 'receipt-outline',
  orderFile: 'logo-whatsapp',
};

function normalizeStringRecord(
  value: unknown,
): Record<string, string> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' &&
        entry[1].trim().length > 0,
    ),
  );
}

export function normalizePrintingUiCopy(
  value: unknown,
): PrintingUiCopy {
  return {
    ...DEFAULT_PRINTING_UI_COPY,
    ...normalizeStringRecord(value),
  };
}

export function normalizePrintingUiIcons(
  value: unknown,
): PrintingUiIcons {
  return {
    ...DEFAULT_PRINTING_UI_ICONS,
    ...normalizeStringRecord(value),
  };
}

export type PrintingServiceConfig = {
  id: string;
  storeId: string;
  catalogCategoryId: string;
  categorySlug: string;
  productId: string;
  productName: string;
  productIcon: string;

  eyebrow: string;
  title: string;
  subtitle: string;
  pageSizeLabel: string;

  colorSectionTitle: string;
  sidesSectionTitle: string;
  pageCountLabel: string;
  pageCountHelper: string;
  copyCountLabel: string;
  copyCountHelper: string;

  summaryTitle: string;
  sheetsPerCopyLabel: string;
  totalSheetsLabel: string;
  pricePerSheetLabel: string;
  totalLabel: string;

  fileNoticeTitle: string;
  fileNoticeBody: string;
  addCtaLabel: string;
  updateCtaLabel: string;
  whatsappFilePrompt: string;

  uiCopy: PrintingUiCopy;
  uiIcons: PrintingUiIcons;

  accentColor: string;
  accentDarkColor: string;
  heroBackgroundColor: string;

  minimumPageCount: number;
  maximumPageCount: number;
  defaultPageCount: number;
  pageCountPresets: number[];
  minimumCopyCount: number;
  maximumCopyCount: number;
  defaultCopyCount: number;
  maximumTotalSheets: number;

  colorOptions: PrintingColorOption[];
  sideOptions: PrintingSideOption[];
  rates: PrintingRate[];
};

export type PrintJobInput = {
  printingServiceId: string;
  colorOptionId: string;
  sideOptionId: string;
  pageCount: number;
  copyCount: number;
};

/**
 * Immutable pricing/configuration snapshot stored in the cart and later on
 * now.order_items. The server creates this object and remains authoritative.
 */
export type PrintJobSnapshot = {
  printingServiceId: string;
  storeId: string;
  catalogCategoryId: string;
  categorySlug: string;
  productId: string;
  productVariantId: string;
  productName: string;
  productIcon: string;

  colorOptionId: string;
  colorKey: string;
  colorLabel: string;
  sideOptionId: string;
  sideKey: string;
  sideLabel: string;

  pagesPerSheet: number;
  pageSizeLabel: string;
  pageCount: number;
  copyCount: number;
  sheetsPerCopy: number;
  totalSheets: number;
  pricePerSheet: number;
  totalPrice: number;
  summary: string;
  whatsappFilePrompt: string;

  uiCopy: PrintingUiCopy;
  uiIcons: PrintingUiIcons;
};

export type PrintJobOrderPayload = {
  printingServiceId: string;
  colorOptionId: string;
  sideOptionId: string;
  pageCount: number;
  copyCount: number;
};

export function toPrintJobOrderPayload(
  snapshot: PrintJobSnapshot,
): PrintJobOrderPayload {
  return {
    printingServiceId:
      snapshot.printingServiceId,
    colorOptionId:
      snapshot.colorOptionId,
    sideOptionId:
      snapshot.sideOptionId,
    pageCount:
      snapshot.pageCount,
    copyCount:
      snapshot.copyCount,
  };
}

export function toPrintJobRpcPayload(
  snapshot: PrintJobSnapshot,
) {
  return {
    printing_service_id:
      snapshot.printingServiceId,
    color_option_id:
      snapshot.colorOptionId,
    side_option_id:
      snapshot.sideOptionId,
    page_count:
      snapshot.pageCount,
    copy_count:
      snapshot.copyCount,
  };
}
