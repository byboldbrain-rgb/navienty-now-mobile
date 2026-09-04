import { Ionicons } from '@expo/vector-icons';
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
const FULL_BUTTON_BLOCK_HEIGHT = 67;
const HIDDEN_TRANSLATE_Y = 170;

type CategoryCartDockProps = {
  itemCount: number;
  subtotal: number;
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
 * - scrolling down => compact/hide Cart dock depending on minimum order.
 * - scrolling up => reveal the full Cart dock.
 * - when the user returns to the very top => always reveal the full Cart dock.
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
  minimumOrder,
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

  const buttonAnimation = useRef(
    new Animated.Value(1),
  ).current;

  const normalizedSubtotal = Math.max(
    Number(subtotal ?? 0),
    0,
  );

  const normalizedMinimumOrder = Math.max(
    Number(minimumOrder ?? 0),
    0,
  );

  const amountRemaining = Math.max(
    normalizedMinimumOrder - normalizedSubtotal,
    0,
  );

  const minimumReached =
    normalizedMinimumOrder <= 0 ||
    amountRemaining <= 0;

  const orderProgress =
    normalizedMinimumOrder <= 0
      ? itemCount > 0
        ? 1
        : 0
      : Math.min(
          normalizedSubtotal /
            normalizedMinimumOrder,
          1,
        );

  const shouldHideDock =
    itemCount > 0 &&
    isScrollingDown &&
    minimumReached;

  const shouldShowFullDock =
    itemCount > 0 &&
    !isScrollingDown;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(
        visibilityAnimation,
        {
          toValue: shouldHideDock ? 0 : 1,
          duration: 175,
          useNativeDriver: true,
        },
      ),
      Animated.timing(
        buttonAnimation,
        {
          toValue: shouldShowFullDock ? 1 : 0,
          duration: 175,
          useNativeDriver: false,
        },
      ),
    ]).start();
  }, [
    buttonAnimation,
    shouldHideDock,
    shouldShowFullDock,
    visibilityAnimation,
  ]);

  if (itemCount <= 0) {
    return null;
  }

  const message = minimumReached
    ? 'طلبك جاهز!'
    : `أضف منتجات بقيمة ${formatAmount(
        amountRemaining,
        currencyCode,
      )} إلى طلبك!`;

  const dockTranslateY =
    visibilityAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [HIDDEN_TRANSLATE_Y, 0],
    });

  const buttonBlockHeight =
    buttonAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, FULL_BUTTON_BLOCK_HEIGHT],
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
      <View style={styles.messageRow}>
        <Ionicons
          name="bag-handle"
          size={25}
          color="#242424"
        />

        <Text
          style={styles.messageText}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
        >
          {message}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressValue,
            {
              width: `${orderProgress * 100}%`,
            },
          ]}
        />
      </View>

      <Animated.View
        pointerEvents={
          shouldShowFullDock ? 'auto' : 'none'
        }
        style={[
          styles.buttonClip,
          {
            height: buttonBlockHeight,
            opacity: buttonAnimation,
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

  messageRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    minHeight: 28,
  },

  messageText: {
    color: '#242424',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    marginRight: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  progressTrack: {
    backgroundColor: '#E7E7E7',
    borderRadius: 999,
    height: 5,
    marginTop: 10,
    overflow: 'hidden',
    width: '100%',
  },

  progressValue: {
    backgroundColor: '#202020',
    borderRadius: 999,
    height: '100%',
  },

  buttonClip: {
    overflow: 'hidden',
    width: '100%',
  },

  basketButton: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    height: 56,
    justifyContent: 'space-between',
    marginTop: 11,
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
