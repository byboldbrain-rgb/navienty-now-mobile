import { supabase } from '../lib/supabase';

export type VoucherDiscountTarget =
  | 'order_subtotal'
  | 'delivery_fee';

export type VoucherDiscountType =
  | 'fixed'
  | 'percentage';

export type VoucherCategorySlug =
  | 'restaurants'
  | 'supermarket'
  | 'bookstores';

export type VoucherQuote = {
  valid: true;
  voucherId: string;
  code: string;
  titleAr: string;
  descriptionAr: string | null;
  discountTarget: VoucherDiscountTarget;
  discountType: VoucherDiscountType;
  discountValue: number;
  discountAmount: number;
  discountBaseAmount: number;
  minimumSubtotal: number;
  maxDiscountAmount: number | null;
  subtotalBeforeDiscount: number;
  subtotalAfterDiscount: number;
  deliveryFeeBeforeDiscount: number;
  deliveryFeeAfterDiscount: number;
  eligibleCategorySlugs: VoucherCategorySlug[];
  startsAt: string | null;
  endsAt: string | null;
};

type RawVoucherQuote = {
  valid: boolean;
  voucher_id: string;
  code: string;
  title_ar?: string | null;
  description_ar?: string | null;
  discount_target: VoucherDiscountTarget;
  discount_type: VoucherDiscountType;
  discount_value: number | string;
  discount_amount: number | string;
  discount_base_amount?:
    | number
    | string;
  minimum_subtotal: number | string;
  max_discount_amount?:
    | number
    | string
    | null;
  subtotal_before_discount:
    | number
    | string;
  subtotal_after_discount:
    | number
    | string;
  delivery_fee_before_discount?:
    | number
    | string;
  delivery_fee_after_discount?:
    | number
    | string;
  eligible_category_slugs?: unknown;
  starts_at?: string | null;
  ends_at?: string | null;
};

function toNumber(
  value:
    | number
    | string
    | null
    | undefined,
): number {
  const parsed =
    typeof value === 'number'
      ? value
      : Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function normalizeVoucherCode(
  value: string,
): string {
  return value
    .trim()
    .toUpperCase();
}

function mapCategorySlugs(
  value: unknown,
): VoucherCategorySlug[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const supported = new Set<
    VoucherCategorySlug
  >([
    'restaurants',
    'supermarket',
    'bookstores',
  ]);

  return value.filter(
    (
      item,
    ): item is VoucherCategorySlug =>
      typeof item === 'string' &&
      supported.has(
        item as VoucherCategorySlug,
      ),
  );
}

function getVoucherErrorMessage(
  error: unknown,
): string {
  const fallback =
    'تعذر تطبيق الكوبون. حاول مرة أخرى.';

  if (
    !error ||
    typeof error !== 'object'
  ) {
    return fallback;
  }

  const message =
    'message' in error &&
    typeof error.message === 'string'
      ? error.message
      : '';

  const details =
    'details' in error &&
    typeof error.details === 'string'
      ? error.details
      : '';

  const combined =
    `${message} ${details}`;

  const knownErrors: Array<
    [string, string]
  > = [
    [
      'authentication_required',
      'تعذر تحديد حسابك. أغلق التطبيق وافتحه مرة أخرى ثم حاول مجددًا.',
    ],
    [
      'voucher_invalid_code',
      'اكتب كود كوبون صحيح.',
    ],
    [
      'voucher_not_found',
      'الكوبون غير موجود أو الكود غير صحيح.',
    ],
    [
      'voucher_inactive',
      'الكوبون غير متاح حاليًا.',
    ],
    [
      'voucher_not_started',
      'الكوبون لم يبدأ بعد.',
    ],
    [
      'voucher_expired',
      'انتهت صلاحية هذا الكوبون.',
    ],
    [
      'voucher_store_not_eligible',
      'الكوبون غير متاح لهذا المتجر.',
    ],
    [
      'voucher_category_not_eligible',
      'الكوبون غير متاح لهذا القسم.',
    ],
    [
      'voucher_minimum_not_reached',
      'قيمة المنتجات أقل من الحد الأدنى المطلوب لاستخدام الكوبون.',
    ],
    [
      'voucher_usage_limit_reached',
      'تم استخدام الكوبون بالكامل.',
    ],
    [
      'voucher_user_limit_reached',
      'استخدمت هذا الكوبون بالفعل بالحد المسموح.',
    ],
    [
      'voucher_first_order_only',
      'الكوبون متاح لأول طلب فقط.',
    ],
    [
      'voucher_order_conflict',
      'تعذر تغيير الكوبون لهذا الطلب. أعد المحاولة من صفحة إتمام الطلب.',
    ],
    [
      'voucher_invalid_delivery_fee',
      'تعذر تحديد رسوم التوصيل لتطبيق هذا الكوبون.',
    ],
    [
      'voucher_no_discount',
      'لا يمكن تطبيق خصم على القيمة الحالية.',
    ],
  ];

  for (
    const [
      code,
      localizedMessage,
    ] of knownErrors
  ) {
    if (combined.includes(code)) {
      return localizedMessage;
    }
  }

  return fallback;
}

export async function validateVoucher(
  input: {
    code: string;
    storeId: string;
    subtotal: number;
    deliveryFee?: number | null;
    customerPhone?: string | null;
  },
): Promise<VoucherQuote> {
  const code =
    normalizeVoucherCode(
      input.code,
    );

  if (
    code.length < 3 ||
    code.length > 32
  ) {
    throw new Error(
      'اكتب كود كوبون صحيح.',
    );
  }

  const hasDeliveryFee =
    input.deliveryFee !== null &&
    input.deliveryFee !== undefined;

  if (
    !input.storeId.trim() ||
    !Number.isFinite(
      input.subtotal,
    ) ||
    input.subtotal < 0 ||
    (
      hasDeliveryFee &&
      (
        !Number.isFinite(
          input.deliveryFee,
        ) ||
        Number(input.deliveryFee) < 0
      )
    )
  ) {
    throw new Error(
      'تعذر التحقق من الكوبون للطلب الحالي.',
    );
  }

  const rpcArgs =
    hasDeliveryFee
      ? {
          p_code: code,
          p_store_id:
            input.storeId,
          p_subtotal:
            input.subtotal,
          p_delivery_fee:
            Number(
              input.deliveryFee,
            ),
          p_customer_phone:
            input.customerPhone ??
            null,
        }
      : {
          p_code: code,
          p_store_id:
            input.storeId,
          p_subtotal:
            input.subtotal,
          p_customer_phone:
            input.customerPhone ??
            null,
        };

  const {
    data,
    error,
  } = await supabase.rpc(
    'validate_voucher',
    rpcArgs,
  );

  if (error) {
    throw new Error(
      getVoucherErrorMessage(error),
    );
  }

  if (!data) {
    throw new Error(
      'تعذر التحقق من الكوبون.',
    );
  }

  const raw =
    data as unknown as RawVoucherQuote;

  if (
    raw.valid !== true ||
    !raw.voucher_id ||
    !raw.code ||
    (
      raw.discount_target !==
        'order_subtotal' &&
      raw.discount_target !==
        'delivery_fee'
    )
  ) {
    throw new Error(
      'تعذر التحقق من الكوبون.',
    );
  }

  const subtotalBeforeDiscount =
    toNumber(
      raw.subtotal_before_discount,
    );

  const deliveryFeeBeforeDiscount =
    toNumber(
      raw.delivery_fee_before_discount ??
        input.deliveryFee ??
        0,
    );

  return {
    valid: true,
    voucherId:
      raw.voucher_id,
    code:
      raw.code,
    titleAr:
      raw.title_ar?.trim() ||
      'تم تطبيق الكوبون',
    descriptionAr:
      raw.description_ar ?? null,
    discountTarget:
      raw.discount_target,
    discountType:
      raw.discount_type,
    discountValue:
      toNumber(
        raw.discount_value,
      ),
    discountAmount:
      toNumber(
        raw.discount_amount,
      ),
    discountBaseAmount:
      toNumber(
        raw.discount_base_amount ??
          (
            raw.discount_target ===
              'delivery_fee'
              ? deliveryFeeBeforeDiscount
              : subtotalBeforeDiscount
          ),
      ),
    minimumSubtotal:
      toNumber(
        raw.minimum_subtotal,
      ),
    maxDiscountAmount:
      raw.max_discount_amount ===
        null ||
      raw.max_discount_amount ===
        undefined
        ? null
        : toNumber(
            raw.max_discount_amount,
          ),
    subtotalBeforeDiscount,
    subtotalAfterDiscount:
      toNumber(
        raw.subtotal_after_discount,
      ),
    deliveryFeeBeforeDiscount,
    deliveryFeeAfterDiscount:
      toNumber(
        raw.delivery_fee_after_discount ??
          deliveryFeeBeforeDiscount,
      ),
    eligibleCategorySlugs:
      mapCategorySlugs(
        raw.eligible_category_slugs,
      ),
    startsAt:
      raw.starts_at ?? null,
    endsAt:
      raw.ends_at ?? null,
  };
}

export default {
  validateVoucher,
};
