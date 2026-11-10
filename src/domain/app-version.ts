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


/**
 * Build codes matter when two store releases share the same marketing version
 * (for example, both are 1.0.1). Only non-negative integer build codes count.
 */
export function isBuildBelowMinimum(
  currentBuild: string | number | null | undefined,
  minimumBuild: number | null | undefined,
): boolean {
  if (minimumBuild === null || minimumBuild === undefined) {
    return false;
  }

  if (!Number.isSafeInteger(minimumBuild) || minimumBuild < 0) {
    return false;
  }

  const currentValue = typeof currentBuild === 'number'
    ? currentBuild
    : typeof currentBuild === 'string' && /^\d+$/.test(currentBuild.trim())
      ? Number(currentBuild.trim())
      : NaN;

  return Number.isSafeInteger(currentValue) &&
    currentValue >= 0 &&
    currentValue < minimumBuild;
}
