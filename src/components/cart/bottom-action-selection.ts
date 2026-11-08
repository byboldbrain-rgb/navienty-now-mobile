/**
 * Pure arbitration rules used by the root bottom action host.
 * Newest registration wins ties; a hidden/navigation screen can never
 * display controls registered by a previously mounted screen.
 */
export type BottomActionCandidate = {
  pathname: string;
  priority: number;
};

export function normalizeBottomActionPath(pathname: string | null): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

export function selectActiveBottomAction<T extends BottomActionCandidate>(
  entries: readonly T[],
  pathname: string | null,
): T | null {
  const currentPath = normalizeBottomActionPath(pathname);
  let winner: T | null = null;

  for (const entry of entries) {
    if (entry.pathname !== currentPath) continue;
    // Replacements retain their original position. A newer mount at the
    // same priority intentionally wins over an older still-mounted screen.
    if (!winner || entry.priority >= winner.priority) {
      winner = entry;
    }
  }

  return winner;
}
