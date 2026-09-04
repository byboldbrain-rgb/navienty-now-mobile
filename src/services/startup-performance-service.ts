type StartupTimingDetails = Record<
  string,
  boolean | number | string | null
>;

const STARTUP_DIAGNOSTICS_ENABLED =
  __DEV__ ||
  process.env.EXPO_PUBLIC_STARTUP_DIAGNOSTICS ===
    '1';

const startupDiagnosticsOriginMs = Date.now();
const recordedTimingNames = new Set<string>();

export function isStartupDiagnosticsEnabled():
  boolean {
  return STARTUP_DIAGNOSTICS_ENABLED;
}

/**
 * Emits one structured timing per startup stage.
 *
 * Development builds log automatically. Production builds remain silent
 * unless EXPO_PUBLIC_STARTUP_DIAGNOSTICS=1 is explicitly enabled for a
 * diagnostic build. Details must never contain customer data, tokens, raw
 * storage keys, or other PII.
 */
export function recordStartupTimingOnce(
  name: string,
  durationMs: number,
  details: StartupTimingDetails = {},
): void {
  if (
    !STARTUP_DIAGNOSTICS_ENABLED ||
    recordedTimingNames.has(name)
  ) {
    return;
  }

  recordedTimingNames.add(name);

  console.info('[Navienty][Startup Timing]', {
    name,
    durationMs: Math.max(
      0,
      Math.round(durationMs),
    ),
    elapsedSinceDiagnosticsStartMs:
      Math.max(
        0,
        Date.now() -
          startupDiagnosticsOriginMs,
      ),
    ...details,
  });
}
