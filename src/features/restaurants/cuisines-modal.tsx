import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  type PanResponderGestureState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  NAVIENTY_NOW_COLORS,
} from '../../theme/navienty-now-theme';
import {
  CUISINES,
  type CuisineKey,
} from './restaurants-domain';

type CuisinesModalProps = {
  draftCuisineKey: CuisineKey | null;
  visible: boolean;
  onApply: () => void;
  onClose: () => void;
  onReset: () => void;
  onToggleCuisine: (cuisineKey: CuisineKey) => void;
};

function isMostlyVerticalDownGesture(
  gestureState: PanResponderGestureState,
  minimumDistance: number,
): boolean {
  return (
    gestureState.dy > minimumDistance &&
    Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
  );
}

export function CuisinesModal({
  draftCuisineKey,
  onApply,
  onClose,
  onReset,
  onToggleCuisine,
  visible,
}: CuisinesModalProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const sheetFooterBottomPadding =
    Platform.OS === 'android'
      ? Math.max(48, insets.bottom + 24)
      : Math.max(30, insets.bottom + 8);

  const cuisinesGridBottomPadding =
    Platform.OS === 'android'
      ? 130 + Math.max(18, sheetFooterBottomPadding - 30)
      : 130 + Math.max(0, sheetFooterBottomPadding - 30);

  const viewResultsButtonHeight =
    Platform.OS === 'android' ? 54 : 62;

  const viewResultsButtonFontSize =
    Platform.OS === 'android' ? 16 : 18;

  const sheetTranslateY = useRef(
    new Animated.Value(windowHeight),
  ).current;
  const isClosingRef = useRef(false);
  const cuisineScrollOffsetRef = useRef(0);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = visible;

    if (!visible) {
      cuisineScrollOffsetRef.current = 0;
      return;
    }

    isClosingRef.current = false;
    sheetTranslateY.stopAnimation();

    if (!wasVisible) {
      sheetTranslateY.setValue(windowHeight);

      Animated.spring(sheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 24,
        stiffness: 240,
        mass: 0.85,
      }).start();
    } else {
      // Keep the sheet open if the window dimensions change while visible.
      sheetTranslateY.setValue(0);
    }
  }, [sheetTranslateY, visible, windowHeight]);

  useEffect(
    () => () => {
      sheetTranslateY.stopAnimation();
    },
    [sheetTranslateY],
  );

  const animateSheetBack = useCallback(() => {
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 260,
      mass: 0.8,
    }).start();
  }, [sheetTranslateY]);

  const requestClose = useCallback(() => {
    if (isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;
    sheetTranslateY.stopAnimation();

    Animated.timing(sheetTranslateY, {
      toValue: windowHeight,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        isClosingRef.current = false;
        return;
      }

      isClosingRef.current = false;
      onClose();
    });
  }, [onClose, sheetTranslateY, windowHeight]);

  const requestApply = useCallback(() => {
    if (isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;
    sheetTranslateY.stopAnimation();

    Animated.timing(sheetTranslateY, {
      toValue: windowHeight,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        isClosingRef.current = false;
        return;
      }

      isClosingRef.current = false;
      onApply();
    });
  }, [onApply, sheetTranslateY, windowHeight]);

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,

        onMoveShouldSetPanResponder: (_event, gestureState) => {
          const isAtTop = cuisineScrollOffsetRef.current <= 1;
          const minimumDistance = Platform.OS === 'android' ? 2 : 4;

          return (
            isAtTop &&
            isMostlyVerticalDownGesture(
              gestureState,
              minimumDistance,
            )
          );
        },

        onMoveShouldSetPanResponderCapture: (
          _event,
          gestureState,
        ) => {
          const isAtTop = cuisineScrollOffsetRef.current <= 1;
          const minimumDistance = Platform.OS === 'android' ? 2 : 4;

          return (
            isAtTop &&
            isMostlyVerticalDownGesture(
              gestureState,
              minimumDistance,
            )
          );
        },

        onPanResponderGrant: () => {
          sheetTranslateY.stopAnimation();
        },

        onPanResponderMove: (_event, gestureState) => {
          sheetTranslateY.setValue(
            Math.min(
              windowHeight,
              Math.max(0, gestureState.dy),
            ),
          );
        },

        onPanResponderRelease: (_event, gestureState) => {
          const shouldClose =
            gestureState.dy >
              (Platform.OS === 'android' ? 82 : 110) ||
            (gestureState.dy > 20 &&
              gestureState.vy >
                (Platform.OS === 'android' ? 0.68 : 0.9));

          if (shouldClose) {
            requestClose();
            return;
          }

          animateSheetBack();
        },

        onPanResponderTerminate: animateSheetBack,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [
      animateSheetBack,
      requestClose,
      sheetTranslateY,
      windowHeight,
    ],
  );

  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          Platform.OS === 'android',
        onStartShouldSetPanResponderCapture: () =>
          Platform.OS === 'android',

        onMoveShouldSetPanResponder: (_event, gestureState) =>
          isMostlyVerticalDownGesture(gestureState, 1),

        onMoveShouldSetPanResponderCapture: (
          _event,
          gestureState,
        ) => isMostlyVerticalDownGesture(gestureState, 1),

        onPanResponderGrant: () => {
          sheetTranslateY.stopAnimation();
        },

        onPanResponderMove: (_event, gestureState) => {
          sheetTranslateY.setValue(
            Math.min(
              windowHeight,
              Math.max(0, gestureState.dy),
            ),
          );
        },

        onPanResponderRelease: (_event, gestureState) => {
          const shouldClose =
            gestureState.dy >
              (Platform.OS === 'android' ? 64 : 100) ||
            (gestureState.dy > 16 &&
              gestureState.vy >
                (Platform.OS === 'android' ? 0.55 : 0.85));

          if (shouldClose) {
            requestClose();
            return;
          }

          animateSheetBack();
        },

        onPanResponderTerminate: animateSheetBack,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [
      animateSheetBack,
      requestClose,
      sheetTranslateY,
      windowHeight,
    ],
  );

  return (
    <Modal
      animationType="none"
      statusBarTranslucent
      transparent
      visible={visible}
      onRequestClose={requestClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable
          accessibilityLabel="إغلاق قائمة المطابخ"
          accessibilityRole="button"
          style={styles.modalBackdropPressable}
          onPress={requestClose}
        />

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.cuisinesSheet,
            {
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
          {...sheetPanResponder.panHandlers}
        >
          <View style={styles.sheetDragArea}>
            <View
              collapsable={false}
              style={styles.sheetHandleTouchArea}
              {...handlePanResponder.panHandlers}
            >
              <View style={styles.sheetHandle} />
            </View>

            <View style={styles.sheetHeader}>
              <Pressable
                accessibilityLabel="إغلاق"
                accessibilityRole="button"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.sheetCircleButton,
                  pressed && styles.pressed,
                ]}
                onPress={requestClose}
              >
                <Text style={styles.sheetCloseIcon}>×</Text>
              </Pressable>

              <Text style={styles.sheetTitle}>المطابخ</Text>

              <Pressable
                accessibilityLabel="إعادة تعيين المطابخ"
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.resetCuisineButton,
                  pressed && styles.pressed,
                ]}
                onPress={onReset}
              >
                <Text style={styles.resetCuisineButtonText}>
                  إعادة
                </Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            bounces={Platform.OS === 'ios'}
            contentContainerStyle={[
              styles.cuisinesGrid,
              {
                paddingBottom: cuisinesGridBottomPadding,
              },
            ]}
            nestedScrollEnabled
            overScrollMode="never"
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            onScroll={(event) => {
              cuisineScrollOffsetRef.current = Math.max(
                0,
                event.nativeEvent.contentOffset.y,
              );
            }}
          >
            {[...CUISINES].reverse().map((cuisine) => {
              const active = draftCuisineKey === cuisine.key;

              return (
                <Pressable
                  key={cuisine.key}
                  accessibilityLabel={cuisine.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.cuisineGridItem,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => onToggleCuisine(cuisine.key)}
                >
                  <View
                    style={[
                      styles.cuisineGridImage,
                      active && styles.cuisineGridImageActive,
                    ]}
                  >
                    <Image
                      accessibilityIgnoresInvertColors
                      accessibilityLabel={`صورة ${cuisine.label}`}
                      resizeMode="cover"
                      source={cuisine.image}
                      style={styles.cuisineGridPhoto}
                    />
                  </View>

                  <Text
                    numberOfLines={1}
                    style={[
                      styles.cuisineGridLabel,
                      active && styles.cuisineGridLabelActive,
                    ]}
                  >
                    {cuisine.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View
            style={[
              styles.sheetFooter,
              {
                paddingBottom: sheetFooterBottomPadding,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.viewResultsButton,
                {
                  minHeight: viewResultsButtonHeight,
                },
                pressed && styles.pressed,
              ]}
              onPress={requestApply}
            >
              <Text
                style={[
                  styles.viewResultsButtonText,
                  {
                    fontSize: viewResultsButtonFontSize,
                  },
                ]}
              >
                عرض النتائج
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    backgroundColor: 'rgba(18,18,20,0.34)',
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalBackdropPressable: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  cuisinesSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '90%',
    overflow: 'hidden',
    paddingTop: 0,
  },

  sheetDragArea: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },

  sheetHandleTouchArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Platform.OS === 'android' ? 44 : 28,
    paddingTop: 7,
  },

  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#E4E4E7',
    borderRadius: 999,
    height: 5,
    width: 74,
  },

  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingHorizontal: 24,
    paddingTop: 3,
  },

  sheetCircleButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E3E6',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },

  sheetCloseIcon: {
    color: '#151518',
    fontSize: 26,
    fontWeight: '300',
    lineHeight: 28,
  },

  sheetTitle: {
    color: '#18181B',
    fontSize: 18,
    fontWeight: '900',
  },

  resetCuisineButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E3E6',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  resetCuisineButtonText: {
    color: '#1C1C1F',
    fontSize: 11,
    fontWeight: '800',
  },

  cuisinesGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    paddingBottom: 130,
    paddingHorizontal: 14,
    paddingTop: 15,
  },

  cuisineGridItem: {
    alignItems: 'center',
    marginBottom: 22,
    width: '25%',
  },

  cuisineGridImage: {
    alignItems: 'center',
    backgroundColor: '#F4F2EF',
    borderColor: '#EEEEF0',
    borderRadius: 41,
    borderWidth: 1,
    height: 82,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#111111',
    shadowOffset: {
      height: 2,
      width: 0,
    },
    shadowOpacity: 0.09,
    shadowRadius: 5,
    width: 82,
  },

  cuisineGridImageActive: {
    backgroundColor: '#EAF8F0',
    borderColor: NAVIENTY_NOW_COLORS.primary,
    borderWidth: 2,
  },

  cuisineGridPhoto: {
    borderRadius: 41,
    height: '100%',
    width: '100%',
  },

  cuisineGridLabel: {
    color: '#6B6B70',
    fontSize: 11,
    marginTop: 8,
    maxWidth: 88,
    textAlign: 'center',
  },

  cuisineGridLabelActive: {
    color: NAVIENTY_NOW_COLORS.primary,
    fontWeight: '900',
  },

  sheetFooter: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#EEEEF0',
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingHorizontal: 25,
    paddingTop: 20,
    position: 'absolute',
    right: 0,
  },

  viewResultsButton: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.primary,
    borderRadius: 999,
    justifyContent: 'center',
  },

  viewResultsButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.985 }],
  },
});
