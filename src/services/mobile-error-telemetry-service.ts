import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '../lib/supabase';

type MobileErrorSource =
  | 'react_error_boundary'
  | 'manual';

type LogMobileErrorInput = {
  source: MobileErrorSource;
  error: unknown;
  componentStack?: string | null;
};

function getErrorName(error: unknown): string | null {
  if (error instanceof Error) {
    return error.name || 'Error';
  }

  return null;
}

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message || null;
  }

  if (typeof error === 'string') {
    return error;
  }

  return null;
}

function getPlatform(): 'android' | 'ios' | 'web' | 'unknown' {
  if (
    Platform.OS === 'android' ||
    Platform.OS === 'ios' ||
    Platform.OS === 'web'
  ) {
    return Platform.OS;
  }

  return 'unknown';
}

export async function logMobileClientError({
  source,
  error,
  componentStack = null,
}: LogMobileErrorInput): Promise<void> {
  try {
    const { error: rpcError } = await supabase
      .schema('now')
      .rpc('log_mobile_client_error', {
        p_source: source,
        p_platform: getPlatform(),
        p_app_version:
          Constants.expoConfig?.version ?? null,
        p_error_name: getErrorName(error),
        p_error_message: getErrorMessage(error),
        p_component_stack: componentStack,
      });

    if (rpcError) {
      console.warn(
        'Unable to persist mobile error telemetry:',
        rpcError.message,
      );
    }
  } catch (telemetryError) {
    // Telemetry must never make an application crash worse.
    console.warn(
      'Unable to send mobile error telemetry:',
      telemetryError,
    );
  }
}

export default logMobileClientError;
