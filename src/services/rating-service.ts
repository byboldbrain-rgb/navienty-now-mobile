import { supabase } from '../lib/supabase';

export type OrderRating = {
  rated: boolean;
  rating: number | null;
  createdAt: string | null;
};

export type SubmitOrderRatingResult = {
  orderId: string;
  storeId: string;
  rating: number;
  createdAt: string;
  storeRatingAvg: number;
  storeRatingCount: number;
};

type RawOrderRating = {
  rated?: boolean;
  rating?: number | string | null;
  created_at?: string | null;
};

type RawSubmitOrderRatingResult = {
  order_id: string;
  store_id: string;
  rating: number | string;
  created_at: string;
  store_rating_avg: number | string;
  store_rating_count: number | string;
};

function toNumber(
  value: number | string | null | undefined,
): number {
  const parsed =
    typeof value === 'number'
      ? value
      : Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function getRatingErrorMessage(
  error: unknown,
): string {
  const fallback =
    'تعذر إرسال التقييم. حاول مرة أخرى.';

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

  const text =
    `${message} ${details}`;

  if (
    text.includes(
      'authentication_required',
    )
  ) {
    return 'سجل الدخول أولًا حتى تتمكن من تقييم الطلب.';
  }

  if (
    text.includes('order_not_found') ||
    text.includes('order_not_owned')
  ) {
    return 'تعذر التحقق من هذا الطلب.';
  }

  if (
    text.includes('order_not_delivered')
  ) {
    return 'يمكنك تقييم الطلب بعد اكتمال التوصيل فقط.';
  }

  if (
    text.includes(
      'rating_already_submitted',
    )
  ) {
    return 'تم تقييم هذا الطلب بالفعل.';
  }

  if (
    text.includes('invalid_rating')
  ) {
    return 'اختر تقييمًا من نجمة إلى خمس نجوم.';
  }

  return fallback;
}

export async function getOrderRating(
  orderId: string,
): Promise<OrderRating> {
  const { data, error } =
    await supabase.rpc(
      'get_order_rating',
      {
        p_order_id: orderId,
      },
    );

  if (error) {
    throw new Error(
      getRatingErrorMessage(error),
    );
  }

  const raw =
    (data ?? {}) as RawOrderRating;

  const rating =
    raw.rating === null ||
    raw.rating === undefined
      ? null
      : toNumber(raw.rating);

  return {
    rated:
      raw.rated === true &&
      rating !== null,
    rating,
    createdAt:
      raw.created_at ?? null,
  };
}

export async function submitOrderRating(
  orderId: string,
  rating: number,
): Promise<SubmitOrderRatingResult> {
  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    throw new Error(
      'اختر تقييمًا من نجمة إلى خمس نجوم.',
    );
  }

  const { data, error } =
    await supabase.rpc(
      'submit_order_rating',
      {
        p_order_id: orderId,
        p_rating: rating,
      },
    );

  if (error) {
    throw new Error(
      getRatingErrorMessage(error),
    );
  }

  const raw =
    data as RawSubmitOrderRatingResult;

  return {
    orderId: raw.order_id,
    storeId: raw.store_id,
    rating: toNumber(raw.rating),
    createdAt: raw.created_at,
    storeRatingAvg:
      toNumber(raw.store_rating_avg),
    storeRatingCount:
      toNumber(raw.store_rating_count),
  };
}
