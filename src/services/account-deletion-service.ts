import { supabase } from '../lib/supabase';

export type AccountDeletionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'cancelled';

export type AccountDeletionRequest = {
  id: string;
  status: AccountDeletionStatus;
  isAnonymous: boolean;
  requestedAt: string;
  targetCompletionAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
};

type RawAccountDeletionRequest = {
  id?: unknown;
  status?: unknown;
  is_anonymous?: unknown;
  requested_at?: unknown;
  target_completion_at?: unknown;
  completed_at?: unknown;
  cancelled_at?: unknown;
};

function nullableString(
  value: unknown,
): string | null {
  return typeof value === 'string'
    ? value
    : null;
}

function mapAccountDeletionRequest(
  value: unknown,
): AccountDeletionRequest {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    throw new Error(
      'استجابة طلب حذف الحساب غير صالحة.',
    );
  }

  const row =
    value as RawAccountDeletionRequest;

  const id = nullableString(row.id);
  const status = nullableString(
    row.status,
  );
  const requestedAt = nullableString(
    row.requested_at,
  );
  const targetCompletionAt =
    nullableString(
      row.target_completion_at,
    );

  if (
    !id ||
    !requestedAt ||
    !targetCompletionAt ||
    !status ||
    ![
      'pending',
      'processing',
      'completed',
      'cancelled',
    ].includes(status)
  ) {
    throw new Error(
      'استجابة طلب حذف الحساب غير مكتملة.',
    );
  }

  return {
    id,
    status:
      status as AccountDeletionStatus,
    isAnonymous:
      row.is_anonymous === true,
    requestedAt,
    targetCompletionAt,
    completedAt:
      nullableString(row.completed_at),
    cancelledAt:
      nullableString(row.cancelled_at),
  };
}

function getRpcErrorMessage(
  error: unknown,
): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    if (
      error.message.includes(
        'authentication_required',
      )
    ) {
      return 'تعذر تحديد حساب الجهاز. أغلق التطبيق وافتحه مرة أخرى ثم حاول مجددًا.';
    }

    return error.message;
  }

  return 'تعذر تنفيذ طلب حذف الحساب.';
}

export async function requestAccountDeletion():
  Promise<AccountDeletionRequest> {
  const { data, error } =
    await supabase.rpc(
      'request_account_deletion',
    );

  if (error) {
    throw new Error(
      getRpcErrorMessage(error),
    );
  }

  return mapAccountDeletionRequest(
    data,
  );
}

export async function getMyAccountDeletionRequest():
  Promise<AccountDeletionRequest | null> {
  const { data, error } =
    await supabase.rpc(
      'get_my_account_deletion_request',
    );

  if (error) {
    throw new Error(
      getRpcErrorMessage(error),
    );
  }

  if (data == null) {
    return null;
  }

  return mapAccountDeletionRequest(
    data,
  );
}

export async function cancelMyAccountDeletionRequest():
  Promise<boolean> {
  const { data, error } =
    await supabase.rpc(
      'cancel_my_account_deletion_request',
    );

  if (error) {
    throw new Error(
      getRpcErrorMessage(error),
    );
  }

  return data === true;
}
