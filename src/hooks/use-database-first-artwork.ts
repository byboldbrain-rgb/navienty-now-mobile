import {
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
