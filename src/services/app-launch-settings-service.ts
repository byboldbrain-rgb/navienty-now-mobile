import { publicSupabase } from '../lib/supabase';
import getAppBootstrap, {
  type AppSettings,
} from './bootstrap-service';

export type AppLaunchSettings = {
  maintenance_mode: boolean;
  maintenance_message_ar: string | null;
  minimum_supported_app_version:
    | string
    | null;
  support_whatsapp: string | null;
  ios_store_url?: string | null;
  app_store_url?: string | null;
  android_store_url?: string | null;
  play_store_url?: string | null;
  update_url?: string | null;
};

type LegacyBootstrapSettings =
  AppSettings & {
    ios_store_url?: string | null;
    app_store_url?: string | null;
    android_store_url?: string | null;
    play_store_url?: string | null;
    update_url?: string | null;
  };

type PostgrestErrorLike = {
  code?: string | null;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readNullableString(
  value: unknown,
  fieldName: string,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(
      `Invalid ${fieldName} in app launch gate settings.`,
    );
  }

  return value;
}

function parseLaunchSettings(
  value: unknown,
): AppLaunchSettings {
  if (!isRecord(value)) {
    throw new Error(
      'Invalid app launch gate settings payload.',
    );
  }

  if (
    typeof value.maintenance_mode !== 'boolean'
  ) {
    throw new Error(
      'Invalid maintenance_mode in app launch gate settings.',
    );
  }

  return {
    maintenance_mode:
      value.maintenance_mode,
    maintenance_message_ar:
      readNullableString(
        value.maintenance_message_ar,
        'maintenance_message_ar',
      ),
    minimum_supported_app_version:
      readNullableString(
        value.minimum_supported_app_version,
        'minimum_supported_app_version',
      ),
    support_whatsapp:
      readNullableString(
        value.support_whatsapp,
        'support_whatsapp',
      ),
    ios_store_url:
      readNullableString(
        value.ios_store_url,
        'ios_store_url',
      ),
    app_store_url:
      readNullableString(
        value.app_store_url,
        'app_store_url',
      ),
    android_store_url:
      readNullableString(
        value.android_store_url,
        'android_store_url',
      ),
    play_store_url:
      readNullableString(
        value.play_store_url,
        'play_store_url',
      ),
    update_url:
      readNullableString(
        value.update_url,
        'update_url',
      ),
  };
}

function isMissingLaunchGateRpc(
  error: PostgrestErrorLike | null,
): boolean {
  return error?.code === 'PGRST202';
}

async function getLightweightLaunchSettings():
  Promise<AppLaunchSettings | null> {
  const { data, error } =
    await publicSupabase.rpc(
      'get_app_launch_gate',
    );

  if (error) {
    if (isMissingLaunchGateRpc(error)) {
      return null;
    }

    throw error;
  }

  return parseLaunchSettings(data);
}

function mapLegacyBootstrapSettings(
  settings: LegacyBootstrapSettings,
): AppLaunchSettings {
  return {
    maintenance_mode:
      settings.maintenance_mode,
    maintenance_message_ar:
      settings.maintenance_message_ar,
    minimum_supported_app_version:
      settings.minimum_supported_app_version,
    support_whatsapp:
      settings.support_whatsapp,
    ios_store_url:
      settings.ios_store_url,
    app_store_url:
      settings.app_store_url,
    android_store_url:
      settings.android_store_url,
    play_store_url:
      settings.play_store_url,
    update_url:
      settings.update_url,
  };
}

/**
 * Reads only the launch-critical settings when the lightweight RPC is
 * available. During the Expand-Migrate-Contract rollout, clients fall back to
 * the existing bootstrap only when PostgREST confirms the new RPC is absent
 * from the schema cache (PGRST202). Real network, permission, and server
 * failures remain visible instead of being hidden behind the legacy path.
 */
export async function getAppLaunchSettings():
  Promise<AppLaunchSettings> {
  const lightweightSettings =
    await getLightweightLaunchSettings();

  if (lightweightSettings) {
    return lightweightSettings;
  }

  const bootstrap =
    await getAppBootstrap();

  return mapLegacyBootstrapSettings(
    bootstrap.settings as LegacyBootstrapSettings,
  );
}

export default getAppLaunchSettings;
