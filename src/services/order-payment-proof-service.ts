import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import {
  PRIVATE_UPLOAD_MIME_TYPES,
  PrivateUploadValidationError,
  assertPrivateUploadContent,
  assertPrivateUploadSize,
  normalizePrivateUploadMimeType,
  type PrivateUploadMimeType,
} from '../domain/private-upload-validation';

import { supabase } from '../lib/supabase';
import { ensureAppSession } from './anonymous-auth-service';

export type OrderPaymentProofStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type OrderPaymentProof = {
  id: string;
  orderId: string;
  paymentMethodId: string;
  amount: number;
  currencyCode: string;
  status: OrderPaymentProofStatus;
  bucket: string;
  path: string;
  reviewNote: string | null;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
};

type RawOrderPaymentProof = {
  id?: unknown;
  order_id?: unknown;
  payment_method_id?: unknown;
  amount?: unknown;
  currency_code?: unknown;
  status?: unknown;
  bucket?: unknown;
  path?: unknown;
  review_note?: unknown;
  created_at?: unknown;
  submitted_at?: unknown;
  reviewed_at?: unknown;
};

export type PaymentProofPreparationResult =
  | {
      required: false;
      proof: null;
    }
  | {
      required: true;
      proof: OrderPaymentProof;
    };

export type PaymentProofUploadResult =
  | {
      status: 'cancelled';
      proof: null;
      fileName: null;
    }
  | {
      status: 'submitted';
      proof: OrderPaymentProof;
      fileName: string;
    };

function getValidatedUploadMimeType(
  value: string | null | undefined,
): PrivateUploadMimeType {
  try {
    return normalizePrivateUploadMimeType(value);
  } catch (error) {
    if (
      error instanceof PrivateUploadValidationError &&
      error.code === 'unsupported_type'
    ) {
      throw new Error("اختر صورة لإثبات الدفع أو ملف PDF فقط.");
    }

    throw error;
  }
}

function assertValidatedUploadSize(
  size: number | null | undefined,
): void {
  try {
    assertPrivateUploadSize(size);
  } catch (error) {
    if (error instanceof PrivateUploadValidationError) {
      if (error.code === 'too_large') {
        throw new Error("حجم إثبات الدفع أكبر من 8 ميجابايت.");
      }

      if (error.code === 'invalid_size') {
        throw new Error("تعذر التحقق من حجم إثبات الدفع أو أن الملف فارغ.");
      }
    }

    throw error;
  }
}

function assertValidatedUploadContent(
  mimeType: PrivateUploadMimeType,
  buffer: ArrayBuffer,
): void {
  try {
    assertPrivateUploadContent(
      mimeType,
      buffer,
    );
  } catch (error) {
    if (error instanceof PrivateUploadValidationError) {
      if (error.code === 'too_large') {
        throw new Error("حجم إثبات الدفع أكبر من 8 ميجابايت.");
      }

      if (error.code === 'invalid_size') {
        throw new Error("تعذر التحقق من حجم إثبات الدفع أو أن الملف فارغ.");
      }

      if (error.code === 'content_type_mismatch') {
        throw new Error("محتوى ملف إثبات الدفع لا يطابق نوعه. اختر صورة JPEG أو PNG أو WebP أو ملف PDF صالح.");
      }
    }

    throw error;
  }
}

function nullableString(
  value: unknown,
): string | null {
  return typeof value === 'string'
    ? value
    : null;
}

function mapOrderPaymentProof(
  value: unknown,
): OrderPaymentProof {
  if (!value || typeof value !== 'object') {
    throw new Error(
      'استجابة إثبات الدفع من Supabase غير صالحة.',
    );
  }

  const row =
    value as RawOrderPaymentProof;

  const id = nullableString(row.id);
  const orderId = nullableString(
    row.order_id,
  );
  const paymentMethodId = nullableString(
    row.payment_method_id,
  );
  const currencyCode = nullableString(
    row.currency_code,
  );
  const status = nullableString(
    row.status,
  );
  const bucket = nullableString(
    row.bucket,
  );
  const path = nullableString(row.path);
  const createdAt = nullableString(
    row.created_at,
  );
  const amount = Number(row.amount);

  if (
    !id ||
    !orderId ||
    !paymentMethodId ||
    !currencyCode ||
    !status ||
    !bucket ||
    !path ||
    !createdAt ||
    !Number.isFinite(amount) ||
    ![
      'draft',
      'submitted',
      'approved',
      'rejected',
      'cancelled',
    ].includes(status)
  ) {
    throw new Error(
      'بيانات إثبات الدفع من Supabase غير مكتملة.',
    );
  }

  return {
    id,
    orderId,
    paymentMethodId,
    amount,
    currencyCode,
    status:
      status as OrderPaymentProofStatus,
    bucket,
    path,
    reviewNote:
      nullableString(row.review_note),
    createdAt,
    submittedAt:
      nullableString(row.submitted_at),
    reviewedAt:
      nullableString(row.reviewed_at),
  };
}

function getPaymentProofErrorMessage(
  error: unknown,
): string {
  const fallback =
    'تعذر تجهيز إثبات الدفع. حاول مرة أخرى.';

  if (
    !error ||
    typeof error !== 'object' ||
    !('message' in error) ||
    typeof error.message !== 'string'
  ) {
    return fallback;
  }

  const message = error.message;

  const knownErrors: Array<
    [string, string]
  > = [
    [
      'authentication_required',
      'تعذر تحديد حساب الجهاز. أغلق التطبيق وافتحه مرة أخرى ثم حاول مجددًا.',
    ],
    [
      'payment_proof_order_not_found',
      'تعذر العثور على الطلب المرتبط بإثبات الدفع.',
    ],
    [
      'payment_already_verified',
      'تم تأكيد دفع هذا الطلب بالفعل.',
    ],
    [
      'payment_proof_order_closed',
      'هذا الطلب لم يعد يقبل إثبات دفع جديد.',
    ],
    [
      'payment_proof_not_found',
      'تعذر العثور على إثبات الدفع الحالي.',
    ],
    [
      'payment_proof_not_editable',
      'إثبات الدفع الحالي قيد المراجعة أو تمت مراجعته بالفعل.',
    ],
    [
      'payment_proof_file_not_uploaded',
      'لم يكتمل رفع ملف إثبات الدفع.',
    ],
  ];

  return (
    knownErrors.find(
      ([code]) =>
        message.includes(code),
    )?.[1] ??
    message ??
    fallback
  );
}

function isPaymentProofNotRequired(
  error: unknown,
): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string' &&
      error.message.includes(
        'payment_proof_not_required',
      ),
  );
}

export async function prepareOrderPaymentProof(
  orderId: string,
): Promise<PaymentProofPreparationResult> {
  await ensureAppSession();

  const { data, error } =
    await supabase.rpc(
      'create_order_payment_proof',
      {
        p_order_id: orderId,
      },
    );

  if (error) {
    if (isPaymentProofNotRequired(error)) {
      return {
        required: false,
        proof: null,
      };
    }

    throw new Error(
      getPaymentProofErrorMessage(error),
    );
  }

  return {
    required: true,
    proof: mapOrderPaymentProof(data),
  };
}

export async function getMyOrderPaymentProof(
  orderId: string,
): Promise<OrderPaymentProof | null> {
  await ensureAppSession();

  const { data, error } =
    await supabase.rpc(
      'get_my_order_payment_proof',
      {
        p_order_id: orderId,
      },
    );

  if (error) {
    throw new Error(
      getPaymentProofErrorMessage(error),
    );
  }

  return data == null
    ? null
    : mapOrderPaymentProof(data);
}

export async function submitOrderPaymentProof(
  proofId: string,
): Promise<OrderPaymentProof> {
  const { data, error } =
    await supabase.rpc(
      'submit_order_payment_proof',
      {
        p_proof_id: proofId,
      },
    );

  if (error) {
    throw new Error(
      getPaymentProofErrorMessage(error),
    );
  }

  return mapOrderPaymentProof(data);
}

export async function pickAndUploadOrderPaymentProof(
  orderId: string,
): Promise<PaymentProofUploadResult> {
  const pickerResult =
    await DocumentPicker.getDocumentAsync({
      type: [...PRIVATE_UPLOAD_MIME_TYPES],
      copyToCacheDirectory: true,
      multiple: false,
    });

  if (pickerResult.canceled) {
    return {
      status: 'cancelled',
      proof: null,
      fileName: null,
    };
  }

  const asset = pickerResult.assets[0];

  if (!asset?.uri) {
    throw new Error(
      'تعذر قراءة الملف المختار.',
    );
  }

  const mimeType =
    getValidatedUploadMimeType(
      asset.mimeType,
    );

  const file = new File(asset.uri);
  const fileSize =
    asset.size ?? file.size;

  assertValidatedUploadSize(
    fileSize,
  );

  const preparation =
    await prepareOrderPaymentProof(orderId);

  if (!preparation.required) {
    throw new Error(
      'هذا الطلب لا يحتاج إلى رفع إثبات دفع.',
    );
  }

  const proof = preparation.proof;

  if (proof.status === 'submitted') {
    throw new Error(
      'إثبات الدفع مرفوع بالفعل وقيد المراجعة.',
    );
  }

  if (proof.status !== 'draft') {
    throw new Error(
      'تعذر تجهيز مساحة آمنة لرفع إثبات الدفع.',
    );
  }

  await supabase.storage
    .from(proof.bucket)
    .remove([proof.path])
    .catch(() => undefined);

  const fileBuffer =
    await file.arrayBuffer();

  assertValidatedUploadContent(
    mimeType,
    fileBuffer,
  );

  const { error: uploadError } =
    await supabase.storage
      .from(proof.bucket)
      .upload(
        proof.path,
        fileBuffer,
        {
          contentType: mimeType,
          upsert: false,
        },
      );

  if (uploadError) {
    throw new Error(
      `تعذر رفع إثبات الدفع: ${uploadError.message}`,
    );
  }

  const submitted =
    await submitOrderPaymentProof(
      proof.id,
    );

  return {
    status: 'submitted',
    proof: submitted,
    fileName:
      asset.name?.trim() ||
      'إثبات الدفع',
  };
}
