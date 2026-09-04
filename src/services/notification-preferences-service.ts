import { supabase } from '../lib/supabase';
import {
    ensureAppSession,
} from './anonymous-auth-service';

export type NotificationPreferences = {
  userId: string;
  orderUpdatesEnabled: boolean;
  serviceUpdatesEnabled: boolean;
  accountUpdatesEnabled: boolean;
  offersEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
  marketingConsentAt: string | null;
  marketingOptedOutAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpdateNotificationPreferencesInput = {
  orderUpdatesEnabled?: boolean;
  serviceUpdatesEnabled?: boolean;
  accountUpdatesEnabled?: boolean;
  offersEnabled?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  timezone?: string;
};

type NotificationPreferencesRow = {
  user_id: string;
  order_updates_enabled: boolean;
  service_updates_enabled: boolean;
  account_updates_enabled: boolean;
  offers_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
  marketing_consent_at: string | null;
  marketing_opted_out_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapPreferences(
  row: NotificationPreferencesRow,
): NotificationPreferences {
  return {
    userId: row.user_id,
    orderUpdatesEnabled:
      row.order_updates_enabled,
    serviceUpdatesEnabled:
      row.service_updates_enabled,
    accountUpdatesEnabled:
      row.account_updates_enabled,
    offersEnabled:
      row.offers_enabled,
    quietHoursEnabled:
      row.quiet_hours_enabled,
    quietHoursStart:
      row.quiet_hours_start,
    quietHoursEnd:
      row.quiet_hours_end,
    timezone:
      row.timezone,
    marketingConsentAt:
      row.marketing_consent_at,
    marketingOptedOutAt:
      row.marketing_opted_out_at,
    createdAt:
      row.created_at,
    updatedAt:
      row.updated_at,
  };
}

function getFirstRow(
  data: unknown,
): NotificationPreferencesRow | null {
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const row = data[0];

  if (
    !row ||
    typeof row !== 'object'
  ) {
    return null;
  }

  return row as NotificationPreferencesRow;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  await ensureAppSession();

  const {
    data,
    error,
  } = await supabase.rpc(
    'get_my_notification_preferences',
  );

  if (error) {
    throw new Error(
      `تعذر تحميل إعدادات الإشعارات: ${error.message}`,
    );
  }

  const row = getFirstRow(data);

  if (!row) {
    throw new Error(
      'لم ترجع قاعدة البيانات إعدادات الإشعارات.',
    );
  }

  return mapPreferences(row);
}

export async function updateNotificationPreferences(
  input: UpdateNotificationPreferencesInput,
): Promise<NotificationPreferences> {
  await ensureAppSession();

  const {
    data,
    error,
  } = await supabase.rpc(
    'update_my_notification_preferences',
    {
      p_order_updates_enabled:
        input.orderUpdatesEnabled ?? null,
      p_service_updates_enabled:
        input.serviceUpdatesEnabled ?? null,
      p_account_updates_enabled:
        input.accountUpdatesEnabled ?? null,
      p_offers_enabled:
        input.offersEnabled ?? null,
      p_quiet_hours_enabled:
        input.quietHoursEnabled ?? null,
      p_quiet_hours_start:
        input.quietHoursStart ?? null,
      p_quiet_hours_end:
        input.quietHoursEnd ?? null,
      p_timezone:
        input.timezone ?? null,
    },
  );

  if (error) {
    throw new Error(
      `تعذر حفظ إعدادات الإشعارات: ${error.message}`,
    );
  }

  const row = getFirstRow(data);

  if (!row) {
    throw new Error(
      'لم ترجع قاعدة البيانات إعدادات الإشعارات المحدثة.',
    );
  }

  return mapPreferences(row);
}
