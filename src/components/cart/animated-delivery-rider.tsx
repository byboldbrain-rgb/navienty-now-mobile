import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';

/**
 * Lightweight, self-contained vector animation. No network images or Lottie
 * assets to download, so the courier is visible immediately even offline.
 */
export default function AnimatedDeliveryRider() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    let movement: Animated.CompositeAnimation | null = null;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (!mounted || reduceMotion) return;

        movement = Animated.loop(
          Animated.sequence([
            Animated.timing(progress, {
              toValue: 1,
              duration: 520,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(progress, {
              toValue: 0,
              duration: 520,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        );

        movement.start();
      })
      .catch(() => {
        // The illustration stays visible if accessibility state cannot load.
      });

    return () => {
      mounted = false;
      movement?.stop();
    };
  }, [progress]);

  const bounce = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  const travel = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-1.5, 1.5],
  });

  return (
    <View
      style={styles.stage}
      accessible
      accessibilityLabel="رسم متحرك لسائق توصيل على دراجة نارية"
    >
      <Animated.View style={{ transform: [{ translateX: travel }, { translateY: bounce }] }}>
        <Svg width={54} height={43} viewBox="0 0 86 68" fill="none">
          {/* Moving courier, delivery box and scooter */}
          <Ellipse cx="44" cy="59" rx="34" ry="2.5" fill="#D7ECDD" opacity={0.85} />
          <Line x1="1" y1="38" x2="12" y2="38" stroke="#8ECFA8" strokeWidth="2.6" strokeLinecap="round" />
          <Line x1="5" y1="44" x2="13" y2="44" stroke="#8ECFA8" strokeWidth="2.6" strokeLinecap="round" />

          {/* Rear delivery box */}
          <Rect x="14" y="24" width="20" height="19" rx="3.5" fill="#00B14F" />
          <Rect x="17" y="27" width="14" height="3" rx="1.2" fill="#70DC9D" />
          <Path d="M22 33v6M19 36h6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />

          {/* Two wheels */}
          <Circle cx="26" cy="53" r="10" fill="#273B34" />
          <Circle cx="26" cy="53" r="5.6" fill="#FFFFFF" />
          <Circle cx="26" cy="53" r="2.3" fill="#9EAEA5" />
          <Circle cx="66" cy="53" r="10" fill="#273B34" />
          <Circle cx="66" cy="53" r="5.6" fill="#FFFFFF" />
          <Circle cx="66" cy="53" r="2.3" fill="#9EAEA5" />

          {/* Scooter body and frame */}
          <Path d="M20 43h21l7-13 12 4 4 11-5 5H38l-7-3H20z" fill="#03B651" />
          <Path d="M43 41h18l4 5H40z" fill="#008D42" />
          <Path d="M42 29l12 6" stroke="#1E3930" strokeWidth="3" strokeLinecap="round" />
          <Path d="M52 34l10 5" stroke="#1E3930" strokeWidth="2.5" strokeLinecap="round" />
          <Path d="M59 38h11" stroke="#263F35" strokeWidth="2.5" strokeLinecap="round" />
          <Rect x="29" y="37" width="19" height="4" rx="2" fill="#263F35" />
          <Rect x="57" y="33" width="10" height="3" rx="1.5" fill="#F5C84B" />
          <Path d="M17 46h16" stroke="#263F35" strokeWidth="3" strokeLinecap="round" />

          {/* Rider's bent legs, body and reaching arm */}
          <Path d="M39 34l-2 11 13 2" stroke="#253F37" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M40 35l8 9 9 1" stroke="#273B34" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M33 22c4-4 12-3 16 2l1 12H34z" fill="#14C566" />
          <Path d="M45 26l6 6 7 5" stroke="#F1B68D" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx="58" cy="37" r="2.7" fill="#F1B68D" />

          {/* Face and helmet make the driver recognizable, not a scooter emoji */}
          <Rect x="37" y="18" width="6" height="7" rx="2.5" fill="#EDAA80" />
          <Circle cx="40" cy="14" r="8.4" fill="#F1B68D" />
          <Path d="M31 15c-1.5-7 2-13 10-13 7.5 0 12 5 11 13H31z" fill="#008F43" />
          <Path d="M36 10h15c2.8 0 3.5 1.2 4.5 3.5H36z" fill="#10C567" />
          <Path d="M44 17h2" stroke="#273B34" strokeWidth="1.5" strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EAF8F0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
