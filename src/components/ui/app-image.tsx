import {
  Image as ExpoImage,
  type ImageContentFit,
  type ImageProps as ExpoImageProps,
} from 'expo-image';
import {
  type ImageResizeMode,
  type ImageSourcePropType,
  type StyleProp,
  type ImageStyle,
} from 'react-native';

export type AppImageProps = Omit<
  ExpoImageProps,
  | 'source'
  | 'style'
  | 'contentFit'
  | 'cachePolicy'
> & {
  source: ImageSourcePropType | ExpoImageProps['source'];
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  contentFit?: ImageContentFit;
  cachePolicy?: ExpoImageProps['cachePolicy'];
  defaultSource?: ImageSourcePropType;
};

function mapResizeMode(
  resizeMode: ImageResizeMode | undefined,
): ImageContentFit | undefined {
  switch (resizeMode) {
    case 'contain':
      return 'contain';

    case 'stretch':
      return 'fill';

    case 'center':
      return 'none';

    case 'repeat':
      return 'cover';

    case 'cover':
      return 'cover';

    default:
      return undefined;
  }
}

function isRemoteSource(
  source: AppImageProps['source'],
): boolean {
  if (
    !source ||
    typeof source === 'number'
  ) {
    return false;
  }

  if (Array.isArray(source)) {
    return source.some(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.uri === 'string' &&
        /^https?:\/\//i.test(item.uri),
    );
  }

  return (
    typeof source === 'object' &&
    source !== null &&
    'uri' in source &&
    typeof source.uri === 'string' &&
    /^https?:\/\//i.test(source.uri)
  );
}

export default function AppImage({
  source,
  style,
  resizeMode,
  contentFit,
  cachePolicy,
  defaultSource,
  placeholder,
  ...props
}: AppImageProps) {
  const remote =
    isRemoteSource(source);

  return (
    <ExpoImage
      {...props}
      source={
        source as ExpoImageProps['source']
      }
      style={style}
      contentFit={
        contentFit ??
        mapResizeMode(
          resizeMode,
        )
      }
      cachePolicy={
        cachePolicy ??
        (remote
          ? 'memory-disk'
          : 'none')
      }
      placeholder={
        placeholder ??
        (defaultSource as ExpoImageProps['placeholder'])
      }
    />
  );
}
