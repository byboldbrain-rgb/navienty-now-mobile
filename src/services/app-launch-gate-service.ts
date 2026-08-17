import Constants from 'expo-constants';
import { Platform } from 'react-native';

import getAppBootstrap, {
  type AppSettings,
} from './bootstrap-service';

export type AppLaunchGateStatus =
  | 'allowed'
  | 'maintenance'
  | 'force-update'
  | 'error';

export type AppLaunchGateResult = {
  status: AppLaunchGateStatus;
  currentVersion: string | null;
  minimumVersion: string | null;
  messageAr: string | null;
  updateUrl: string | null;
  supportWhatsapp: string | null;
};

function normalizeVersion(
  value: string | null | undefined,
): number[] | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/^v/i, '')
    .split(/[+-]/)[0];

  if (!normalized) {
    return null;
  }

  const parts = normalized.split('.');

  if (
    parts.length === 0 ||
    parts.some((part) => !/^\d+$/.test(part))
  ) {
    return null;
  }

  return parts.map((part) => Number(part));
}

export function compareVersions(
  left: string,
  right: string,
): number | null {
  const leftParts = normalizeVersion(left);
  const rightParts = normalizeVersion(right);

  if (!leftParts || !rightParts) {
    return null;
  }

  const length = Math.max(
    leftParts.length,
    rightParts.length,
  );

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue < rightValue) {
      return -1;
    }

    if (leftValue > rightValue) {
      return 1;
    }
  }

  return 0;
}

export function isVersionBelowMinimum(
  currentVersion: string | null | undefined,
  minimumVersion: string | null | undefined,
): boolean {
  if (!currentVersion || !minimumVersion) {
    return false;
  }

  const comparison = compareVersions(
    currentVersion,
    minimumVersion,
  );

  return comparison === -1;
}

function normalizeNullableUrl(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  if (
    !normalized.startsWith('https://') &&
    !normalized.startsWith('http://') &&
    !normalized.startsWith('market://') &&
    !normalized.startsWith('itms-apps://')
  ) {
    return null;
  }

  return normalized;
}

function getUpdateUrl(
  settings: AppSettings,
): string | null {
  if (Platform.OS === 'ios') {
    return normalizeNullableUrl(
      settings.ios_store_url ??
        settings.app_store_url,
    );
  }

  if (Platform.OS === 'android') {
    return normalizeNullableUrl(
      settings.android_store_url ??
        settings.play_store_url,
    );
  }

  return normalizeNullableUrl(
    settings.update_url,
  );
}

export function getCurrentAppVersion(): string | null {
  const version =
    Constants.expoConfig?.version ?? null;

  if (
    typeof version !== 'string' ||
    !version.trim()
  ) {
    return null;
  }

  return version.trim();
}

export async function getAppLaunchGate():
  Promise<AppLaunchGateResult> {
  try {
    const bootstrap =
      await getAppBootstrap();

    const settings =
      bootstrap.settings;

    const currentVersion =
      getCurrentAppVersion();

    const minimumVersion =
      settings.minimum_supported_app_version
        ?.trim() || null;

    if (settings.maintenance_mode) {
      return {
        status: 'maintenance',
        currentVersion,
        minimumVersion,
        messageAr:
          settings.maintenance_message_ar
            ?.trim() ||
          'نجري بعض التحسينات الآن. سنعود للخدمة قريبًا.',
        updateUrl: null,
        supportWhatsapp:
          settings.support_whatsapp,
      };
    }

    if (
      isVersionBelowMinimum(
        currentVersion,
        minimumVersion,
      )
    ) {
      return {
        status: 'force-update',
        currentVersion,
        minimumVersion,
        messageAr:
          'يوجد إصدار أحدث مطلوب لمواصلة استخدام Navienty Now.',
        updateUrl:
          getUpdateUrl(settings),
        supportWhatsapp:
          settings.support_whatsapp,
      };
    }

    return {
      status: 'allowed',
      currentVersion,
      minimumVersion,
      messageAr: null,
      updateUrl: null,
      supportWhatsapp:
        settings.support_whatsapp,
    };
  } catch (error) {
    console.warn(
      'Unable to evaluate app launch gate:',
      error,
    );

    return {
      status: 'error',
      currentVersion:
        getCurrentAppVersion(),
      minimumVersion: null,
      messageAr:
        'تعذر الاتصال بخدمة Navienty Now. تحقق من الإنترنت وحاول مرة أخرى.',
      updateUrl: null,
      supportWhatsapp: null,
    };
  }
}

export default getAppLaunchGate;
