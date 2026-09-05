import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DEFAULT_ACCENT = '#00B14F';
const DEFAULT_ACCENT_DARK = '#009245';
const SCROLL_DIRECTION_THRESHOLD = 1.5;
const TOP_REVEAL_OFFSET = 8;
const HIDDEN_TRANSLATE_Y = 120;
const ADD_REVEAL_DURATION_MS = 1400;

type CategoryCartDockProps = {
  itemCount: number;
  subtotal: number;
  /**
   * Kept temporarily for backward compatibility with existing callers.
   * The Cart dock no longer displays or enforces a store minimum order.
   */
  minimumOrder: number;
  currencyCode?: string | null;
  accentColor?: string;
  accentDarkColor?: string;
  isScrollingDown: boolean;
  onPress: () => void;
};

function getCurrencyLabel(
  currencyCode: string | null | undefined,
) {
  const normalizedCurrency =
    (currencyCode ?? 'EGP')
      .trim()
      .toUpperCase();

  if (normalizedCurrency === 'EGP') {
    return 'ج.م';
  }

  return normalizedCurrency || 'ج.م';
}

function formatAmount(
  value: number,
  currencyCode: string | null | undefined,
) {
  return `${Number(value ?? 0).toFixed(
    2,
  )} ${getCurrencyLabel(currencyCode)}`;
}

/**
 * Shared vertical-scroll direction detector for every shopping screen.
 *
 * Rules:
 * - scrolling down => hide the Cart dock.
 * - scrolling up => reveal the Cart dock.
 * - when the user returns to the very top => always reveal the Cart dock.
 */
export function useCartDockScrollBehavior() {
  const lastOffsetYRef = useRef(0);
  const directionRef = useRef(false);

  const [isScrollingDown, setIsScrollingDown] =
    useState(false);

  const onScroll = useCallback(
    (
      event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => {
      const nextOffsetY = Math.max(
        0,
        event.nativeEvent.contentOffset.y,
      );

      const delta =
        nextOffsetY - lastOffsetYRef.current;

      if (nextOffsetY <= TOP_REVEAL_OFFSET) {
        if (directionRef.current) {
          directionRef.current = false;
          setIsScrollingDown(false);
        }
      } else if (
        delta > SCROLL_DIRECTION_THRESHOLD &&
        !directionRef.current
      ) {
        directionRef.current = true;
        setIsScrollingDown(true);
      } else if (
        delta < -SCROLL_DIRECTION_THRESHOLD &&
        directionRef.current
      ) {
        directionRef.current = false;
        setIsScrollingDown(false);
      }

      lastOffsetYRef.current = nextOffsetY;
    },
    [],
  );

  return {
    isScrollingDown,
    onScroll,
  };
}

export default function CategoryCartDock({
  itemCount,
  subtotal,
  currencyCode = 'EGP',
  accentColor = DEFAULT_ACCENT,
  accentDarkColor = DEFAULT_ACCENT_DARK,
  isScrollingDown,
  onPress,
}: CategoryCartDockProps) {
  const insets = useSafeAreaInsets();

  const visibilityAnimation = useRef(
    new Animated.Value(1),
  ).current;

  const previousItemCountRef = useRef(
    itemCount,
  );

  const addRevealTimerRef = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  const [
    forceRevealAfterAdd,
    setForceRevealAfterAdd,
  ] = useState(false);

  const normalizedSubtotal = Math.max(
    Number(subtotal ?? 0),
    0,
  );

  useEffect(() => {
    const previousItemCount =
      previousItemCountRef.current;

    previousItemCountRef.current =
      itemCount;

    if (
      itemCount <= 0 ||
      itemCount <= previousItemCount
    ) {
      return;
    }

    setForceRevealAfterAdd(true);

    if (addRevealTimerRef.current) {
      clearTimeout(
        addRevealTimerRef.current,
      );
    }

    addRevealTimerRef.current =
      setTimeout(() => {
        setForceRevealAfterAdd(false);
        addRevealTimerRef.current = null;
      }, ADD_REVEAL_DURATION_MS);
  }, [itemCount]);

  useEffect(() => {
    return () => {
      if (addRevealTimerRef.current) {
        clearTimeout(
          addRevealTimerRef.current,
        );
      }
    };
  }, []);

  const shouldHideDock =
    itemCount > 0 &&
    isScrollingDown &&
    !forceRevealAfterAdd;

  useEffect(() => {
    Animated.timing(
      visibilityAnimation,
      {
        toValue: shouldHideDock ? 0 : 1,
        duration: 175,
        useNativeDriver: true,
      },
    ).start();
  }, [
    shouldHideDock,
    visibilityAnimation,
  ]);

  if (itemCount <= 0) {
    return null;
  }

  const dockTranslateY =
    visibilityAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [HIDDEN_TRANSLATE_Y, 0],
    });

  return (
    <Animated.View
      pointerEvents={
        shouldHideDock ? 'none' : 'box-none'
      }
      style={[
        styles.wrapper,
        {
          opacity: visibilityAnimation,
          paddingBottom: Math.max(
            insets.bottom,
            12,
          ),
          transform: [
            {
              translateY: dockTranslateY,
            },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`عرض السلة، ${itemCount} منتجات، الإجمالي ${formatAmount(
          normalizedSubtotal,
          currencyCode,
        )}`}
        style={({ pressed }) => [
          styles.basketButton,
          {
            backgroundColor: accentColor,
          },
          pressed && styles.basketButtonPressed,
        ]}
        onPress={onPress}
      >
        <Text
          style={styles.basketTotal}
          numberOfLines={1}
        >
          {formatAmount(
            normalizedSubtotal,
            currencyCode,
          )}
        </Text>

        <Text style={styles.basketButtonTitle}>
          عرض السلة
        </Text>

        <View
          style={[
            styles.basketCount,
            {
              backgroundColor:
                accentDarkColor,
            },
          ]}
        >
          <Text style={styles.basketCountText}>
            {itemCount}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#EEEEEE',
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    elevation: 18,
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    position: 'absolute',
    right: 0,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    zIndex: 999,
  },

  basketButton: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    height: 56,
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },

  basketButtonPressed: {
    opacity: 0.9,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  basketTotal: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    minWidth: 90,
    paddingLeft: 10,
    textAlign: 'left',
  },

  basketButtonTitle: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  basketCount: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },

  basketCountText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
});
