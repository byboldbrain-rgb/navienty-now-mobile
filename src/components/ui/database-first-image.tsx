import {
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
        pointerEvents="none"
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
