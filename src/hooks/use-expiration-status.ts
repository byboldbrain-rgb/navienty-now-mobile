import {
  useEffect,
  useState,
} from 'react';

const MAX_TIMEOUT_MS =
  2_147_000_000;

type ExpirationValue =
  | number
  | string
  | null
  | undefined;

function normalizeExpirationTime(
  expiresAt: ExpirationValue,
): number | null {
  if (
    typeof expiresAt === 'number' &&
    Number.isFinite(expiresAt)
  ) {
    return expiresAt;
  }

  if (
    typeof expiresAt === 'string' &&
    expiresAt.trim()
  ) {
    const parsed =
      Date.parse(expiresAt);

    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}

/**
 * Tracks whether a timestamp has expired without reading Date.now()
 * during render.
 *
 * A timer wakes exactly when the expiration becomes due. Long
 * expirations are rescheduled safely so they do not overflow the
 * JavaScript setTimeout limit.
 */
export function useExpirationStatus(
  expiresAt: ExpirationValue,
): boolean {
  const expirationTime =
    normalizeExpirationTime(
      expiresAt,
    );

  const [
    expiredExpirationTime,
    setExpiredExpirationTime,
  ] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (expirationTime === null) {
      return;
    }

    let cancelled = false;

    let timeoutId:
      | ReturnType<typeof setTimeout>
      | null = null;

    const scheduleCheck = () => {
      if (cancelled) {
        return;
      }

      const remainingMs =
        expirationTime -
        Date.now();

      if (remainingMs <= 0) {
        setExpiredExpirationTime(
          expirationTime,
        );

        return;
      }

      timeoutId = setTimeout(
        scheduleCheck,
        Math.min(
          remainingMs,
          MAX_TIMEOUT_MS,
        ),
      );
    };

    /*
     * Run the first time check outside render and outside the
     * synchronous effect body.
     */
    timeoutId = setTimeout(
      scheduleCheck,
      0,
    );

    return () => {
      cancelled = true;

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [expirationTime]);

  return (
    expirationTime !== null &&
    expiredExpirationTime ===
      expirationTime
  );
}

export default useExpirationStatus;
