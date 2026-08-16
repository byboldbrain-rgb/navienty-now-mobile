import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import {
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import {
    SafeAreaView,
    useSafeAreaInsets,
} from 'react-native-safe-area-context';

import type { HomeBanner } from '../../services/home-banners-service';
import {
    NAVIENTY_NOW_COLORS,
    NAVIENTY_NOW_LAYOUT,
} from '../../theme/navienty-now-theme';

type PremiumPromoTemplateProps = {
  banner: HomeBanner;
  areaName?: string | null;
  ctaEnabled: boolean;
  isOpeningAction: boolean;
  onClose: () => void;
  onPressCta: () => void;
};

/**
 * HERO
 *
 * Reference image:
 * 1112 × 1280
 *
 * React Native aspectRatio = width / height
 * 1112 / 1280 = 0.86875
 *
 * This gives the Hero the tall campaign-card appearance
 * shown in the purple reference.
 */
const HERO_ASPECT_RATIO = 1112 / 1280;

/**
 * ADDITIONAL CAMPAIGN IMAGES
 *
 * Reference image:
 * 1125 × 792
 *
 * 1125 / 792 ≈ 1.42045
 *
 * Every image stored in home_banner_images will use
 * this same visual size.
 */
const GALLERY_ASPECT_RATIO = 1125 / 792;

const IMAGE_GAP = 14;

export default function PremiumPromoTemplate({
  banner,
  ctaEnabled,
  isOpeningAction,
  onClose,
  onPressCta,
}: PremiumPromoTemplateProps) {
  const insets = useSafeAreaInsets();

  const { width: viewportWidth } =
    useWindowDimensions();

  const contentWidth = Math.min(
    NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    viewportWidth,
  );

  const bottomBarPadding =
    14 + Math.max(insets.bottom, 8);

  return (
    <SafeAreaView
      edges={['top']}
      style={styles.safeArea}
    >
      <StatusBar style="dark" />

      {/* =========================
          FIXED HEADER
      ========================== */}
      <View style={styles.header}>
        <View
          style={[
            styles.headerInner,
            {
              maxWidth: contentWidth,
            },
          ]}
        >
          <Text
            numberOfLines={1}
            style={styles.headerTitle}
          >
            Navienty Now
          </Text>

          <Pressable
            accessibilityLabel="إغلاق"
            accessibilityRole="button"
            hitSlop={10}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.pressed,
            ]}
            onPress={onClose}
          >
            <Ionicons
              color={NAVIENTY_NOW_COLORS.text}
              name="close"
              size={28}
            />
          </Pressable>
        </View>
      </View>

      {/* =========================
          PROMO CONTENT
      ========================== */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom:
              ctaEnabled
                ? 106 +
                  Math.max(insets.bottom, 8)
                : 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <View
          style={[
            styles.page,
            {
              maxWidth: contentWidth,
            },
          ]}
        >
          {/* =====================
              LARGE HERO IMAGE
          ====================== */}
          <View style={styles.heroFrame}>
            <Image
              accessibilityIgnoresInvertColors
              accessibilityLabel={
                banner.altTextAr ||
                banner.altTextEn ||
                'Navienty Now'
              }
              resizeMode="cover"
              source={{
                uri: banner.imageUrl,
              }}
              style={styles.heroImage}
            />
          </View>

          {/* =====================
              ADDITIONAL IMAGES
          ====================== */}
          {banner.additionalImages.map(
            (image) => (
              <View
                key={image.id}
                style={
                  styles.galleryImageFrame
                }
              >
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={
                    image.altTextAr ||
                    undefined
                  }
                  resizeMode="cover"
                  source={{
                    uri: image.imageUrl,
                  }}
                  style={styles.galleryImage}
                />
              </View>
            ),
          )}
        </View>
      </ScrollView>

      {/* =========================
          FIXED BOOKING BUTTON
      ========================== */}
      {ctaEnabled ? (
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom:
                bottomBarPadding,
            },
          ]}
        >
          <View
            style={[
              styles.bottomBarInner,
              {
                maxWidth: contentWidth,
              },
            ]}
          >
            <Pressable
              accessibilityLabel="احجز دلوقتي"
              accessibilityRole="button"
              disabled={isOpeningAction}
              style={({ pressed }) => [
                styles.ctaButton,

                pressed &&
                  !isOpeningAction &&
                  styles.ctaButtonPressed,

                isOpeningAction &&
                  styles.ctaButtonDisabled,
              ]}
              onPress={onPressCta}
            >
              <Text
                style={styles.ctaButtonText}
              >
                {isOpeningAction
                  ? 'جاري الفتح...'
                  : 'احجز دلوقتي'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,

    flex: 1,
  },

  /* =========================
     HEADER
  ========================== */

  header: {
    alignItems: 'center',

    backgroundColor:
      NAVIENTY_NOW_COLORS.page,

    borderBottomColor:
      NAVIENTY_NOW_COLORS.border,

    borderBottomWidth:
      StyleSheet.hairlineWidth,

    zIndex: 20,
  },

  headerInner: {
    alignItems: 'center',

    height: 64,

    justifyContent: 'center',

    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,

    position: 'relative',

    width: '100%',
  },

  headerTitle: {
    color:
      NAVIENTY_NOW_COLORS.primary,

    fontSize: 22,

    fontWeight: '900',

    letterSpacing: -0.6,

    textAlign: 'center',
  },

  closeButton: {
    alignItems: 'center',

    height: 48,

    justifyContent: 'center',

    position: 'absolute',

    right:
      NAVIENTY_NOW_LAYOUT.pageGutter,

    width: 48,
  },

  /* =========================
     SCROLL CONTENT
  ========================== */

  scrollView: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,

    flex: 1,
  },

  scrollContent: {
    alignItems: 'center',
  },

  page: {
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,

    paddingTop: 16,

    width: '100%',
  },

  /* =========================
     HERO

     Ratio: 1112 / 1280
     Tall / portrait campaign visual
  ========================== */

  heroFrame: {
    aspectRatio:
      HERO_ASPECT_RATIO,

    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,

    borderRadius: 26,

    overflow: 'hidden',

    width: '100%',
  },

  heroImage: {
    height: '100%',

    width: '100%',
  },

  /* =========================
     ADDITIONAL IMAGES

     Ratio: 1125 / 792
     Same size for every image
  ========================== */

  galleryImageFrame: {
    aspectRatio:
      GALLERY_ASPECT_RATIO,

    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,

    borderRadius: 22,

    marginTop:
      IMAGE_GAP,

    overflow: 'hidden',

    width: '100%',
  },

  galleryImage: {
    height: '100%',

    width: '100%',
  },

  /* =========================
     FIXED CTA
  ========================== */

  bottomBar: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,

    borderTopColor:
      NAVIENTY_NOW_COLORS.border,

    borderTopWidth:
      StyleSheet.hairlineWidth,

    bottom: 0,

    left: 0,

    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,

    paddingTop: 12,

    position: 'absolute',

    right: 0,

    shadowColor: '#000000',

    shadowOffset: {
      height: -5,
      width: 0,
    },

    shadowOpacity: 0.06,

    shadowRadius: 14,

    elevation: 14,
  },

  bottomBarInner: {
    alignSelf: 'center',

    width: '100%',
  },

  ctaButton: {
    alignItems: 'center',

    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,

    borderRadius: 18,

    justifyContent: 'center',

    minHeight: 58,

    paddingHorizontal: 20,
  },

  ctaButtonPressed: {
    opacity: 0.88,

    transform: [
      {
        scale: 0.994,
      },
    ],
  },

  ctaButtonDisabled: {
    opacity: 0.7,
  },

  ctaButtonText: {
    color:
      NAVIENTY_NOW_COLORS.white,

    fontSize: 17,

    fontWeight: '900',

    textAlign: 'center',
  },

  pressed: {
    opacity: 0.65,
  },
});