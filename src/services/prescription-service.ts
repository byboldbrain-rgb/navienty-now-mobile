import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { supabase } from '../lib/supabase';
import {
  ensureAppSession,
} from './anonymous-auth-service';

const MAX_PRESCRIPTION_FILE_SIZE =
  8 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type PrescriptionSubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type PrescriptionSubmission = {
  id: string;
  storeId: string;
  orderId: string | null;
  status: PrescriptionSubmissionStatus;
  bucket: string;
  path: string;
  reviewNote: string | null;
  createdAt: string;
  submittedAt: string | null;
  attachedAt: string | null;
  reviewedAt: string | null;
};

type RawPrescriptionSubmission = {
  id?: unknown;
  store_id?: unknown;
  order_id?: unknown;
  status?: unknown;
  bucket?: unknown;
  path?: unknown;
  review_note?: unknown;
  created_at?: unknown;
  submitted_at?: unknown;
  attached_at?: unknown;
  reviewed_at?: unknown;
};

export type PrescriptionUploadResult =
  | {
      status: 'cancelled';
      submission: null;
      fileName: null;
    }
  | {
      status: 'submitted';
      submission: PrescriptionSubmission;
      fileName: string;
    };

function nullableString(
  value: unknown,
): string | null {
  return typeof value === 'string'
    ? value
    : null;
}

function mapPrescriptionSubmission(
  value: unknown,
): PrescriptionSubmission {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    throw new Error(
      'استجابة الروشتة من Supabase غير صالحة.',
    );
  }

  const row =
    value as RawPrescriptionSubmission;

  const id = nullableString(row.id);
  const storeId = nullableString(
    row.store_id,
  );
  const status = nullableString(
    row.status,
  );
  const bucket = nullableString(
    row.bucket,
  );
  const path = nullableString(
    row.path,
  );
  const createdAt = nullableString(
    row.created_at,
  );

  if (
    !id ||
    !storeId ||
    !bucket ||
    !path ||
    !createdAt ||
    !status ||
    ![
      'draft',
      'submitted',
      'approved',
      'rejected',
      'cancelled',
    ].includes(status)
  ) {
    throw new Error(
      'بيانات الروشتة من Supabase غير مكتملة.',
    );
  }

  return {
    id,
    storeId,
    orderId:
      nullableString(row.order_id),
    status:
      status as PrescriptionSubmissionStatus,
    bucket,
    path,
    reviewNote:
      nullableString(row.review_note),
    createdAt,
    submittedAt:
      nullableString(row.submitted_at),
    attachedAt:
      nullableString(row.attached_at),
    reviewedAt:
      nullableString(row.reviewed_at),
  };
}

function getPrescriptionErrorMessage(
  error: unknown,
): string {
  const fallback =
    'تعذر تجهيز الروشتة. حاول مرة أخرى.';

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
      'pharmacy_store_required',
      'رفع الروشتة متاح لطلبات الصيدلية فقط.',
    ],
    [
      'prescription_submission_not_found',
      'تعذر العثور على الروشتة الحالية.',
    ],
    [
      'prescription_submission_not_editable',
      'هذه الروشتة لم تعد قابلة للتعديل.',
    ],
    [
      'prescription_file_not_uploaded',
      'لم يكتمل رفع ملف الروشتة.',
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

export async function createPrescriptionSubmission(
  storeId: string,
): Promise<PrescriptionSubmission> {
  await ensureAppSession();

  const { data, error } =
    await supabase.rpc(
      'create_prescription_submission',
      {
        p_store_id: storeId,
      },
    );

  if (error) {
    throw new Error(
      getPrescriptionErrorMessage(error),
    );
  }

  return mapPrescriptionSubmission(
    data,
  );
}

export async function submitPrescriptionSubmission(
  submissionId: string,
): Promise<PrescriptionSubmission> {
  const { data, error } =
    await supabase.rpc(
      'submit_prescription_submission',
      {
        p_submission_id:
          submissionId,
      },
    );

  if (error) {
    throw new Error(
      getPrescriptionErrorMessage(error),
    );
  }

  return mapPrescriptionSubmission(
    data,
  );
}

export async function getMyPrescriptionSubmission(
  submissionId: string,
): Promise<PrescriptionSubmission | null> {
  const { data, error } =
    await supabase.rpc(
      'get_my_prescription_submission',
      {
        p_submission_id:
          submissionId,
      },
    );

  if (error) {
    throw new Error(
      getPrescriptionErrorMessage(error),
    );
  }

  return data == null
    ? null
    : mapPrescriptionSubmission(
        data,
      );
}

export async function getMyOpenPrescriptionSubmission(
  storeId: string,
): Promise<PrescriptionSubmission | null> {
  await ensureAppSession();

  const { data, error } =
    await supabase.rpc(
      'get_my_open_prescription_submission',
      {
        p_store_id: storeId,
      },
    );

  if (error) {
    throw new Error(
      getPrescriptionErrorMessage(error),
    );
  }

  return data == null
    ? null
    : mapPrescriptionSubmission(
        data,
      );
}

export async function attachPrescriptionToOrder(
  orderId: string,
  submissionId: string,
): Promise<void> {
  const { error } =
    await supabase.rpc(
      'attach_prescription_to_order',
      {
        p_order_id: orderId,
        p_submission_id:
          submissionId,
      },
    );

  if (error) {
    throw new Error(
      getPrescriptionErrorMessage(error),
    );
  }
}

export async function cancelMyPrescriptionSubmission(
  submissionId: string,
): Promise<boolean> {
  const { data, error } =
    await supabase.rpc(
      'cancel_my_prescription_submission',
      {
        p_submission_id:
          submissionId,
      },
    );

  if (error) {
    throw new Error(
      getPrescriptionErrorMessage(error),
    );
  }

  return data === true;
}

async function replaceSubmittedDraft(
  submission: PrescriptionSubmission,
): Promise<PrescriptionSubmission> {
  if (
    submission.status !== 'submitted'
  ) {
    return submission;
  }

  const cancelled =
    await cancelMyPrescriptionSubmission(
      submission.id,
    );

  if (!cancelled) {
    throw new Error(
      'تعذر استبدال الروشتة الحالية.',
    );
  }

  /**
   * Once the row is cancelled, the Storage DELETE policy permits removing
   * the unattached private object. Failure here is non-fatal because the new
   * submission receives a different path.
   */
  await supabase.storage
    .from(submission.bucket)
    .remove([submission.path])
    .catch(() => undefined);

  return createPrescriptionSubmission(
    submission.storeId,
  );
}

export async function pickAndUploadPrescription(
  storeId: string,
): Promise<PrescriptionUploadResult> {
  const pickerResult =
    await DocumentPicker.getDocumentAsync({
      type: [...ALLOWED_MIME_TYPES],
      copyToCacheDirectory: true,
      multiple: false,
    });

  if (pickerResult.canceled) {
    return {
      status: 'cancelled',
      submission: null,
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
    asset.mimeType?.trim()
      .toLowerCase() ?? '';

  if (
    !ALLOWED_MIME_TYPES.includes(
      mimeType as
        (typeof ALLOWED_MIME_TYPES)[number],
    )
  ) {
    throw new Error(
      'اختر صورة للروشتة أو ملف PDF فقط.',
    );
  }

  const file = new File(asset.uri);
  const fileSize =
    asset.size ?? file.size;

  if (
    typeof fileSize === 'number' &&
    fileSize >
      MAX_PRESCRIPTION_FILE_SIZE
  ) {
    throw new Error(
      'حجم الروشتة أكبر من 8 ميجابايت.',
    );
  }

  await ensureAppSession();

  let submission =
    await createPrescriptionSubmission(
      storeId,
    );

  submission =
    await replaceSubmittedDraft(
      submission,
    );

  if (submission.status !== 'draft') {
    throw new Error(
      'تعذر تجهيز مساحة آمنة لرفع الروشتة.',
    );
  }

  /**
   * A previous interrupted upload can leave an object while the submission
   * row is still draft. Delete it before the retry so upload can stay
   * `upsert: false` and never overwrite a reviewed/attached prescription.
   */
  await supabase.storage
    .from(submission.bucket)
    .remove([submission.path])
    .catch(() => undefined);

  const fileBuffer =
    await file.arrayBuffer();

  const { error: uploadError } =
    await supabase.storage
      .from(submission.bucket)
      .upload(
        submission.path,
        fileBuffer,
        {
          contentType: mimeType,
          upsert: false,
        },
      );

  if (uploadError) {
    throw new Error(
      `تعذر رفع الروشتة: ${uploadError.message}`,
    );
  }

  const submitted =
    await submitPrescriptionSubmission(
      submission.id,
    );

  return {
    status: 'submitted',
    submission: submitted,
    fileName:
      asset.name?.trim() ||
      'روشتة',
  };
}
