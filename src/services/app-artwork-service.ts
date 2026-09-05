import getAppBootstrap, {
  getCachedAppBootstrap,
  type AppArtworkMap,
} from './bootstrap-service';

export type AppArtworkResolution = {
  resolved: boolean;
  remoteUrl: string | null;
};

function normalizeRemoteArtworkUrl(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim() ?? '';

  return /^https?:\/\//i.test(normalized)
    ? normalized
    : null;
}

export function getAppArtworkUrl(
  artwork: AppArtworkMap | null | undefined,
  artworkKey: string,
): string | null {
  const normalizedKey = artworkKey.trim();

  if (!normalizedKey || !artwork) {
    return null;
  }

  return normalizeRemoteArtworkUrl(
    artwork[normalizedKey],
  );
}

export function getCachedAppArtworkResolution(
  artworkKey: string,
): AppArtworkResolution {
  const bootstrap = getCachedAppBootstrap();

  if (!bootstrap) {
    return {
      resolved: false,
      remoteUrl: null,
    };
  }

  return {
    resolved: true,
    remoteUrl: getAppArtworkUrl(
      bootstrap.settings.artwork,
      artworkKey,
    ),
  };
}

export async function resolveAppArtworkUrl(
  artworkKey: string,
): Promise<string | null> {
  const bootstrap = await getAppBootstrap();

  return getAppArtworkUrl(
    bootstrap.settings.artwork,
    artworkKey,
  );
}
