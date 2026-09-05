import AsyncStorage from '@react-native-async-storage/async-storage';

const WRITE_RETRY_DELAY_MS = 30_000;

const reportedFailures = new Set<string>();
let asyncStorageWriteBlockedUntil = 0;

type StorageOperation =
  | 'read'
  | 'write'
  | 'delete';

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

/**
 * Storage failures are expected to be recoverable at runtime (for example,
 * when the device is completely out of disk space). Log each operation/key
 * only once so development diagnostics stay useful without flooding the
 * console or error-reporting pipeline.
 */
export function reportStorageFailure(
  scope: string,
  operation: StorageOperation,
  key: string,
  error: unknown,
): void {
  const fingerprint =
    `${scope}:${operation}:${key}`;

  if (
    reportedFailures.has(
      fingerprint,
    )
  ) {
    return;
  }

  reportedFailures.add(
    fingerprint,
  );

  console.warn(
    `[Navienty][Storage] ${scope} ${operation} failed. Continuing without persisted storage for this operation.`,
    getErrorMessage(error),
  );
}

/**
 * AsyncStorage adapter for Zustand and other non-sensitive local state.
 *
 * A failed disk write must never reject into business logic. The in-memory
 * Zustand state remains authoritative for the current app process, while
 * persistence is retried later after a short cool-down. This is especially
 * important after a server-side order has already been created successfully.
 */
export const resilientAsyncStorage = {
  async getItem(
    key: string,
  ): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(
        key,
      );
    } catch (error) {
      reportStorageFailure(
        'async-storage',
        'read',
        key,
        error,
      );

      return null;
    }
  },

  async setItem(
    key: string,
    value: string,
  ): Promise<void> {
    if (
      Date.now() <
      asyncStorageWriteBlockedUntil
    ) {
      return;
    }

    try {
      await AsyncStorage.setItem(
        key,
        value,
      );

      asyncStorageWriteBlockedUntil = 0;
    } catch (error) {
      asyncStorageWriteBlockedUntil =
        Date.now() +
        WRITE_RETRY_DELAY_MS;

      reportStorageFailure(
        'async-storage',
        'write',
        key,
        error,
      );
    }
  },

  async removeItem(
    key: string,
  ): Promise<void> {
    try {
      await AsyncStorage.removeItem(
        key,
      );
    } catch (error) {
      reportStorageFailure(
        'async-storage',
        'delete',
        key,
        error,
      );
    }
  },
};
