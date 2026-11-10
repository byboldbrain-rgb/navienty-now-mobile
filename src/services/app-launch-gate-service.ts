import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  compareVersions,
  isVersionBelowMinimum,
  isBuildBelowMinimum,
} from '../domain/app-version';
import getAppLaunchSettings, {
  type AppLaunchSettings,
} from './app-launch-settings-service';

export {
  compareVersions,
  isVersionBelowMinimum,
  isBuildBelowMinimum,
} from '../domain/app-version';

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
  currentBuild?: string | null;
  minimumBuild?: number | null;
  supportWhatsapp: string | null;
};

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
  settings: AppLaunchSettings,
): string | null {
  if (Platform.OS === 'ios') {
    return normalizeNullableUrl(
      settings.ios_store_url ??
        settings.app_store_url ??
        'https://apps.apple.com/app/id6804870140',
    );
  }

  if (Platform.OS === 'android') {
    return normalizeNullableUrl(
      settings.android_store_url ??
        settings.play_store_url ??
        'https://play.google.com/store/apps/details?id=com.navienty.now',
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

/**
 * The bundled build code does not change when OTA JavaScript updates.
 * This also distinguishes store builds with identical marketing versions.
 */
export function getCurrentAppBuild(): string | null {
  const build = Platform.OS === 'ios'
    ? Constants.platform?.ios?.buildNumber
    : Platform.OS === 'android'
      ? Constants.platform?.android?.versionCode
      : null;

  return build === null || build === undefined ? null : String(build);
}

export async function getAppLaunchGate():
  Promise<AppLaunchGateResult> {
  try {
    const settings =
      await getAppLaunchSettings();

    const currentVersion =
      getCurrentAppVersion();

    const platformMinimumVersion =
      Platform.OS === 'ios'
        ? settings.minimum_supported_ios_version
        : Platform.OS === 'android'
          ? settings.minimum_supported_android_version
          : null;

    const minimumVersion =
      platformMinimumVersion?.trim() ||
      settings.minimum_supported_app_version?.trim() ||
      null;

    const minimumBuild =
      Platform.OS === 'ios'
        ? settings.minimum_supported_ios_build
        : Platform.OS === 'android'
          ? settings.minimum_supported_android_build
          : null;

    const currentBuild = getCurrentAppBuild();

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
      isVersionBelowMinimum(currentVersion, minimumVersion) ||
      isBuildBelowMinimum(currentBuild, minimumBuild)
    ) {
      return {
        status: 'force-update',
        currentVersion,
        minimumVersion,
        currentBuild,
        minimumBuild,
        messageAr:
          'نزلنا تحديث جديد لـ Navienty Now. لازم تحدّث التطبيق عشان تقدر تكمل استخدامه.',
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
