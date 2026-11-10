import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';

import DatabaseFirstImage from '../ui/database-first-image';

// Identical courier + motorcycle artwork used by the Home screen.
// Respect the same Database First asset override as HomeHeader.
const HOME_DELIVERY_BIKE = require(
  '../../assets/images/navienty-now-delivery-bike-transparent.png',
);
const HOME_DELIVERY_BIKE_ARTWORK_KEY =
  'src/assets/images/navienty-now-delivery-bike-transparent.png';

/**
 * Compact version of Home's delivery-bike hero for the Cart tip card.
 * Uses the exact same artwork, slight vertical road bounce and bike lean.
 * The full-width journey remains unchanged on the Home screen; a small
 * avatar uses a contained loop so the bike never disappears off the card.
 */
export default function AnimatedDeliveryRider() {
  const bounceY = useRef(new Animated.Value(0)).current;
  const bikeLean = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    let motion: Animated.CompositeAnimation | null = null;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (!mounted || reduceMotion) return;

        const bounce = Animated.loop(
          Animated.sequence([
            Animated.timing(bounceY, {
              toValue: -1.45,
              duration: 260,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(bounceY, {
              toValue: 0.65,
              duration: 300,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(bounceY, {
              toValue: 0,
              duration: 250,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
              isInteraction: false,
            }),
          ]),
        );

        const lean = Animated.loop(
          Animated.sequence([
            Animated.timing(bikeLean, {
              toValue: -0.38,
              duration: 720,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(bikeLean, {
              toValue: 0,
              duration: 1250,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.delay(550),
            Animated.timing(bikeLean, {
              toValue: 0.22,
              duration: 650,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(bikeLean, {
              toValue: 0,
              duration: 900,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
              isInteraction: false,
            }),
          ]),
        );

        motion = Animated.parallel([bounce, lean]);
        motion.start();
      })
      .catch(() => {
        // Preserve the same static courier image on accessibility failures.
      });

    return () => {
      mounted = false;
      motion?.stop();
      bounceY.stopAnimation();
      bikeLean.stopAnimation();
    };
  }, [bikeLean, bounceY]);

  const leanRotation = bikeLean.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-0.55deg', '0deg', '0.55deg'],
  });

  return (
    <View
      pointerEvents="none"
      style={styles.stage}
      accessibilityLabel="سائق توصيل نافينتي على الموتوسيكل"
      accessible
    >
      <View style={styles.shadow} />
      <Animated.View
        renderToHardwareTextureAndroid
        style={{
          transform: [
            { translateY: bounceY },
            { rotate: leanRotation },
          ],
        }}
      >
        <DatabaseFirstImage
          artworkKey={HOME_DELIVERY_BIKE_ARTWORK_KEY}
          fallbackSource={HOME_DELIVERY_BIKE}
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          style={styles.artwork}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: 60,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EAF8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  shadow: {
    position: 'absolute',
    bottom: 9,
    width: 38,
    height: 3,
    backgroundColor: 'rgba(0, 67, 34, 0.12)',
    borderRadius: 999,
  },
  artwork: {
    width: 70,
    height: 56,
  },
});
