import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { recordStartupTimingOnce } from '../services/startup-performance-service';

const CHUNK_SIZE = 1500;
const STORAGE_VERSION = 1;
const STORAGE_PREFIX = 'navienty.auth';

const SECURE_STORE_OPTIONS:
  SecureStore.SecureStoreOptions = {
    keychainAccessible:
      SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };

type SecureMetadata = {
  version: number;
  generation: string;
  count: number;
};

type StartupSecureStorageKind =
  | 'supabase-auth'
  | 'customer'
  | 'orders';

function getStartupSecureStorageKind(
  key: string,
): StartupSecureStorageKind | null {
  if (key === 'navienty-now-customer') {
    return 'customer';
  }

  if (key === 'navienty-now-orders') {
    return 'orders';
  }

  if (
    key.startsWith('sb-') &&
    key.endsWith('-auth-token')
  ) {
    return 'supabase-auth';
  }

  return null;
}

function encodeStorageKey(
  key: string,
): string {
  return Array.from(key)
    .map((character) =>
      character
        .codePointAt(0)!
        .toString(16)
        .padStart(4, '0'),
    )
    .join('');
}

function getBaseKey(
  key: string,
): string {
  return `${STORAGE_PREFIX}.${encodeStorageKey(
    key,
  )}`;
}

function getMetadataKey(
  key: string,
): string {
  return `${getBaseKey(key)}.meta`;
}

function getChunkKey(
  key: string,
  generation: string,
  index: number,
): string {
  return `${getBaseKey(
    key,
  )}.${generation}.${index}`;
}

function createGeneration(): string {
  return `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function splitValue(
  value: string,
): string[] {
  if (!value) {
    return [''];
  }

  const chunks: string[] = [];

  for (
    let offset = 0;
    offset < value.length;
    offset += CHUNK_SIZE
  ) {
    chunks.push(
      value.slice(
        offset,
        offset + CHUNK_SIZE,
      ),
    );
  }

  return chunks;
}

function parseMetadata(
  value: string | null,
): SecureMetadata | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      value,
    ) as Partial<SecureMetadata>;

    if (
      parsed.version !==
        STORAGE_VERSION ||
      typeof parsed.generation !==
        'string' ||
      !parsed.generation ||
      !Number.isInteger(
        parsed.count,
      ) ||
      (parsed.count ?? 0) < 1 ||
      (parsed.count ?? 0) > 256
    ) {
      return null;
    }

    return {
      version: STORAGE_VERSION,
      generation:
        parsed.generation,
      count: parsed.count!,
    };
  } catch {
    return null;
  }
}

async function readMetadata(
  key: string,
): Promise<SecureMetadata | null> {
  const rawMetadata =
    await SecureStore.getItemAsync(
      getMetadataKey(key),
      SECURE_STORE_OPTIONS,
    );

  return parseMetadata(
    rawMetadata,
  );
}

async function deleteGeneration(
  key: string,
  metadata: SecureMetadata | null,
): Promise<void> {
  if (!metadata) {
    return;
  }

  await Promise.all(
    Array.from(
      {
        length:
          metadata.count,
      },
      (_unused, index) =>
        SecureStore.deleteItemAsync(
          getChunkKey(
            key,
            metadata.generation,
            index,
          ),
          SECURE_STORE_OPTIONS,
        ).catch(() => undefined),
    ),
  );
}

async function readSecureValue(
  key: string,
  metadata: SecureMetadata,
): Promise<string> {
  const chunks =
    await Promise.all(
      Array.from(
        {
          length:
            metadata.count,
        },
        (_unused, index) =>
          SecureStore.getItemAsync(
            getChunkKey(
              key,
              metadata.generation,
              index,
            ),
            SECURE_STORE_OPTIONS,
          ),
      ),
    );

  if (
    chunks.some(
      (chunk) => chunk === null,
    )
  ) {
    throw new Error(
      'Secure auth storage is incomplete.',
    );
  }

  return chunks.join('');
}

/**
 * Supabase sessions can be larger than the payload size accepted by some
 * native secure-storage implementations. Store the session exclusively in
 * encrypted SecureStore chunks, with metadata committed last so an
 * interrupted write never replaces the previous valid generation.
 *
 * Existing installs are migrated lazily from AsyncStorage the first time
 * Supabase asks for its auth storage key. The plaintext copy is deleted only
 * after the secure write has completed successfully.
 */
export const secureAuthStorage = {
  async getItem(
    key: string,
  ): Promise<string | null> {
    const startupKind =
      getStartupSecureStorageKind(key);
    const startedAt = Date.now();
    let chunkCount = 0;
    let outcome:
      | 'success'
      | 'error' =
      'success';
    let source:
      | 'empty'
      | 'secure'
      | 'legacy-migration' =
      'empty';

    try {
      const metadata =
        await readMetadata(key);

      if (metadata) {
        source = 'secure';
        chunkCount = metadata.count;

        return await readSecureValue(
          key,
          metadata,
        );
      }

      const legacyValue =
        await AsyncStorage.getItem(
          key,
        );

      if (legacyValue === null) {
        return null;
      }

      source = 'legacy-migration';
      chunkCount = splitValue(
        legacyValue,
      ).length;

      await secureAuthStorage.setItem(
        key,
        legacyValue,
      );

      return legacyValue;
    } catch (error) {
      outcome = 'error';
      throw error;
    } finally {
      if (startupKind) {
        recordStartupTimingOnce(
          `secure-storage-${startupKind}`,
          Date.now() - startedAt,
          {
            chunkCount,
            outcome,
            source,
          },
        );
      }
    }
  },

  async setItem(
    key: string,
    value: string,
  ): Promise<void> {
    const isAvailable =
      await SecureStore.isAvailableAsync();

    if (!isAvailable) {
      throw new Error(
        'SecureStore is unavailable on this device.',
      );
    }

    const previousMetadata =
      await readMetadata(key);

    const generation =
      createGeneration();

    const chunks =
      splitValue(value);

    const nextMetadata:
      SecureMetadata = {
        version: STORAGE_VERSION,
        generation,
        count: chunks.length,
      };

    try {
      await Promise.all(
        chunks.map(
          (chunk, index) =>
            SecureStore.setItemAsync(
              getChunkKey(
                key,
                generation,
                index,
              ),
              chunk,
              SECURE_STORE_OPTIONS,
            ),
        ),
      );

      await SecureStore.setItemAsync(
        getMetadataKey(key),
        JSON.stringify(
          nextMetadata,
        ),
        SECURE_STORE_OPTIONS,
      );
    } catch (error) {
      await deleteGeneration(
        key,
        nextMetadata,
      );

      throw error;
    }

    /**
     * The new generation is now authoritative. Cleanup is best-effort and
     * must never invalidate the newly-written session.
     */
    await deleteGeneration(
      key,
      previousMetadata,
    );

    await AsyncStorage.removeItem(
      key,
    ).catch(() => undefined);
  },

  async removeItem(
    key: string,
  ): Promise<void> {
    const metadata =
      await readMetadata(key);

    await SecureStore.deleteItemAsync(
      getMetadataKey(key),
      SECURE_STORE_OPTIONS,
    ).catch(() => undefined);

    await deleteGeneration(
      key,
      metadata,
    );

    await AsyncStorage.removeItem(
      key,
    );
  },
};
