import { Ionicons } from '@expo/vector-icons';
import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Animated,
    Easing,
    Image,
    type ImageSourcePropType,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';

import type { CampaignPopup } from '../services/campaign-popup-service';
import DatabaseFirstImage from './ui/database-first-image';

const localCampaignImages: Record<
  string,
  ImageSourcePropType
> = {
  'local://navienty-now-hadaba-asyut-up':
    require('../assets/images/navienty-now-hadaba-asyut-up.png'),
};

function resolveCampaignImageSource(
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

export default function DynamicCampaignPopup({
  campaign,
  visible,
  onDismiss,
  onPresented,
  onPrimaryAction,
}: {
  campaign: CampaignPopup | null;
  visible: boolean;
  onDismiss: () => void;
  onPresented: (
    campaign: CampaignPopup,
  ) => void;
  onPrimaryAction: () => Promise<void> | void;
}) {
  const {
    height: viewportHeight,
    width: viewportWidth,
  } = useWindowDimensions();

  const [isImageReady, setIsImageReady] =
    useState(false);
  const [isActionPending, setIsActionPending] =
    useState(false);

  const cardEntrance = useRef(
    new Animated.Value(0),
  ).current;

  const backdropOpacity = useRef(
    new Animated.Value(0),
  ).current;

  const lastPresentedKeyRef =
    useRef<string | null>(null);

  const onPresentedRef = useRef(
    onPresented,
  );

  useEffect(() => {
    onPresentedRef.current = onPresented;
  }, [onPresented]);

  const cardWidth = Math.min(
    356,
    Math.max(286, viewportWidth - 32),
  );

  const heroHeight = Math.min(
    282,
    Math.max(
      218,
      Math.round(cardWidth * 0.73),
    ),
  );

  const modalVerticalPadding =
    viewportHeight < 720 ? 16 : 28;

  const imageSource = useMemo(
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

  useEffect(() => {
    setIsImageReady(false);
    setIsActionPending(false);
    cardEntrance.setValue(0);
    backdropOpacity.setValue(0);
  }, [
    backdropOpacity,
    campaign?.id,
    campaign?.config.version,
    cardEntrance,
  ]);

  useEffect(() => {
    if (!visible || !campaign) {
      cardEntrance.setValue(0);
      backdropOpacity.setValue(0);
      return;
    }

    const backdropAnimation =
      Animated.timing(
        backdropOpacity,
        {
          toValue: 1,
          duration: 180,
          easing: Easing.out(
            Easing.quad,
          ),
          useNativeDriver: true,
        },
      );

    backdropAnimation.start();

    return () => {
      backdropAnimation.stop();
    };
  }, [
    backdropOpacity,
    campaign,
    cardEntrance,
    visible,
  ]);

  useEffect(() => {
    if (
      !visible ||
      !campaign ||
      !isImageReady
    ) {
      return;
    }

    cardEntrance.setValue(0);

    const cardAnimation =
      Animated.spring(
        cardEntrance,
        {
          toValue: 1,
          damping: 18,
          stiffness: 190,
          mass: 0.78,
          useNativeDriver: true,
        },
      );

    cardAnimation.start();

    const presentationKey =
      `${campaign.id}:v${campaign.config.version}`;

    if (
      lastPresentedKeyRef.current !==
      presentationKey
    ) {
      lastPresentedKeyRef.current =
        presentationKey;
      onPresentedRef.current(campaign);
    }

    return () => {
      cardAnimation.stop();
    };
  }, [
    campaign,
    cardEntrance,
    isImageReady,
    visible,
  ]);

  if (!campaign || !imageSource) {
    return null;
  }

  const cardTranslateY =
    cardEntrance.interpolate({
      inputRange: [0, 1],
      outputRange: [34, 0],
    });

  const cardScale =
    cardEntrance.interpolate({
      inputRange: [0, 1],
      outputRange: [0.96, 1],
    });

  const canRenderCta = Boolean(
    campaign.ctaLabel,
  );

  const handleRequestClose = () => {
    if (campaign.config.dismissible) {
      onDismiss();
    }
  };

  const handlePrimaryAction = async () => {
    if (isActionPending) {
      return;
    }

    try {
      setIsActionPending(true);
      await onPrimaryAction();
    } finally {
      setIsActionPending(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      visible={visible}
      onRequestClose={handleRequestClose}
    >
      <View
        style={[
          styles.root,
          {
            paddingVertical:
              modalVerticalPadding,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.backdrop,
            {
              backgroundColor:
                campaign.theme.backdropColor,
              opacity: backdropOpacity,
            },
          ]}
        />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: isImageReady
                ? cardEntrance
                : 0,
              width: cardWidth,
              transform: [
                {
                  translateY:
                    cardTranslateY,
                },
                {
                  scale: cardScale,
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.surface,
              {
                backgroundColor:
                  campaign.theme.surfaceColor,
                borderColor:
                  campaign.theme.borderColor,
              },
            ]}
          >
            <View
              style={[
                styles.heroWrap,
                {
                  height: heroHeight,
                },
              ]}
            >
              {localCampaignArtworkKey &&
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
                  resizeMode="cover"
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
                  resizeMode="cover"
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

              <View
                pointerEvents="none"
                style={styles.heroShade}
              />
            </View>

            {campaign.config.dismissible ? (
              <Pressable
                accessibilityLabel="إغلاق الرسالة"
                accessibilityRole="button"
                hitSlop={12}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed &&
                    styles.closeButtonPressed,
                ]}
                onPress={onDismiss}
              >
                <Ionicons
                  color={
                    campaign.theme.primaryColor
                  }
                  name="close"
                  size={25}
                />
              </Pressable>
            ) : null}

            <View style={styles.content}>
              <View style={styles.copy}>
                <Text
                  maxFontSizeMultiplier={1.15}
                  numberOfLines={2}
                  style={[
                    styles.headline,
                    {
                      color:
                        campaign.theme
                          .primaryColor,
                    },
                  ]}
                >
                  {campaign.title}
                </Text>

                {campaign.subtitle ? (
                  <Text
                    maxFontSizeMultiplier={1.2}
                    style={[
                      styles.description,
                      {
                        color:
                          campaign.theme
                            .textColor,
                      },
                    ]}
                  >
                    {campaign.subtitle}
                  </Text>
                ) : null}
              </View>

              {canRenderCta ? (
                <Pressable
                  accessibilityLabel={
                    campaign.ctaLabel ??
                    undefined
                  }
                  accessibilityRole="button"
                  disabled={isActionPending}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    {
                      backgroundColor:
                        campaign.theme
                          .buttonColor,
                    },
                    (pressed ||
                      isActionPending) &&
                      styles.primaryButtonPressed,
                  ]}
                  onPress={() => {
                    void handlePrimaryAction();
                  }}
                >
                  <Text
                    maxFontSizeMultiplier={1.15}
                    style={[
                      styles.primaryButtonText,
                      {
                        color:
                          campaign.theme
                            .buttonTextColor,
                      },
                    ]}
                  >
                    {campaign.ctaLabel}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  backdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  card: {
    maxWidth: 356,
    position: 'relative',
    shadowColor: '#001A0B',
    shadowOffset: {
      width: 0,
      height: 16,
    },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 18,
  },

  surface: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },

  heroWrap: {
    backgroundColor: '#DCE7DE',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },

  heroImage: {
    height: '100%',
    width: '100%',
  },

  heroShade: {
    backgroundColor:
      'rgba(0, 0, 0, 0.025)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  closeButton: {
    alignItems: 'center',
    backgroundColor:
      'rgba(255, 255, 255, 0.94)',
    borderColor:
      'rgba(0, 45, 19, 0.08)',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    shadowColor: '#001A0B',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    top: 12,
    width: 40,
    zIndex: 6,
    elevation: 5,
  },

  closeButtonPressed: {
    backgroundColor:
      'rgba(244, 250, 246, 0.98)',
    transform: [
      {
        scale: 0.95,
      },
    ],
  },

  content: {
    paddingBottom: 22,
    paddingHorizontal: 22,
    paddingTop: 21,
    width: '100%',
  },

  copy: {
    alignItems: 'center',
    width: '100%',
  },

  headline: {
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 39,
    textAlign: 'center',
    writingDirection: 'rtl',
    width: '100%',
  },

  description: {
    fontSize: 15.5,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: 8,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  primaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 22,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 55,
    shadowColor: '#075B2A',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.13,
    shadowRadius: 10,
    elevation: 4,
  },

  primaryButtonPressed: {
    opacity: 0.92,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  primaryButtonText: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
