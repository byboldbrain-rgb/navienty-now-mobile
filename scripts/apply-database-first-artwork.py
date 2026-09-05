from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def write(relative_path: str, text: str) -> None:
    path = ROOT / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def replace_once(relative_path: str, old: str, new: str) -> None:
    text = read(relative_path)
    count = text.count(old)

    if count != 1:
        raise RuntimeError(
            f"{relative_path}: expected exactly 1 occurrence, found {count}: {old[:120]!r}"
        )

    write(relative_path, text.replace(old, new, 1))


def regex_sub(
    relative_path: str,
    pattern: str,
    replacement: str,
    expected: int,
) -> None:
    text = read(relative_path)
    next_text, count = re.subn(
        pattern,
        replacement,
        text,
        flags=re.S,
    )

    if count != expected:
        raise RuntimeError(
            f"{relative_path}: expected {expected} regex replacements, found {count}: {pattern!r}"
        )

    write(relative_path, next_text)


# ---------------------------------------------------------------------------
# Shared database-first artwork contract and cache helpers.
# ---------------------------------------------------------------------------
replace_once(
    "src/services/bootstrap-service.ts",
    "export type AppSettings = {\n",
    "export type AppArtworkMap = Record<string, string>;\n\nexport type AppSettings = {\n",
)

replace_once(
    "src/services/bootstrap-service.ts",
    "  app_logo_url: string | null;\n",
    "  app_logo_url: string | null;\n  artwork?: AppArtworkMap;\n",
)

replace_once(
    "src/services/bootstrap-service.ts",
    "async function getAppBootstrap():\n  Promise<AppBootstrap> {\n",
    """export function getCachedAppBootstrap(): AppBootstrap | null {
  const currentTime = Date.now();

  if (
    cachedAppBootstrap &&
    cachedAppBootstrap.expiresAt >
      currentTime
  ) {
    return cachedAppBootstrap.value;
  }

  if (cachedAppBootstrap) {
    cachedAppBootstrap = null;
  }

  return null;
}

async function getAppBootstrap():
  Promise<AppBootstrap> {
""",
)

write(
    "src/services/app-artwork-service.ts",
    """import getAppBootstrap, {
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

  return /^https?:\\/\\//i.test(normalized)
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
""",
)

write(
    "src/hooks/use-database-first-artwork.ts",
    """import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import type {
  ImageSourcePropType,
} from 'react-native';

import {
  getCachedAppArtworkResolution,
  resolveAppArtworkUrl,
} from '../services/app-artwork-service';

type UseDatabaseFirstArtworkOptions = {
  timeoutMs?: number;
};

type ArtworkState = {
  resolved: boolean;
  remoteUrl: string | null;
};

function withOptionalTimeout<T>(
  task: Promise<T>,
  timeoutMs: number | undefined,
): Promise<T> {
  if (
    typeof timeoutMs !== 'number' ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0
  ) {
    return task;
  }

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(
        new Error(
          'Database artwork resolution timed out.',
        ),
      );
    }, timeoutMs);

    task.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export function useDatabaseFirstArtworkSource(
  artworkKey: string,
  fallbackSource: ImageSourcePropType,
  options?: UseDatabaseFirstArtworkOptions,
) {
  const [state, setState] =
    useState<ArtworkState>(() =>
      getCachedAppArtworkResolution(
        artworkKey,
      ),
    );

  const [
    failedRemoteUrl,
    setFailedRemoteUrl,
  ] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const cached =
      getCachedAppArtworkResolution(
        artworkKey,
      );

    setFailedRemoteUrl(null);

    if (cached.resolved) {
      setState(cached);

      return () => {
        cancelled = true;
      };
    }

    setState({
      resolved: false,
      remoteUrl: null,
    });

    void withOptionalTimeout(
      resolveAppArtworkUrl(artworkKey),
      options?.timeoutMs,
    ).then(
      (remoteUrl) => {
        if (cancelled) {
          return;
        }

        setState({
          resolved: true,
          remoteUrl,
        });
      },
      () => {
        if (cancelled) {
          return;
        }

        setState({
          resolved: true,
          remoteUrl: null,
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [
    artworkKey,
    options?.timeoutMs,
  ]);

  const usingRemote =
    Boolean(state.remoteUrl) &&
    failedRemoteUrl !== state.remoteUrl;

  const source:
    | ImageSourcePropType
    | null =
    !state.resolved
      ? null
      : usingRemote &&
          state.remoteUrl
        ? {
            uri: state.remoteUrl,
          }
        : fallbackSource;

  const handleError = useCallback(() => {
    if (state.remoteUrl) {
      setFailedRemoteUrl(
        state.remoteUrl,
      );
    }
  }, [state.remoteUrl]);

  return {
    source,
    remoteUrl:
      state.remoteUrl,
    isResolved:
      state.resolved,
    usingRemote,
    onError:
      handleError,
  };
}

export default useDatabaseFirstArtworkSource;
""",
)

write(
    "src/components/ui/database-first-image.tsx",
    """import {
  Image,
  type ImageProps,
  type ImageSourcePropType,
  View,
} from 'react-native';

import {
  useDatabaseFirstArtworkSource,
} from '../../hooks/use-database-first-artwork';

type DatabaseFirstImageProps =
  Omit<ImageProps, 'source'> & {
    artworkKey: string;
    fallbackSource: ImageSourcePropType;
  };

export default function DatabaseFirstImage({
  artworkKey,
  fallbackSource,
  onError,
  style,
  ...imageProps
}: DatabaseFirstImageProps) {
  const artwork =
    useDatabaseFirstArtworkSource(
      artworkKey,
      fallbackSource,
    );

  if (!artwork.source) {
    return (
      <View
        pointerEvents=\"none\"
        style={style as never}
      />
    );
  }

  return (
    <Image
      {...imageProps}
      source={artwork.source}
      style={style}
      onError={(event) => {
        if (artwork.usingRemote) {
          artwork.onError();
        }

        onError?.(event);
      }}
    />
  );
}
""",
)


# ---------------------------------------------------------------------------
# Restaurants: every cuisine photo, including View All, is database-first.
# ---------------------------------------------------------------------------
replace_once(
    "src/app/category/restaurants.tsx",
    "import CategorySearchEntry from '../../components/search/category-search-entry';\n",
    "import CategorySearchEntry from '../../components/search/category-search-entry';\nimport DatabaseFirstImage from '../../components/ui/database-first-image';\n",
)

replace_once(
    "src/app/category/restaurants.tsx",
    """const PREVIEW_CUISINE_KEYS = [
  'pizza',
  'crepes',
  'grills',
  'sandwiches',
  'desserts',
];
""",
    """const PREVIEW_CUISINE_KEYS = [
  'pizza',
  'crepes',
  'grills',
  'sandwiches',
  'desserts',
];

function getCuisineArtworkKey(
  cuisineKey: string,
) {
  return `src/assets/cuisines/${cuisineKey}.webp`;
}
""",
)

replace_once(
    "src/app/category/restaurants.tsx",
    """        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={`صورة ${cuisine.label}`}
          resizeMode=\"cover\"
          source={cuisine.image}
          style={
            styles.cuisinePreviewPhoto
          }
        />
""",
    """        <DatabaseFirstImage
          accessibilityIgnoresInvertColors
          accessibilityLabel={`صورة ${cuisine.label}`}
          artworkKey={getCuisineArtworkKey(
            cuisine.key,
          )}
          fallbackSource={cuisine.image}
          resizeMode=\"cover\"
          style={
            styles.cuisinePreviewPhoto
          }
        />
""",
)

replace_once(
    "src/app/category/restaurants.tsx",
    """                        <Image
                          accessibilityIgnoresInvertColors
                          accessibilityLabel={`صورة ${cuisine.label}`}
                          resizeMode=\"cover\"
                          source={
                            cuisine.image
                          }
                          style={
                            styles.cuisineGridPhoto
                          }
                        />
""",
    """                        <DatabaseFirstImage
                          accessibilityIgnoresInvertColors
                          accessibilityLabel={`صورة ${cuisine.label}`}
                          artworkKey={getCuisineArtworkKey(
                            cuisine.key,
                          )}
                          fallbackSource={
                            cuisine.image
                          }
                          resizeMode=\"cover\"
                          style={
                            styles.cuisineGridPhoto
                          }
                        />
""",
)


# ---------------------------------------------------------------------------
# Home header + discovery: database-first with local fallback.
# ---------------------------------------------------------------------------
replace_once(
    "src/features/home/home-components.tsx",
    "import AppBottomNavigation from '../../category/app-bottom-navigation';\n",
    "import AppBottomNavigation from '../../category/app-bottom-navigation';\nimport DatabaseFirstImage from '../../components/ui/database-first-image';\n",
)

replace_once(
    "src/features/home/home-components.tsx",
    "const navienty24hMoodBackground = require('../../assets/images/navienty-now-24h-mood-background.png');\n\nconst HOME_SEARCH_PLACEHOLDER_ROTATION_MS = 1800;\n",
    """const navienty24hMoodBackground = require('../../assets/images/navienty-now-24h-mood-background.png');

const HOME_DISCOVERY_ARTWORK_KEYS:
  Readonly<Record<string, string>> = {
    breakfast:
      'src/assets/cuisines/breakfast.webp',
    bakery:
      'src/assets/cuisines/bakery.webp',
    'coffee-tea':
      'assets/images/supermarket-categories/coffee-tea.webp',
    beverages:
      'assets/images/supermarket-categories/beverages.webp',
    sandwiches:
      'src/assets/cuisines/sandwiches.webp',
    pizza:
      'src/assets/cuisines/pizza.webp',
    crepes:
      'src/assets/cuisines/crepes.webp',
    desserts:
      'src/assets/cuisines/desserts.webp',
    'snacks-chocolate':
      'assets/images/supermarket-categories/snacks-chocolate.webp',
    notebooks:
      'assets/images/bookstore-categories/notebooks.webp',
    'face-care':
      'assets/images/personal-care-categories/face-care.webp',
  };

const HOME_SEARCH_PLACEHOLDER_ROTATION_MS = 1800;
""",
)

replace_once(
    "src/features/home/home-components.tsx",
    """        <Image
          accessibilityIgnoresInvertColors
          resizeMode=\"contain\"
          source={navientyDeliveryBike}
          style={styles.deliveryBikeImage}
        />
""",
    """        <DatabaseFirstImage
          accessibilityIgnoresInvertColors
          artworkKey=\"src/assets/images/navienty-now-delivery-bike-transparent.png\"
          fallbackSource={navientyDeliveryBike}
          resizeMode=\"contain\"
          style={styles.deliveryBikeImage}
        />
""",
)

replace_once(
    "src/features/home/home-components.tsx",
    """          <ExpoImage
            accessibilityLabel=\"Navienty delivery motorcycle\"
            contentFit=\"contain\"
            source={navientyDeliveryBike}
            style={styles.deliveryBikeImage}
            transition={0}
          />
""",
    """          <DatabaseFirstImage
            accessibilityLabel=\"Navienty delivery motorcycle\"
            artworkKey=\"src/assets/images/navienty-now-delivery-bike-transparent.png\"
            fallbackSource={navientyDeliveryBike}
            resizeMode=\"contain\"
            style={styles.deliveryBikeImage}
          />
""",
)

replace_once(
    "src/features/home/home-components.tsx",
    """      <Image
        accessibilityIgnoresInvertColors
        resizeMode=\"stretch\"
        source={navienty24hMoodBackground}
        style={styles.headerTimeMoodBackground}
      />
""",
    """      <DatabaseFirstImage
        accessibilityIgnoresInvertColors
        artworkKey=\"src/assets/images/navienty-now-24h-mood-background.png\"
        fallbackSource={navienty24hMoodBackground}
        resizeMode=\"stretch\"
        style={styles.headerTimeMoodBackground}
      />
""",
)

replace_once(
    "src/features/home/home-components.tsx",
    """            <Image
              accessibilityIgnoresInvertColors
              resizeMode=\"cover\"
              source={item.image}
              style={
                styles.discoveryImage
              }
            />
""",
    """            <DatabaseFirstImage
              accessibilityIgnoresInvertColors
              artworkKey={
                HOME_DISCOVERY_ARTWORK_KEYS[
                  item.key
                ] ?? ''
              }
              fallbackSource={item.image}
              resizeMode=\"cover\"
              style={
                styles.discoveryImage
              }
            />
""",
)


# ---------------------------------------------------------------------------
# Auth hero: database-first. Root startup normally prewarms bootstrap cache.
# ---------------------------------------------------------------------------
replace_once(
    "src/app/login.tsx",
    "import { useAuthSession } from '../hooks/use-auth-session';\n",
    "import { useAuthSession } from '../hooks/use-auth-session';\nimport { useDatabaseFirstArtworkSource } from '../hooks/use-database-first-artwork';\n",
)

replace_once(
    "src/app/login.tsx",
    """const navientyNowHero = require(
  '../assets/images/navienty-now-auth-hero.png',
);
""",
    """const navientyNowHero = require(
  '../assets/images/navienty-now-auth-hero.png',
);

const AUTH_HERO_ARTWORK_KEY =
  'src/assets/images/navienty-now-auth-hero.png';
""",
)

replace_once(
    "src/app/login.tsx",
    """export default function LoginScreen() {
  const router = useRouter();
""",
    """export default function LoginScreen() {
  const router = useRouter();

  const authHeroArtwork =
    useDatabaseFirstArtworkSource(
      AUTH_HERO_ARTWORK_KEY,
      navientyNowHero,
      {
        timeoutMs: 2500,
      },
    );
""",
)

regex_sub(
    "src/app/login.tsx",
    r"source=\{\s*navientyNowHero\s*\}",
    """source={
            authHeroArtwork.source ??
            navientyNowHero
          }
          onError={
            authHeroArtwork.onError
          }""",
    3,
)


# ---------------------------------------------------------------------------
# React bootstrap: DB-first. Native OS splash is the unavoidable pre-JS
# exception. Keep it visible until DB artwork resolution settles or times out.
# ---------------------------------------------------------------------------
replace_once(
    "src/app/_layout.tsx",
    "import getAppBootstrap from '../services/bootstrap-service';\n",
    "import getAppBootstrap from '../services/bootstrap-service';\nimport { useDatabaseFirstArtworkSource } from '../hooks/use-database-first-artwork';\n",
)

replace_once(
    "src/app/_layout.tsx",
    """function AppBootstrapScreen({
  isReady,
  onFinished,
}: AppBootstrapScreenProps) {
  const { width: windowWidth } =
    useWindowDimensions();
""",
    """function AppBootstrapScreen({
  isReady,
  onFinished,
}: AppBootstrapScreenProps) {
  const { width: windowWidth } =
    useWindowDimensions();

  const fullLogoArtwork =
    useDatabaseFirstArtworkSource(
      'src/assets/images/navienty-now-bootstrap-full.png',
      bootstrapFullLogo,
      {
        timeoutMs: 2500,
      },
    );

  const dotArtwork =
    useDatabaseFirstArtworkSource(
      'src/assets/images/navienty-now-bootstrap-dot.png',
      bootstrapDot,
      {
        timeoutMs: 2500,
      },
    );

  const bootstrapArtworkResolved =
    fullLogoArtwork.isResolved &&
    dotArtwork.isResolved;
""",
)

replace_once(
    "src/app/_layout.tsx",
    """  useEffect(() => {
    hideNativeSplash();
  }, [hideNativeSplash]);
""",
    """  useEffect(() => {
    if (!bootstrapArtworkResolved) {
      return;
    }

    hideNativeSplash();
  }, [
    bootstrapArtworkResolved,
    hideNativeSplash,
  ]);
""",
)

replace_once(
    "src/app/_layout.tsx",
    """  useEffect(() => {
    if (!isReady) {
      return;
    }

    const fallbackTimer = setTimeout(
""",
    """  useEffect(() => {
    if (
      !isReady ||
      !bootstrapArtworkResolved
    ) {
      return;
    }

    const fallbackTimer = setTimeout(
""",
)

replace_once(
    "src/app/_layout.tsx",
    "  }, [finishBootstrap, isReady]);\n",
    """  }, [
    bootstrapArtworkResolved,
    finishBootstrap,
    isReady,
  ]);
""",
)

replace_once(
    "src/app/_layout.tsx",
    """  useEffect(() => {
    revealCoverTranslateX.setValue(0);

    const introAnimation = Animated.sequence([
""",
    """  useEffect(() => {
    if (!bootstrapArtworkResolved) {
      return;
    }

    revealCoverTranslateX.setValue(0);

    const introAnimation = Animated.sequence([
""",
)

replace_once(
    "src/app/_layout.tsx",
    """    dotTranslateY,
    logoWidth,
    revealCoverTranslateX,
  ]);
""",
    """    bootstrapArtworkResolved,
    dotTranslateY,
    logoWidth,
    revealCoverTranslateX,
  ]);
""",
)

replace_once(
    "src/app/_layout.tsx",
    "            source={bootstrapFullLogo}\n",
    """            source={
              fullLogoArtwork.source ??
              bootstrapFullLogo
            }
            onError={
              fullLogoArtwork.onError
            }
""",
)

replace_once(
    "src/app/_layout.tsx",
    "          source={bootstrapDot}\n",
    """          source={
            dotArtwork.source ??
            bootstrapDot
          }
          onError={
            dotArtwork.onError
          }
""",
)


# ---------------------------------------------------------------------------
# Campaign local sentinel: campaign DB URL remains primary; when DB explicitly
# chooses the bundled sentinel, app_settings.artwork still gets first refusal.
# ---------------------------------------------------------------------------
replace_once(
    "src/components/dynamic-campaign-popup.tsx",
    "import type { CampaignPopup } from '../services/campaign-popup-service';\n",
    "import type { CampaignPopup } from '../services/campaign-popup-service';\nimport DatabaseFirstImage from './ui/database-first-image';\n",
)

replace_once(
    "src/components/dynamic-campaign-popup.tsx",
    """function resolveCampaignImageSource(
  imageUrl: string,
): ImageSourcePropType {
  return (
    localCampaignImages[imageUrl] ?? {
      uri: imageUrl,
    }
  );
}
""",
    """function resolveCampaignImageSource(
  imageUrl: string,
): ImageSourcePropType {
  return (
    localCampaignImages[imageUrl] ?? {
      uri: imageUrl,
    }
  );
}

function getLocalCampaignArtworkKey(
  imageUrl: string,
): string | null {
  if (
    imageUrl ===
    'local://navienty-now-hadaba-asyut-up'
  ) {
    return 'src/assets/images/navienty-now-hadaba-asyut-up.png';
  }

  return null;
}
""",
)

replace_once(
    "src/components/dynamic-campaign-popup.tsx",
    """  const imageSource = useMemo(
    () =>
      campaign
        ? resolveCampaignImageSource(
            campaign.imageUrl,
          )
        : null,
    [campaign],
  );
""",
    """  const imageSource = useMemo(
    () =>
      campaign
        ? resolveCampaignImageSource(
            campaign.imageUrl,
          )
        : null,
    [campaign],
  );

  const localCampaignArtworkKey =
    campaign
      ? getLocalCampaignArtworkKey(
          campaign.imageUrl,
        )
      : null;

  const localCampaignFallback =
    campaign
      ? localCampaignImages[
          campaign.imageUrl
        ] ?? null
      : null;
""",
)

replace_once(
    "src/components/dynamic-campaign-popup.tsx",
    """              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel={
                  campaign.altTextAr ??
                  campaign.title
                }
                fadeDuration={0}
                resizeMode=\"cover\"
                source={imageSource}
                style={styles.heroImage}
                onError={(event) => {
                  console.warn(
                    'Unable to load campaign popup image.',
                    campaign.imageUrl,
                    event.nativeEvent.error,
                  );
                  setIsImageReady(true);
                }}
                onLoad={() => {
                  setIsImageReady(true);
                }}
              />
""",
    """              {localCampaignArtworkKey &&
              localCampaignFallback ? (
                <DatabaseFirstImage
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={
                    campaign.altTextAr ??
                    campaign.title
                  }
                  artworkKey={
                    localCampaignArtworkKey
                  }
                  fadeDuration={0}
                  fallbackSource={
                    localCampaignFallback
                  }
                  resizeMode=\"cover\"
                  style={styles.heroImage}
                  onError={(event) => {
                    console.warn(
                      'Unable to load campaign popup image.',
                      campaign.imageUrl,
                      event.nativeEvent.error,
                    );
                    setIsImageReady(true);
                  }}
                  onLoad={() => {
                    setIsImageReady(true);
                  }}
                />
              ) : (
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={
                    campaign.altTextAr ??
                    campaign.title
                  }
                  fadeDuration={0}
                  resizeMode=\"cover\"
                  source={imageSource}
                  style={styles.heroImage}
                  onError={(event) => {
                    console.warn(
                      'Unable to load campaign popup image.',
                      campaign.imageUrl,
                      event.nativeEvent.error,
                    );
                    setIsImageReady(true);
                  }}
                  onLoad={() => {
                    setIsImageReady(true);
                  }}
                />
              )}
""",
)


# ---------------------------------------------------------------------------
# Repository audit output: enumerate local image require references after patch
# so the workflow log can be reviewed against existing DB-backed fallbacks.
# ---------------------------------------------------------------------------
image_pattern = re.compile(
    r"require\(\s*['\"]([^'\"]+\.(?:png|jpe?g|webp))['\"]\s*\)",
    re.I | re.S,
)

hits: list[str] = []

for path in ROOT.rglob("*"):
    if path.suffix not in {
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mjs",
    }:
        continue

    if "node_modules" in path.parts:
        continue

    text = path.read_text(
        encoding="utf-8",
        errors="ignore",
    )

    for match in image_pattern.finditer(text):
        hits.append(
            f"{path.relative_to(ROOT)} :: {match.group(1)}"
        )

print("DATABASE_FIRST_ARTWORK_SCAN_BEGIN")
for hit in sorted(hits):
    print(hit)
print("DATABASE_FIRST_ARTWORK_SCAN_END")
print(
    f"Direct local image require references: {len(hits)}"
)
