import { Ionicons } from '@expo/vector-icons';
import {
    Stack,
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Animated,
    Easing,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Svg, {
    Circle,
    Defs,
    G,
    Path,
    Stop,
    LinearGradient as SvgLinearGradient,
} from 'react-native-svg';

import {
    supabase
} from '../lib/supabase';
import {
    type CatalogProduct,
    type StoreCatalog,
    getStoreCatalog,
} from '../services/catalog-service';

import {
    ensureAppSession,
} from '../services/anonymous-auth-service';
import {
    validateVoucher,
} from '../services/voucher-service';

import ServicePackageCart from '../components/service/service-package-cart';
import {
    useCartStore,
} from '../store/cart-store';
import {
    useCustomerStore,
} from '../store/customer-store';
import {
    useOrderNotesStore,
} from '../store/order-notes-store';
import {
    useVoucherStore,
} from '../store/voucher-store';

const BRAND_GREEN = '#00B14F';
const BRAND_GREEN_SOFT = '#EAF8F0';
const EMPTY_CART_ACCENT_GREEN = '#20CB6B';
const EMPTY_CART_DARK = '#1F2421';
const EMPTY_CART_MINT = '#ECFAF2';
const EMPTY_CART_MINT_DEEP = '#BDEFD1';

const LAUNDRY_CART_IMAGE = require(
  '../assets/icons/categories/laundry.webp',
);

const REQUEST_ANYTHING_CART_IMAGE = require(
  '../assets/icons/categories/request-anything.webp',
);

const REQUEST_ANYTHING_CATEGORY_ALIASES = new Set([
  'request-anything',
  'anything',
  'other',
  'special-request',
]);

const LAUNDRY_CATEGORY_ALIASES = new Set([
  'laundry',
  'laundry-ironing',
  'wash-and-iron',
  'washing-ironing',
]);

const PERSONAL_CARE_CATEGORY_ALIASES = new Set([
  'personal-care',
  'personalcare',
  'beauty',
  'beauty-care',
  'health-beauty',
]);

const SUPERMARKET_CATEGORY_ALIASES = new Set([
  'supermarket',
  'supermarkets',
  'market',
  'grocery',
  'groceries',
]);

const BOOKSTORE_CATEGORY_ALIASES = new Set([
  'bookstore',
  'bookstores',
  'library',
  'books',
  'stationery',
]);

const PHARMACY_CATEGORY_ALIASES = new Set([
  'pharmacy',
  'pharmacies',
]);

const RESTAURANT_CATEGORY_ALIASES = new Set([
  'restaurant',
  'restaurants',
  'food',
]);

function normalizeCategorySlug(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

function isLaundryCategory(
  value: string | null | undefined,
) {
  return LAUNDRY_CATEGORY_ALIASES.has(
    normalizeCategorySlug(value),
  );
}

function isRequestAnythingCategory(
  value: string | null | undefined,
) {
  return REQUEST_ANYTHING_CATEGORY_ALIASES.has(
    normalizeCategorySlug(value),
  );
}

/**
 * Electronic payment fee remains fixed for now.
 * Delivery fee is store/area-specific and comes from the cart/catalog.
 */
const FIXED_PAYMENT_PROCESSING_FEE = 10;


/* ============================================================
 * CART SPIN — V1 / SUPABASE BACKEND
 * ============================================================
 *
 * Supabase is the source of truth for eligibility, one-spin protection,
 * reward selection, daily budget guardrails, and persistence. The app only
 * sends the current cart and reveals the committed server result.
 */

const SPIN_UNLOCK_SUBTOTAL_FALLBACK = 200;
const SPIN_ANIMATION_DURATION_MS = 2600;

type SpinMode =
  | 'welcome'
  | 'standard';

type SpinRewardType =
  | 'current_order_discount'
  | 'next_order_discount'
  | 'processing_fee_waiver';

type SpinRewardDefinition = {
  id: string;
  type: SpinRewardType;
  value: number;
  weight: number;
  wheelLabel: string;
  minimumNextOrder: number | null;
};

type ServerSpinSession = {
  id: string;
  storeId: string;
  mode: SpinMode;
  reward: SpinRewardDefinition;
  subtotalAtSpin: number;
  claimedAt: number;
  expiresAt: number | null;
  wheelIndex: number;
  rewardStatus: string | null;
};

type SpinRpcReward = {
  code?: string | null;
  type?: string | null;
  value?: number | string | null;
  wheel_index?: number | string | null;
  minimum_next_order?: number | string | null;
  expires_at?: string | null;
  reward_status?: string | null;
};

type SpinRpcEvent = {
  id?: string | null;
  mode?: string | null;
  store_id?: string | null;
  subtotal_at_spin?: number | string | null;
  claimed_at?: string | null;
  reward?: SpinRpcReward | null;
};

type SpinStatusRpcResponse = {
  enabled?: boolean | null;
  mode?: string | null;
  unlock_subtotal?: number | string | null;
  has_existing_spin?: boolean | null;
  event?: SpinRpcEvent | null;
};

type SpinClaimRpcResponse = {
  reused?: boolean | null;
  enabled?: boolean | null;
  unlock_subtotal?: number | string | null;
  event?: SpinRpcEvent | null;
};

/**
 * These probabilities are the V1 business distribution we agreed on.
 * The visual wheel always has 8 equal reward positions; the weights are
 * business weights, not visual geometry.
 */
const STANDARD_SPIN_REWARDS: readonly SpinRewardDefinition[] = [
  {
    id: 'standard-now-5',
    type: 'current_order_discount',
    value: 5,
    weight: 35,
    wheelLabel: '5ج',
    minimumNextOrder: null,
  },
  {
    id: 'standard-next-10',
    type: 'next_order_discount',
    value: 10,
    weight: 12,
    wheelLabel: '10ج\nالجاي',
    minimumNextOrder: 150,
  },
  {
    id: 'standard-now-7',
    type: 'current_order_discount',
    value: 7,
    weight: 25,
    wheelLabel: '7ج',
    minimumNextOrder: null,
  },
  {
    id: 'standard-next-15',
    type: 'next_order_discount',
    value: 15,
    weight: 7,
    wheelLabel: '15ج\nالجاي',
    minimumNextOrder: 200,
  },
  {
    id: 'standard-now-10',
    type: 'current_order_discount',
    value: 10,
    weight: 8,
    wheelLabel: '10ج',
    minimumNextOrder: null,
  },
  {
    id: 'standard-next-20',
    type: 'next_order_discount',
    value: 20,
    weight: 4,
    wheelLabel: '20ج\nالجاي',
    minimumNextOrder: 250,
  },
  {
    id: 'standard-fee-10',
    type: 'processing_fee_waiver',
    value: 10,
    weight: 7,
    wheelLabel: 'الرسوم\nعلينا',
    minimumNextOrder: null,
  },
  {
    id: 'standard-next-25',
    type: 'next_order_discount',
    value: 25,
    weight: 2,
    wheelLabel: '25ج\nالجاي',
    minimumNextOrder: 300,
  },
];

const WELCOME_SPIN_REWARDS: readonly SpinRewardDefinition[] = [
  {
    id: 'welcome-now-3',
    type: 'current_order_discount',
    value: 3,
    weight: 35,
    wheelLabel: '3ج',
    minimumNextOrder: null,
  },
  {
    id: 'welcome-next-10',
    type: 'next_order_discount',
    value: 10,
    weight: 10,
    wheelLabel: '10ج\nالجاي',
    minimumNextOrder: 150,
  },
  {
    id: 'welcome-now-5',
    type: 'current_order_discount',
    value: 5,
    weight: 25,
    wheelLabel: '5ج',
    minimumNextOrder: null,
  },
  {
    id: 'welcome-next-15',
    type: 'next_order_discount',
    value: 15,
    weight: 7,
    wheelLabel: '15ج\nالجاي',
    minimumNextOrder: 200,
  },
  {
    id: 'welcome-now-7',
    type: 'current_order_discount',
    value: 7,
    weight: 10,
    wheelLabel: '7ج',
    minimumNextOrder: null,
  },
  {
    id: 'welcome-next-20',
    type: 'next_order_discount',
    value: 20,
    weight: 4,
    wheelLabel: '20ج\nالجاي',
    minimumNextOrder: 250,
  },
  {
    id: 'welcome-fee-10',
    type: 'processing_fee_waiver',
    value: 10,
    weight: 7,
    wheelLabel: 'الرسوم\nعلينا',
    minimumNextOrder: null,
  },
  {
    id: 'welcome-next-25',
    type: 'next_order_discount',
    value: 25,
    weight: 2,
    wheelLabel: '25ج\nالجاي',
    minimumNextOrder: 300,
  },
];

function getSpinRewards(
  mode: SpinMode,
) {
  return mode === 'welcome'
    ? WELCOME_SPIN_REWARDS
    : STANDARD_SPIN_REWARDS;
}

function normalizeSpinMode(
  value: string | null | undefined,
): SpinMode {
  return value === 'standard'
    ? 'standard'
    : 'welcome';
}

function normalizeSpinRewardType(
  value: string | null | undefined,
): SpinRewardType | null {
  if (
    value === 'current_order_discount' ||
    value === 'next_order_discount' ||
    value === 'processing_fee_waiver'
  ) {
    return value;
  }

  return null;
}

function numericOrFallback(
  value: number | string | null | undefined,
  fallback = 0,
) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : fallback;
}

function parseSpinTimestamp(
  value: string | null | undefined,
) {
  if (!value) {
    return Date.now();
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed)
    ? parsed
    : Date.now();
}

function createServerSpinSession(
  event: SpinRpcEvent | null | undefined,
): ServerSpinSession | null {
  if (
    !event?.id ||
    !event.store_id ||
    !event.reward
  ) {
    return null;
  }

  const mode = normalizeSpinMode(
    event.mode,
  );
  const rewardType =
    normalizeSpinRewardType(
      event.reward.type,
    );

  if (!rewardType) {
    return null;
  }

  const fullRewardSet =
    getSpinRewards(mode);

  const rawWheelIndex = Math.trunc(
    numericOrFallback(
      event.reward.wheel_index,
      0,
    ),
  );
  const wheelIndex = Math.min(
    Math.max(rawWheelIndex, 0),
    fullRewardSet.length - 1,
  );
  const visualReward =
    fullRewardSet[wheelIndex];

  const minimumNextOrder =
    event.reward.minimum_next_order === null ||
    event.reward.minimum_next_order === undefined
      ? null
      : numericOrFallback(
          event.reward.minimum_next_order,
          visualReward.minimumNextOrder ?? 0,
        );

  const expiresAt = event.reward.expires_at
    ? Date.parse(event.reward.expires_at)
    : NaN;

  return {
    id: event.id,
    storeId: event.store_id,
    mode,
    reward: {
      ...visualReward,
      type: rewardType,
      value: numericOrFallback(
        event.reward.value,
        visualReward.value,
      ),
      minimumNextOrder,
    },
    subtotalAtSpin: numericOrFallback(
      event.subtotal_at_spin,
      0,
    ),
    claimedAt: parseSpinTimestamp(
      event.claimed_at,
    ),
    expiresAt: Number.isFinite(expiresAt)
      ? expiresAt
      : null,
    wheelIndex,
    rewardStatus:
      event.reward.reward_status ?? null,
  };
}

function getSpinErrorMessage(
  error: unknown,
) {
  const rawMessage =
    error &&
    typeof error === 'object' &&
    'message' in error
      ? String(
          (error as { message?: unknown })
            .message ?? '',
        )
      : '';

  if (rawMessage.includes('spin_subtotal_not_reached')) {
    return 'السلة لسه موصلتش لقيمة فتح المكافأة.';
  }

  if (rawMessage.includes('store_not_available')) {
    return 'المتجر غير متاح حاليًا.';
  }

  if (
    rawMessage.includes('product_not_available') ||
    rawMessage.includes('product_variant_not_available') ||
    rawMessage.includes('product_variant_required')
  ) {
    return 'بعض منتجات السلة اتغيرت. حدّث السلة وحاول تاني.';
  }

  return 'تعذر تحميل مكافأتك حاليًا. حاول مرة أخرى.';
}

type SpinWheelGraphicProps = {
  rewards:
    readonly SpinRewardDefinition[];
  rotation: Animated.Value;
};

type Point = {
  x: number;
  y: number;
};

function polarPoint(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
): Point {
  const angleInRadians =
    (angleInDegrees - 90) *
    (Math.PI / 180);

  return {
    x:
      centerX +
      radius * Math.cos(angleInRadians),
    y:
      centerY +
      radius * Math.sin(angleInRadians),
  };
}

function describeWheelSector(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarPoint(
    centerX,
    centerY,
    radius,
    endAngle,
  );
  const end = polarPoint(
    centerX,
    centerY,
    radius,
    startAngle,
  );

  const largeArcFlag =
    endAngle - startAngle <= 180
      ? '0'
      : '1';

  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

const PREMIUM_WHEEL_SIZE = 220;
const PREMIUM_WHEEL_CENTER =
  PREMIUM_WHEEL_SIZE / 2;
const PREMIUM_WHEEL_RADIUS = 102;
const PREMIUM_WHEEL_LABEL_RADIUS = 72;

const PREMIUM_WHEEL_FILLS = [
  'url(#brandSegment)',
  'url(#softSegment)',
  'url(#deepSegment)',
  'url(#mintSegment)',
  'url(#brandSegment)',
  'url(#softSegment)',
  'url(#deepSegment)',
  'url(#mintSegment)',
] as const;

function SpinWheelGraphic({
  rewards,
  rotation,
}: SpinWheelGraphicProps) {
  const wheelRotation =
    rotation.interpolate({
      inputRange: [0, 20],
      outputRange: [
        '0deg',
        '7200deg',
      ],
    });

  const sectorAngle =
    360 / rewards.length;

  return (
    <View style={styles.spinWheelStage}>
      <View style={styles.spinWheelHaloOuter} />
      <View style={styles.spinWheelHaloInner} />

      <View style={styles.spinWheelPointerWrap}>
        <View style={styles.spinWheelPointerCap}>
          <View style={styles.spinWheelPointerDot} />
        </View>
        <View style={styles.spinWheelPointerTip} />
      </View>

      <Animated.View
        style={[
          styles.spinWheelAssembly,
          {
            transform: [
              {
                rotate: wheelRotation,
              },
            ],
          },
        ]}
      >
        <View style={styles.spinWheelOuterRim}>
          <View style={styles.spinWheelRimHighlight} />

          <Svg
            width={PREMIUM_WHEEL_SIZE}
            height={PREMIUM_WHEEL_SIZE}
            viewBox={`0 0 ${PREMIUM_WHEEL_SIZE} ${PREMIUM_WHEEL_SIZE}`}
            style={styles.spinWheelSvg}
          >
            <Defs>
              <SvgLinearGradient
                id="brandSegment"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <Stop
                  offset="0"
                  stopColor="#20CB6B"
                />
                <Stop
                  offset="1"
                  stopColor="#00A94B"
                />
              </SvgLinearGradient>

              <SvgLinearGradient
                id="deepSegment"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <Stop
                  offset="0"
                  stopColor="#0A7242"
                />
                <Stop
                  offset="1"
                  stopColor="#05472C"
                />
              </SvgLinearGradient>

              <SvgLinearGradient
                id="softSegment"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <Stop
                  offset="0"
                  stopColor="#FFFFFF"
                />
                <Stop
                  offset="1"
                  stopColor="#ECF9F1"
                />
              </SvgLinearGradient>

              <SvgLinearGradient
                id="mintSegment"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <Stop
                  offset="0"
                  stopColor="#E0F8EA"
                />
                <Stop
                  offset="1"
                  stopColor="#BCECCF"
                />
              </SvgLinearGradient>
            </Defs>

            <G>
              {rewards.map(
                (reward, index) => {
                  const centerAngle =
                    index * sectorAngle;
                  const startAngle =
                    centerAngle -
                    sectorAngle / 2;
                  const endAngle =
                    centerAngle +
                    sectorAngle / 2;

                  return (
                    <Path
                      key={reward.id}
                      d={describeWheelSector(
                        PREMIUM_WHEEL_CENTER,
                        PREMIUM_WHEEL_CENTER,
                        PREMIUM_WHEEL_RADIUS,
                        startAngle,
                        endAngle,
                      )}
                      fill={
                        PREMIUM_WHEEL_FILLS[
                          index %
                            PREMIUM_WHEEL_FILLS.length
                        ]
                      }
                      stroke="rgba(255,255,255,0.72)"
                      strokeWidth={1.4}
                    />
                  );
                },
              )}
            </G>

            <Circle
              cx={PREMIUM_WHEEL_CENTER}
              cy={PREMIUM_WHEEL_CENTER}
              r={110}
              fill="none"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth={1}
            />

            <Circle
              cx={PREMIUM_WHEEL_CENTER}
              cy={PREMIUM_WHEEL_CENTER}
              r={106}
              fill="none"
              stroke="rgba(255,255,255,0.33)"
              strokeWidth={1.2}
              strokeDasharray="2 9"
            />

            <Circle
              cx={PREMIUM_WHEEL_CENTER}
              cy={PREMIUM_WHEEL_CENTER}
              r={48}
              fill="rgba(255,255,255,0.20)"
              stroke="rgba(255,255,255,0.56)"
              strokeWidth={1.2}
            />
          </Svg>

          {rewards.map(
            (reward, index) => {
              const angle =
                -90 +
                index * sectorAngle;
              const angleInRadians =
                angle *
                (Math.PI / 180);

              const labelWidth = 52;
              const labelHeight = 30;

              const left =
                PREMIUM_WHEEL_CENTER +
                PREMIUM_WHEEL_LABEL_RADIUS *
                  Math.cos(
                    angleInRadians,
                  ) -
                labelWidth / 2;

              const top =
                PREMIUM_WHEEL_CENTER +
                PREMIUM_WHEEL_LABEL_RADIUS *
                  Math.sin(
                    angleInRadians,
                  ) -
                labelHeight / 2;

              const labelParts =
                reward.wheelLabel.split(
                  '\n',
                );

              const lightText =
                index === 0 ||
                index === 2 ||
                index === 4 ||
                index === 6;

              return (
                <View
                  key={`${reward.id}-label`}
                  pointerEvents="none"
                  style={[
                    styles.spinWheelLabel,
                    {
                      left,
                      top,
                      width: labelWidth,
                      height: labelHeight,
                      transform: [
                        {
                          rotate: `${index * sectorAngle}deg`,
                        },
                      ],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.spinWheelLabelMain,
                      lightText
                        ? styles.spinWheelLabelLight
                        : styles.spinWheelLabelDark,
                    ]}
                    numberOfLines={1}
                  >
                    {labelParts[0]}
                  </Text>

                  {labelParts[1] ? (
                    <Text
                      style={[
                        styles.spinWheelLabelSub,
                        lightText
                          ? styles.spinWheelLabelLightMuted
                          : styles.spinWheelLabelDarkMuted,
                      ]}
                      numberOfLines={1}
                    >
                      {labelParts[1]}
                    </Text>
                  ) : null}
                </View>
              );
            },
          )}
        </View>
      </Animated.View>

      <View style={styles.spinWheelCenterShadow}>
        <View style={styles.spinWheelCenterOuter}>
          <View style={styles.spinWheelCenterInner}>
            <View style={styles.spinWheelCenterShine} />

            <Text
              style={styles.spinWheelCenterText}
            >
              لف
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Keep Cart's route options aligned with the rest of the app.
 *
 * Cart details are a normal native-stack card, so iOS uses the same
 * platform back gesture as screens such as Restaurants.
 */
const CART_SCREEN_OPTIONS = {
  headerShown: false,
};

function getSingleParam(
  value:
    | string
    | string[]
    | undefined,
) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function isImageUri(
  value: string | null | undefined,
) {
  if (!value) {
    return false;
  }

  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file://') ||
    value.startsWith('data:image/')
  );
}

function getProductImage(
  product: CatalogProduct | null | undefined,
): string | null {
  if (!product) {
    return null;
  }

  if (isImageUri(product.imageUrl)) {
    return product.imageUrl;
  }

  const coverImage = product.images?.find(
    (image) =>
      image.isCover &&
      isImageUri(image.imageUrl),
  );

  if (coverImage) {
    return coverImage.imageUrl;
  }

  const firstImage = product.images?.find(
    (image) => isImageUri(image.imageUrl),
  );

  return firstImage?.imageUrl ?? null;
}

function getProductDisplayPrice(
  product: CatalogProduct,
) {
  if (
    !product.variants ||
    product.variants.length === 0
  ) {
    return Number(product.price ?? 0);
  }

  return Math.min(
    ...product.variants.map(
      (variant) => Number(variant.price ?? 0),
    ),
  );
}

function getCartItemCount(
  items: Array<{ quantity: number }>,
) {
  return items.reduce(
    (total, item) =>
      total + Number(item.quantity ?? 0),
    0,
  );
}

function getCartSubtotal(
  items: Array<{
    price: number;
    quantity: number;
  }>,
) {
  return items.reduce(
    (total, item) =>
      total +
      Number(item.price ?? 0) *
        Number(item.quantity ?? 0),
    0,
  );
}

function formatCartItemCount(
  count: number,
) {
  if (count === 1) {
    return 'صنف واحد';
  }

  if (count === 2) {
    return 'صنفان';
  }

  return `${count} أصناف`;
}

function EmptyCartIllustration() {
  return (
    <Svg
      width={188}
      height={178}
      viewBox="0 0 200 190"
      fill="none"
    >
      <Defs>
        <SvgLinearGradient
          id="emptyCartBasket"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <Stop
            offset="0"
            stopColor="#39D77D"
          />
          <Stop
            offset="1"
            stopColor="#00B14F"
          />
        </SvgLinearGradient>
      </Defs>

      <Circle
        cx={100}
        cy={94}
        r={71}
        fill={EMPTY_CART_MINT}
      />

      <Circle
        cx={155}
        cy={34}
        r={10}
        fill={EMPTY_CART_MINT_DEEP}
      />

      <Circle
        cx={41}
        cy={57}
        r={6}
        fill={EMPTY_CART_ACCENT_GREEN}
        opacity={0.42}
      />

      <Path
        d="M59 78H141L132 137C131 145 124 151 116 151H84C76 151 69 145 68 137L59 78Z"
        fill="#FFFFFF"
        stroke={EMPTY_CART_DARK}
        strokeWidth={5.5}
        strokeLinejoin="round"
      />

      <Path
        d="M75 79C78 56 86 45 100 45C114 45 122 56 125 79"
        stroke="url(#emptyCartBasket)"
        strokeWidth={8}
        strokeLinecap="round"
      />

      <Path
        d="M82 96V132"
        stroke={EMPTY_CART_MINT_DEEP}
        strokeWidth={5}
        strokeLinecap="round"
      />

      <Path
        d="M100 96V132"
        stroke={EMPTY_CART_MINT_DEEP}
        strokeWidth={5}
        strokeLinecap="round"
      />

      <Path
        d="M118 96V132"
        stroke={EMPTY_CART_MINT_DEEP}
        strokeWidth={5}
        strokeLinecap="round"
      />

      <Circle
        cx={67}
        cy={161}
        r={7}
        fill={EMPTY_CART_DARK}
      />

      <Circle
        cx={133}
        cy={161}
        r={7}
        fill={EMPTY_CART_DARK}
      />

      <Path
        d="M149 74H168"
        stroke={EMPTY_CART_ACCENT_GREEN}
        strokeWidth={5}
        strokeLinecap="round"
      />

      <Path
        d="M158.5 64.5V83.5"
        stroke={EMPTY_CART_ACCENT_GREEN}
        strokeWidth={5}
        strokeLinecap="round"
      />

      <Path
        d="M35 104L47 92"
        stroke={EMPTY_CART_DARK}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.25}
      />
    </Svg>
  );
}

export default function CartScreen() {
  const params =
    useLocalSearchParams<{
      servicePackageId?:
        | string
        | string[];
    }>();

  const servicePackageId =
    getSingleParam(
      params.servicePackageId,
    )?.trim();

  if (servicePackageId) {
    return (
      <ServicePackageCart
        servicePackageId={
          servicePackageId
        }
      />
    );
  }

  return <StoreCartScreen />;
}

function StoreCartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params =
    useLocalSearchParams<{
      storeId?:
        | string
        | string[];
    }>();

  const requestedStoreId =
    getSingleParam(
      params.storeId,
    );

  const [
    clearModalVisible,
    setClearModalVisible,
  ] = useState(false);

  const [
    catalog,
    setCatalog,
  ] = useState<StoreCatalog | null>(null);

  const [
    failedImages,
    setFailedImages,
  ] = useState<Record<string, boolean>>(
    {},
  );

  /* ============================================================
   * MULTI CART STATE
   * ============================================================
   */

  const carts = useCartStore(
    (state) => state.carts,
  );

  const addItem = useCartStore(
    (state) => state.addItem,
  );

  const setActiveCart = useCartStore(
    (state) => state.setActiveCart,
  );

  const increaseStoreItem = useCartStore(
    (state) => state.increaseStoreItem,
  );

  const decreaseStoreItem = useCartStore(
    (state) => state.decreaseStoreItem,
  );

  const removeStoreItem = useCartStore(
    (state) => state.removeStoreItem,
  );

  const clearStoreCart = useCartStore(
    (state) => state.clearStoreCart,
  );

  const availableCarts = useMemo(
    () =>
      Object.values(carts).filter(
        (cart) => cart.items.length > 0,
      ),
    [carts],
  );

  const hasMultipleCarts =
    availableCarts.length > 1;

  /**
   * Resolve the cart from the route without writing to Zustand from an effect.
   * Explicit user actions remain the only place that changes activeStoreId.
   */
  const singleCartStoreId =
    availableCarts.length === 1
      ? availableCarts[0].storeId
      : null;

  const requestedCartStoreId =
    requestedStoreId &&
    carts[requestedStoreId] &&
    carts[requestedStoreId].items.length > 0
      ? requestedStoreId
      : null;

  const resolvedStoreId =
    requestedCartStoreId ??
    singleCartStoreId;

  const currentCart = resolvedStoreId
    ? carts[resolvedStoreId] ?? null
    : null;

  /*
   * When more than one cart exists and the caller did not request a
   * specific store, replace this temporary Cart entry with the dedicated
   * transparent picker route. Replacing (instead of pushing) keeps the
   * original app screen directly underneath the picker.
   */
  useEffect(() => {
    if (
      hasMultipleCarts &&
      !requestedCartStoreId
    ) {
      router.replace('/cart-picker');
    }
  }, [
    hasMultipleCarts,
    requestedCartStoreId,
    router,
  ]);

  const items =
    currentCart?.items ?? [];

  const storeId =
    currentCart?.storeId ?? null;

  const phoneNumber =
    useCustomerStore(
      (state) => state.phoneNumber,
    );

  const normalizedPhone =
    phoneNumber.replace(
      /\D/g,
      '',
    );

  const appliedVoucher =
    useVoucherStore(
      (state) =>
        storeId
          ? state.vouchers[storeId] ??
            null
          : null,
    );

  const setStoreVoucher =
    useVoucherStore(
      (state) => state.setVoucher,
    );

  const clearVoucher =
    useVoucherStore(
      (state) => state.clearVoucher,
    );

  const orderNotes =
    useOrderNotesStore(
      (state) =>
        storeId
          ? state.notes[storeId] ??
            ''
          : '',
    );

  const setOrderNote =
    useOrderNotesStore(
      (state) => state.setNote,
    );

  const clearOrderNotes =
    useOrderNotesStore(
      (state) => state.clearNote,
    );

  const [
    noteEditorVisible,
    setNoteEditorVisible,
  ] = useState(false);

  const [
    draftOrderNote,
    setDraftOrderNote,
  ] = useState('');

  const noteInputRef =
    useRef<TextInput>(null);

  const [
    voucherCode,
    setVoucherCode,
  ] = useState('');

  const [
    voucherError,
    setVoucherError,
  ] = useState<string | null>(null);

  const [
    isApplyingVoucher,
    setIsApplyingVoucher,
  ] = useState(false);

  const [
    spinModalVisible,
    setSpinModalVisible,
  ] = useState(false);

  const [
    spinModalPhase,
    setSpinModalPhase,
  ] = useState<
    'ready' | 'spinning' | 'result'
  >('ready');

  const [
    spinSession,
    setSpinSession,
  ] = useState<ServerSpinSession | null>(
    null,
  );

  const [
    spinMode,
    setSpinMode,
  ] = useState<SpinMode>('welcome');

  const [
    spinUnlockSubtotal,
    setSpinUnlockSubtotal,
  ] = useState(
    SPIN_UNLOCK_SUBTOTAL_FALLBACK,
  );

  const [
    isSpinStatusLoading,
    setIsSpinStatusLoading,
  ] = useState(false);

  const [
    isClaimingSpin,
    setIsClaimingSpin,
  ] = useState(false);

  const [
    spinError,
    setSpinError,
  ] = useState<string | null>(null);

  const spinRotation = useRef(
    new Animated.Value(0),
  ).current;

  const storeName =
    currentCart?.storeName ?? null;

  const storeIcon =
    currentCart?.storeIcon ?? null;

  const isLaundryCart =
    isLaundryCategory(
      currentCart?.categorySlug,
    );

  const isRequestAnythingCart =
    isRequestAnythingCategory(
      currentCart?.categorySlug,
    );

  const minimumOrder =
    currentCart?.minimumOrder ?? 0;

  useEffect(() => {
    let cancelled = false;

    async function loadSpinStatus() {
      if (!storeId) {
        setSpinSession(null);
        setSpinMode('welcome');
        setSpinUnlockSubtotal(
          SPIN_UNLOCK_SUBTOTAL_FALLBACK,
        );
        setSpinError(null);
        setIsSpinStatusLoading(false);
        setSpinModalVisible(false);
        setSpinModalPhase('ready');
        spinRotation.setValue(0);
        return;
      }

      try {
        setIsSpinStatusLoading(true);
        setSpinError(null);

        await ensureAppSession();

        const { data, error } =
          await supabase.rpc(
            'get_my_spin_status',
            {
              p_store_id: storeId,
            },
          );

        if (error) {
          throw error;
        }

        if (cancelled) {
          return;
        }

        const response =
          (data ?? {}) as
            SpinStatusRpcResponse;
        const nextMode =
          normalizeSpinMode(response.mode);
        const nextSession =
          createServerSpinSession(
            response.event,
          );

        setSpinMode(nextMode);
        setSpinUnlockSubtotal(
          Math.max(
            numericOrFallback(
              response.unlock_subtotal,
              SPIN_UNLOCK_SUBTOTAL_FALLBACK,
            ),
            0,
          ),
        );
        setSpinSession(nextSession);
        setSpinModalVisible(false);
        setSpinModalPhase(
          nextSession
            ? 'result'
            : 'ready',
        );
        spinRotation.setValue(0);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.warn(
          'Unable to load spin status.',
          error,
        );
        setSpinSession(null);
        setSpinError(
          getSpinErrorMessage(error),
        );
      } finally {
        if (!cancelled) {
          setIsSpinStatusLoading(false);
        }
      }
    }

    void loadSpinStatus();

    return () => {
      cancelled = true;
    };
  }, [
    spinRotation,
    storeId,
  ]);

  const subtotal = useMemo(
    () => getCartSubtotal(items),
    [items],
  );

  const paymentProcessingFee =
    FIXED_PAYMENT_PROCESSING_FEE;

  const deliveryFee =
    Number(currentCart?.deliveryFee ?? 0);

  const voucherDiscountTarget =
    appliedVoucher?.discountTarget ??
    'order_subtotal';

  const voucherDiscountBase =
    voucherDiscountTarget ===
      'delivery_fee'
      ? deliveryFee
      : Number(subtotal ?? 0);

  const voucherDiscount =
    Math.min(
      Math.max(
        appliedVoucher
          ?.discountAmount ?? 0,
        0,
      ),
      Math.max(
        Number(
          voucherDiscountBase ?? 0,
        ),
        0,
      ),
    );

  const discountedSubtotal =
    Math.max(
      Number(subtotal ?? 0) -
        (
          voucherDiscountTarget ===
            'order_subtotal'
            ? voucherDiscount
            : 0
        ),
      0,
    );

  const discountedDeliveryFee =
    Math.max(
      deliveryFee -
        (
          voucherDiscountTarget ===
            'delivery_fee'
            ? voucherDiscount
            : 0
        ),
      0,
    );

  const inferredSpinMode: SpinMode =
    spinSession?.mode ?? spinMode;

  const spinReward =
    spinSession?.reward ?? null;

  const spinRemainingToUnlock =
    Math.max(
      spinUnlockSubtotal -
        Number(subtotal ?? 0),
      0,
    );

  const spinProgress =
    spinUnlockSubtotal > 0
      ? Math.min(
          Math.max(
            Number(subtotal ?? 0) /
              spinUnlockSubtotal,
            0,
          ),
          1,
        )
      : 1;

  const spinEligible =
    !isSpinStatusLoading &&
    (
      inferredSpinMode === 'welcome'
        ? items.length > 0
        : Number(subtotal ?? 0) >=
          spinUnlockSubtotal
    );

  const spinRewardDifferentStore =
    !!spinSession &&
    !!storeId &&
    spinSession.storeId !== storeId;

  const spinRewardExpired =
    !!spinSession?.expiresAt &&
    spinSession.expiresAt <= Date.now();

  const nextOrderMinimum =
    Math.max(
      Number(
        spinReward?.minimumNextOrder ?? 0,
      ),
      0,
    );

  const nextOrderMinimumReached =
    Number(subtotal ?? 0) >=
    nextOrderMinimum;

  /**
   * A `next_order_discount` is redeemable only after Supabase explicitly
   * promotes it to `available`. Newly-won future rewards must stay pending
   * until the source order is submitted successfully, otherwise the same
   * reward could incorrectly discount the order that created it.
   */
  const spinIsRedeemableNextOrder =
    !!spinSession &&
    !spinRewardDifferentStore &&
    spinReward?.type ===
      'next_order_discount' &&
    spinSession.rewardStatus ===
      'available' &&
    !spinRewardExpired &&
    nextOrderMinimumReached;

  const spinRewardPaused =
    !!spinSession &&
    (
      spinRewardDifferentStore ||
      (
        spinSession.mode === 'standard' &&
        (
          spinReward?.type ===
            'current_order_discount' ||
          spinReward?.type ===
            'processing_fee_waiver'
        ) &&
        Number(subtotal ?? 0) <
          spinUnlockSubtotal
      )
    );

  /**
   * Subtotal rewards can come from:
   * 1) an immediate current-order reward; or
   * 2) a previously-earned next-order reward that Supabase marked available.
   *
   * The backend remains the source of truth and re-validates the reward when
   * the order is created.
   */
  const spinSubtotalDiscount =
    (
      (
        !spinRewardPaused &&
        spinReward?.type ===
          'current_order_discount'
      ) ||
      spinIsRedeemableNextOrder
    )
      ? Math.min(
          Math.max(
            Number(spinReward?.value ?? 0),
            0,
          ),
          discountedSubtotal,
        )
      : 0;

  const spinProcessingFeeDiscount =
    !spinRewardPaused &&
    spinReward?.type ===
      'processing_fee_waiver'
      ? Math.min(
          Math.max(
            Number(spinReward.value ?? 0),
            0,
          ),
          paymentProcessingFee,
        )
      : 0;

  const effectivePaymentProcessingFee =
    Math.max(
      paymentProcessingFee -
        spinProcessingFeeDiscount,
      0,
    );

  /**
   * Single source of truth for the amount the Spin removes from THIS order.
   * Keeping this as one value prevents the result card, summary, total and
   * checkout params from drifting apart.
   */
  const activeSpinSavings =
    spinSubtotalDiscount +
    spinProcessingFeeDiscount;

  const hasActiveCurrentOrderSpinReward =
    activeSpinSavings > 0;

  useEffect(() => {
    if (
      !storeId ||
      !appliedVoucher ||
      !hasActiveCurrentOrderSpinReward
    ) {
      return;
    }

    setStoreVoucher(
      storeId,
      null,
    );
    setVoucherCode('');
    setVoucherError(null);
  }, [
    appliedVoucher,
    hasActiveCurrentOrderSpinReward,
    setStoreVoucher,
    storeId,
  ]);

  /**
   * Calculate the total BEFORE Spin once, then subtract the exact Spin saving.
   *
   * A future reward removes 0 while pending. Once Supabase promotes it to
   * `available` and the minimum is reached, it becomes a normal subtotal
   * discount for this eligible next order.
   */
  const grandTotalBeforeSpin =
    Math.max(
      discountedSubtotal +
        discountedDeliveryFee +
        paymentProcessingFee,
      0,
    );

  const grandTotal =
    Math.max(
      grandTotalBeforeSpin -
        activeSpinSavings,
      0,
    );

  useEffect(() => {
    setVoucherCode(
      appliedVoucher?.code ?? '',
    );
    setVoucherError(null);
  }, [storeId]);

  useEffect(() => {
    if (appliedVoucher?.code) {
      setVoucherCode(
        appliedVoucher.code,
      );
    }
  }, [appliedVoucher?.code]);

  useEffect(() => {
    if (
      !appliedVoucher ||
      !storeId
    ) {
      return;
    }

    const subtotalChanged =
      Math.abs(
        appliedVoucher
          .subtotalBeforeDiscount -
          subtotal,
      ) > 0.009;

    const deliverySnapshot =
      appliedVoucher
        .deliveryFeeBeforeDiscount;

    const deliveryChanged =
      deliverySnapshot !== null &&
      deliverySnapshot !== undefined &&
      Math.abs(
        deliverySnapshot -
          deliveryFee,
      ) > 0.009;

    if (
      !subtotalChanged &&
      !deliveryChanged
    ) {
      return;
    }

    setStoreVoucher(
      storeId,
      null,
    );

    setVoucherError(
      'تغيّرت السلة. أرسل رمز القسيمة مرة أخرى.',
    );
  }, [
    appliedVoucher,
    deliveryFee,
    setStoreVoucher,
    storeId,
    subtotal,
  ]);

  /* ============================================================
   * LOAD SELECTED STORE CATALOG
   * ============================================================
   */

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      if (!storeId) {
        setCatalog(null);

        return;
      }

      try {
        const loadedCatalog =
          await getStoreCatalog(storeId);

        if (!cancelled) {
          setCatalog(loadedCatalog);
        }
      } catch {
        if (!cancelled) {
          setCatalog(null);
        }
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const catalogProducts = useMemo(() => {
    if (!catalog) {
      return [];
    }

    return catalog.sections.flatMap(
      (section) => section.products,
    );
  }, [catalog]);

  const productsById = useMemo(() => {
    const productMap =
      new Map<string, CatalogProduct>();

    catalogProducts.forEach((product) => {
      productMap.set(
        product.id,
        product,
      );
    });

    return productMap;
  }, [catalogProducts]);

  const recommendations = useMemo(() => {
    const cartProductIds = new Set(
      items.map((item) => item.id),
    );

    return catalogProducts
      .filter(
        (product) =>
          !cartProductIds.has(product.id),
      )
      .slice(0, 8);
  }, [
    catalogProducts,
    items,
  ]);

  const remainingForMinimum = Math.max(
    Number(minimumOrder ?? 0) -
      Number(subtotal ?? 0),
    0,
  );

  const minimumReached =
    items.length > 0 &&
    Number(subtotal ?? 0) >=
      Number(minimumOrder ?? 0);

  function formatPrice(
    value:
      | number
      | string
      | null
      | undefined,
  ) {
    const numericValue =
      Number(value ?? 0);

    if (
      Number.isInteger(numericValue)
    ) {
      return `EGP ${numericValue}`;
    }

    return `EGP ${numericValue.toFixed(
      2,
    )}`;
  }

  function formatCartSelectorPrice(
    value:
      | number
      | string
      | null
      | undefined,
  ) {
    const numericValue =
      Number(value ?? 0);

    return `${numericValue.toFixed(
      2,
    )} ج.م`;
  }

  function formatSummaryAmount(
    value:
      | number
      | string
      | null
      | undefined,
  ) {
    const numericValue =
      Number(value ?? 0);

    return numericValue.toFixed(2);
  }

  function openOrderNoteEditor() {
    setDraftOrderNote(
      orderNotes,
    );
    setNoteEditorVisible(true);
  }

  function closeOrderNoteEditor() {
    setNoteEditorVisible(false);
  }

  function handleDraftOrderNoteChange(
    value: string,
  ) {
    const nextValue =
      value.slice(0, 200);

    setDraftOrderNote(
      nextValue,
    );

    if (!storeId) {
      return;
    }

    setOrderNote(
      storeId,
      nextValue,
    );
  }

  function handleVoucherCodeChange(
    nextCode: string,
  ) {
    const normalizedCode =
      nextCode
        .replace(/\s+/g, '')
        .toUpperCase()
        .slice(0, 32);

    setVoucherCode(
      normalizedCode,
    );
    setVoucherError(null);

    if (
      storeId &&
      appliedVoucher &&
      normalizedCode !==
        appliedVoucher.code
    ) {
      setStoreVoucher(
        storeId,
        null,
      );
    }
  }

  function removeAppliedVoucher() {
    if (!storeId) {
      return;
    }

    setStoreVoucher(
      storeId,
      null,
    );
    setVoucherCode('');
    setVoucherError(null);
  }

  async function applyCartVoucher() {
    if (
      isApplyingVoucher ||
      !storeId
    ) {
      return;
    }

    if (
      hasActiveCurrentOrderSpinReward
    ) {
      setVoucherError(
        'مكافأة الـSpin مفعّلة على الطلب. لا يمكن جمعها مع قسيمة أخرى.',
      );
      return;
    }

    const normalizedCode =
      voucherCode
        .trim()
        .toUpperCase();

    if (
      normalizedCode.length < 3
    ) {
      setVoucherError(
        'اكتب رمز القسيمة أولًا.',
      );
      setStoreVoucher(
        storeId,
        null,
      );
      return;
    }

    try {
      setIsApplyingVoucher(true);
      setVoucherError(null);

      await ensureAppSession();

      const quote =
        await validateVoucher({
          code:
            normalizedCode,
          storeId,
          subtotal,
          deliveryFee,
          customerPhone:
            normalizedPhone ||
            null,
        });

      setVoucherCode(
        quote.code,
      );

      setStoreVoucher(
        storeId,
        quote,
      );
    } catch (error) {
      setStoreVoucher(
        storeId,
        null,
      );

      setVoucherError(
        error instanceof Error
          ? error.message
          : 'تعذر تطبيق رمز القسيمة.',
      );
    } finally {
      setIsApplyingVoucher(false);
    }
  }

  function openSpinModal() {
    if (isSpinStatusLoading) {
      return;
    }

    if (spinSession) {
      setSpinModalPhase('result');
      setSpinModalVisible(true);
      return;
    }

    if (!spinEligible) {
      return;
    }

    setSpinError(null);
    spinRotation.setValue(0);
    setSpinModalPhase('ready');
    setSpinModalVisible(true);
  }

  function closeSpinModal() {
    if (
      spinModalPhase === 'spinning'
    ) {
      return;
    }

    setSpinModalVisible(false);
  }

  async function handleSpin() {
    if (
      !storeId ||
      spinSession ||
      !spinEligible ||
      spinModalPhase === 'spinning' ||
      isClaimingSpin
    ) {
      return;
    }

    try {
      setIsClaimingSpin(true);
      setSpinError(null);

      await ensureAppSession();

      const spinItems = items.map(
        (item) => ({
          product_id: item.id,
          variant_id:
            item.variantId ?? null,
          quantity: item.quantity,
        }),
      );

      const { data, error } =
        await supabase.rpc(
          'claim_cart_spin_reward',
          {
            p_store_id: storeId,
            p_items: spinItems,
            p_has_active_voucher:
              !!appliedVoucher,
          },
        );

      if (error) {
        throw error;
      }

      const response =
        (data ?? {}) as
          SpinClaimRpcResponse;
      const nextSession =
        createServerSpinSession(
          response.event,
        );

      if (!nextSession) {
        throw new Error(
          'spin_result_missing',
        );
      }

      setSpinMode(nextSession.mode);
      setSpinUnlockSubtotal(
        Math.max(
          numericOrFallback(
            response.unlock_subtotal,
            spinUnlockSubtotal,
          ),
          0,
        ),
      );
      setSpinSession(nextSession);

      if (response.reused) {
        spinRotation.setValue(0);
        setSpinModalPhase('result');
        return;
      }

      const fullRewardSet =
        getSpinRewards(
          nextSession.mode,
        );
      const normalizedIndex =
        Math.min(
          Math.max(
            nextSession.wheelIndex,
            0,
          ),
          fullRewardSet.length - 1,
        );
      const finalSectorOffset =
        (
          fullRewardSet.length -
          normalizedIndex
        ) %
        fullRewardSet.length;
      const targetTurns =
        6 +
        finalSectorOffset /
          fullRewardSet.length;

      spinRotation.setValue(0);
      setSpinModalPhase('spinning');

      Animated.timing(
        spinRotation,
        {
          toValue: targetTurns,
          duration:
            SPIN_ANIMATION_DURATION_MS,
          easing: Easing.out(
            Easing.cubic,
          ),
          useNativeDriver: true,
        },
      ).start(({ finished }) => {
        if (!finished) {
          return;
        }

        setTimeout(() => {
          setSpinModalPhase(
            'result',
          );
        }, 220);
      });
    } catch (error) {
      console.warn(
        'Unable to claim spin reward.',
        error,
      );
      setSpinModalPhase('ready');
      setSpinError(
        getSpinErrorMessage(error),
      );
    } finally {
      setIsClaimingSpin(false);
    }
  }

  function getSpinCardTitle() {
    if (!spinSession) {
      if (
        inferredSpinMode ===
        'welcome'
      ) {
        return 'مكافأة أول طلب';
      }

      if (spinEligible) {
        return 'مكافأتك جاهزة';
      }

      return 'افتح مكافأتك';
    }

    if (spinRewardPaused) {
      return 'مكافأتك محفوظة';
    }

    if (
      spinReward?.type ===
      'next_order_discount'
    ) {
      return `${spinReward.value}ج للطلب الجاي`;
    }

    if (
      spinReward?.type ===
      'processing_fee_waiver'
    ) {
      return 'الرسوم علينا';
    }

    return `كسبت ${spinReward?.value ?? 0}ج`;
  }

  function getSpinCardDescription() {
    if (!spinSession) {
      if (
        inferredSpinMode ===
        'welcome'
      ) {
        return 'لف العجلة وخد مكافأتك';
      }

      if (spinEligible) {
        return `وصلت ${Math.ceil(spinUnlockSubtotal)}ج — مكافأتك مستنياك`;
      }

      return `باقي ${Math.ceil(
        spinRemainingToUnlock,
      )}ج وتفتح مكافأتك`;
    }

    if (spinRewardDifferentStore) {
      return 'المكافأة محفوظة في السلة اللي لفيت منها';
    }

    if (spinRewardPaused) {
      return `رجّع السلة لـ${Math.ceil(
        spinUnlockSubtotal,
      )}ج أو أكتر علشان المكافأة تتفعل`;
    }

    if (
      spinReward?.type ===
      'next_order_discount'
    ) {
      if (spinRewardExpired) {
        return 'انتهت صلاحية مكافأة الطلب الجاي';
      }

      if (spinIsRedeemableNextOrder) {
        return `اتخصم ${formatSummaryAmount(
          spinSubtotalDiscount,
        )}ج من الطلب الحالي`;
      }

      if (
        spinSession?.rewardStatus ===
          'available' &&
        !nextOrderMinimumReached
      ) {
        return `زوّد المنتجات لـ${Math.ceil(
          nextOrderMinimum,
        )}ج أو أكتر علشان تستخدم المكافأة`;
      }

      return `محفوظة للطلب الجاي عند طلب ${
        spinReward.minimumNextOrder ??
        0
      }ج أو أكتر`;
    }

    if (
      spinReward?.type ===
      'processing_fee_waiver'
    ) {
      return 'خصمنا رسوم الخدمة من طلبك';
    }

    return `اتخصم ${formatSummaryAmount(
      spinSubtotalDiscount,
    )}ج من إجمالي طلبك`;
  }

  function getSpinResultTitle() {
    if (
      spinReward?.type ===
      'next_order_discount'
    ) {
      return 'مكافأة للطلب الجاي';
    }

    if (
      spinReward?.type ===
      'processing_fee_waiver'
    ) {
      return 'الرسوم علينا';
    }

    return 'مبروك';
  }

  function getSpinResultHero() {
    if (!spinReward) {
      return '';
    }

    if (
      spinReward.type ===
      'processing_fee_waiver'
    ) {
      return '10ج';
    }

    return `${spinReward.value}ج`;
  }

  function getSpinResultSubtitle() {
    if (!spinReward) {
      return '';
    }

    if (
      spinReward.type ===
      'next_order_discount'
    ) {
      if (spinRewardExpired) {
        return 'انتهت صلاحية المكافأة';
      }

      if (spinIsRedeemableNextOrder) {
        return `تم خصم ${formatSummaryAmount(
          spinSubtotalDiscount,
        )}ج من إجمالي طلبك`;
      }

      if (
        spinSession?.rewardStatus ===
          'available' &&
        !nextOrderMinimumReached
      ) {
        return `المكافأة متاحة — وصل السلة لـ${Math.ceil(
          nextOrderMinimum,
        )}ج أو أكتر`;
      }

      return 'محفوظة للطلب الجاي — هتتفعل بعد إتمام الطلب الحالي';
    }

    if (
      spinReward.type ===
      'processing_fee_waiver'
    ) {
      return spinRewardPaused
        ? `مكافأتك محفوظة لحد ما ترجع السلة لـ${Math.ceil(
            spinUnlockSubtotal,
          )}ج`
        : `تم خصم ${formatSummaryAmount(
            spinProcessingFeeDiscount,
          )}ج من إجمالي طلبك كرسوم خدمة`;
    }

    if (spinRewardDifferentStore) {
      return 'المكافأة محفوظة في السلة اللي لفيت منها';
    }

    return spinRewardPaused
      ? `مكافأتك محفوظة لحد ما ترجع السلة لـ${Math.ceil(
          spinUnlockSubtotal,
        )}ج`
      : `تم خصم ${formatSummaryAmount(
          spinSubtotalDiscount,
        )}ج من إجمالي طلبك`;
  }

  function markImageAsFailed(
    imageUrl: string,
  ) {
    setFailedImages(
      (current) => ({
        ...current,
        [imageUrl]: true,
      }),
    );
  }

  function canDisplayImage(
    imageUrl: string | null,
  ) {
    return (
      !!imageUrl &&
      !failedImages[imageUrl]
    );
  }

  function handleBack() {
    router.back();
  }

  function handleClearCart() {
    if (!storeId) {
      return;
    }

    clearVoucher(storeId);
    clearOrderNotes(storeId);
    clearStoreCart(storeId);

    setClearModalVisible(false);
  }

  function continueShopping() {
    const normalizedCategorySlug =
      normalizeCategorySlug(
        currentCart?.categorySlug,
      );

    if (storeId) {
      setActiveCart(storeId);
    }

    /**
     * Some Navienty Now categories have their own full shopping UI.
     *
     * Sending every cart to /store/[id] breaks the expected experience
     * because that route is the generic store screen. Keep each cart tied
     * to the screen that actually owns that category instead.
     */
    if (
      REQUEST_ANYTHING_CATEGORY_ALIASES.has(
        normalizedCategorySlug,
      )
    ) {
      router.replace(
        '/category/request-anything',
      );

      return;
    }

    if (
      LAUNDRY_CATEGORY_ALIASES.has(
        normalizedCategorySlug,
      )
    ) {
      router.replace(
        '/category/laundry',
      );

      return;
    }

    if (
      PERSONAL_CARE_CATEGORY_ALIASES.has(
        normalizedCategorySlug,
      )
    ) {
      router.replace({
        pathname:
          '/category/personal-care',
        params: storeId
          ? {
              storeId,
            }
          : undefined,
      });

      return;
    }

    if (
      SUPERMARKET_CATEGORY_ALIASES.has(
        normalizedCategorySlug,
      )
    ) {
      router.replace({
        pathname:
          '/category/supermarket',
        params: storeId
          ? {
              storeId,
            }
          : undefined,
      });

      return;
    }

    if (
      BOOKSTORE_CATEGORY_ALIASES.has(
        normalizedCategorySlug,
      )
    ) {
      router.replace({
        pathname:
          '/category/bookstore',
        params: storeId
          ? {
              storeId,
            }
          : undefined,
      });

      return;
    }



    /**
     * Restaurants intentionally use the dedicated store-details screen.
     * The restaurant category page is the restaurant selector, while the
     * selected restaurant itself lives at /store/[id].
     *
     * The same route remains the safe fallback for any future normal store
     * category that does not have a dedicated category shopping screen.
     */
    if (storeId) {
      router.replace({
        pathname: '/store/[id]',
        params: {
          id: storeId,
        },
      });

      return;
    }

    /**
     * If a cart somehow has no store id, still keep the user inside the
     * matching category where possible instead of dropping them on Home.
     */
    if (
      RESTAURANT_CATEGORY_ALIASES.has(
        normalizedCategorySlug,
      )
    ) {
      router.replace(
        '/category/restaurants',
      );

      return;
    }

    router.replace('/');
  }

  function handleCheckout() {
    if (
      !minimumReached ||
      !storeId
    ) {
      return;
    }

    setActiveCart(storeId);

    /**
     * Guest checkout is allowed.
     *
     * The app creates a persistent anonymous Supabase
     * session in the root layout, so checkout does not
     * require a visible Login step.
     */

    /**
     * Delivery location is required before checkout.
     *
     * The customer always sees the map first. The selected coordinates
     * and reverse-geocoded address are saved in customer-store, then
     * location-picker forwards the customer to checkout.
     */
    router.push({
      pathname: '/location-picker',
      params: {
        storeId,

        source: 'cart',

        paymentProcessingFee:
          effectivePaymentProcessingFee.toFixed(2),

        deliveryFee:
          deliveryFee.toFixed(2),

        grandTotal:
          grandTotal.toFixed(2),

        spinRewardId:
          spinSession?.id ?? '',

        spinRewardType:
          spinReward?.type ?? '',

        spinRewardValue:
          spinReward
            ? spinReward.value.toFixed(2)
            : '0.00',

        spinRewardSavings:
          activeSpinSavings.toFixed(2),

        spinRewardStatus:
          spinSession?.rewardStatus ?? '',
      },
    });
  }

  function addRecommendation(
    product: CatalogProduct,
  ) {
    if (
      !currentCart ||
      !storeId ||
      !storeName
    ) {
      return;
    }

    if (
      product.variants &&
      product.variants.length > 0
    ) {
      continueShopping();

      return;
    }

    addItem(
      {
        id: storeId,
        name: storeName,
        icon: storeIcon ?? '🏪',
        categorySlug:
          currentCart.categorySlug,
        deliveryFee:
          Number(currentCart.deliveryFee ?? 0),
        minimumOrder:
          Number(minimumOrder ?? 0),
      },
      {
        id: product.id,
        name: product.name,
        description:
          product.description,
        price:
          Number(product.price ?? 0),
        icon: product.icon,
        variantId: null,
        variantName: null,
      },
    );
  }

  /* ============================================================
   * EMPTY STATE
   * ============================================================
   */

  if (availableCarts.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Stack.Screen options={CART_SCREEN_OPTIONS} />

        <View
          style={[
            styles.emptyContainer,
            {
              paddingTop:
                Math.max(insets.top, 18),
            },
          ]}
        >
          <View
            style={styles.emptyIllustration}
          >
            <EmptyCartIllustration />
          </View>



          <Text
            style={styles.emptyTitle}
          >
            السلة لسه فاضية
          </Text>

          <Text
            style={
              styles.emptyDescription
            }
          >
            اختار اللي محتاجه وإحنا هنرتّب الباقي
          </Text>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryButton,
              pressed &&
                styles.primaryButtonPressed,
            ]}
            onPress={() =>
              router.replace('/')
            }
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              ابدأ التسوق
            </Text>


          </Pressable>
        </View>
      </View>
    );
  }

  /*
   * While the multi-cart dispatcher effect replaces this route with
   * /cart-picker, render nothing so the temporary Cart card never flashes.
   */
  if (
    hasMultipleCarts &&
    !requestedCartStoreId
  ) {
    return null;
  }

  /* ============================================================
   * SELECTED CART DETAILS
   * ============================================================
   */

  if (!currentCart) {
    return null;
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={CART_SCREEN_OPTIONS} />

      {/* STICKY HEADER */}

      <View
        style={[
          styles.header,
          Platform.OS === 'android' && {
            paddingTop:
              Math.max(insets.top, 24) + 10,
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.backButton,

            pressed &&
              styles.buttonPressed,
          ]}
          onPress={handleBack}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color="#262626"
          />
        </Pressable>

        <View
          style={styles.headerContent}
        >
          <Text
            style={styles.pageTitle}
          >
            سلة المشتريات
          </Text>

          {hasMultipleCarts ? (
            <Text
              style={
                styles.headerStoreName
              }
              numberOfLines={1}
            >
              {storeName}
            </Text>
          ) : null}
        </View>

        <Pressable
          hitSlop={10}
          style={({ pressed }) => [
            styles.clearCartButton,

            pressed &&
              styles.buttonPressed,
          ]}
          onPress={() =>
            setClearModalVisible(true)
          }
        >
          <Text
            style={
              styles.clearCartButtonText
            }
          >
            إفراغ السلة
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={
          styles.mainScrollView
        }
        contentContainerStyle={
          styles.pageContent
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* ITEMS */}

        <View style={styles.itemsSection}>
          {items.map(
            (item, index) => {
              const catalogProduct =
                productsById.get(item.id);

              const imageUrl =
                getProductImage(
                  catalogProduct,
                );

              const itemTotal =
                Number(item.price) *
                item.quantity;

              const variantName =
                item.variantName;

              const isLast =
                index ===
                items.length - 1;

              return (
                <View
                  key={`${item.id}-${
                    item.variantId ??
                    'base'
                  }`}
                  style={[
                    styles.itemRow,

                    isLast &&
                      styles.itemRowLast,
                  ]}
                >
                  {/* PRODUCT DETAILS */}

                  <View
                    style={
                      styles.itemContent
                    }
                  >
                    <Text
                      style={styles.itemName}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>

                    {!!variantName && (
                      <Text
                        style={
                          styles.variantName
                        }
                        numberOfLines={1}
                      >
                        {variantName}
                      </Text>
                    )}

                    <Pressable
                      style={(responsiveness) => [
                        styles.editButton,

                        responsiveness.pressed &&
                          styles.buttonPressed,
                      ]}
                      onPress={
                        continueShopping
                      }
                    >
                      <Ionicons
                        name="pencil-outline"
                        size={15}
                        color={BRAND_GREEN}
                      />

                      <Text
                        style={
                          styles.editButtonText
                        }
                      >
                        تعديل
                      </Text>
                    </Pressable>

                    <View
                      style={
                        styles.itemPriceContainer
                      }
                    >
                      <Text
                        style={
                          styles.itemPrice
                        }
                      >
                        {formatPrice(
                          itemTotal,
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* PRODUCT IMAGE */}

                  <View
                    style={styles.itemMedia}
                  >
                    {isRequestAnythingCart ? (
                      <Image
                        source={
                          REQUEST_ANYTHING_CART_IMAGE
                        }
                        style={styles.itemImage}
                        resizeMode="contain"
                      />
                    ) : isLaundryCart ? (
                      <Image
                        source={
                          LAUNDRY_CART_IMAGE
                        }
                        style={styles.itemImage}
                        resizeMode="contain"
                      />
                    ) : canDisplayImage(
                        imageUrl,
                      ) ? (
                      <Image
                        source={{
                          uri: imageUrl!,
                        }}
                        style={styles.itemImage}
                        resizeMode="cover"
                        onError={() =>
                          markImageAsFailed(
                            imageUrl!,
                          )
                        }
                      />
                    ) : (
                      <View
                        style={
                          styles.itemImageFallback
                        }
                      >
                        {item.icon ? (
                          <Text
                            style={
                              styles.itemEmoji
                            }
                          >
                            {item.icon}
                          </Text>
                        ) : (
                          <Ionicons
                            name="restaurant-outline"
                            size={30}
                            color="#bbbbbb"
                          />
                        )}
                      </View>
                    )}

                    {/* QUANTITY PILL */}

                    <View
                      style={
                        styles.quantityControl
                      }
                    >
                      <Pressable
                        style={({ pressed }) => [
                          styles.quantityButton,

                          pressed &&
                            styles.buttonPressed,
                        ]}
                        onPress={() => {
                          if (!storeId) {
                            return;
                          }

                          if (
                            item.quantity <= 1
                          ) {
                            if (
                              items.length === 1
                            ) {
                              clearOrderNotes(
                                storeId,
                              );
                            }

                            removeStoreItem(
                              storeId,
                              item.id,
                              item.variantId ??
                                null,
                            );

                            return;
                          }

                          decreaseStoreItem(
                            storeId,
                            item.id,
                            item.variantId ??
                              null,
                          );
                        }}
                      >
                        <Ionicons
                          name={
                            item.quantity <= 1
                              ? 'trash-outline'
                              : 'remove'
                          }
                          size={
                            item.quantity <= 1
                              ? 16
                              : 18
                          }
                          color={BRAND_GREEN}
                        />
                      </Pressable>

                      <Text
                        style={
                          styles.quantityText
                        }
                      >
                        {item.quantity}
                      </Text>

                      <Pressable
                        style={({ pressed }) => [
                          styles.quantityButton,

                          pressed &&
                            styles.buttonPressed,
                        ]}
                        onPress={() => {
                          if (!storeId) {
                            return;
                          }

                          increaseStoreItem(
                            storeId,
                            item.id,
                            item.variantId ??
                              null,
                          );
                        }}
                      >
                        <Ionicons
                          name="add"
                          size={19}
                          color={BRAND_GREEN}
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            },
          )}
        </View>

        {/* SPIN REWARD */}

        <View
          style={styles.spinSection}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              spinSession
                ? 'عرض مكافأة Spin'
                : spinEligible
                  ? 'فتح مكافأتك'
                  : 'مكافأة Spin غير متاحة بعد'
            }
            disabled={
              !spinSession &&
              !spinEligible
            }
            style={({ pressed }) => [
              styles.spinCard,
              !spinSession &&
                spinEligible &&
                styles.spinCardReady,
              spinSession &&
                styles.spinCardRewarded,
              spinRewardPaused &&
                styles.spinCardPaused,
              pressed &&
                styles.spinCardPressed,
            ]}
            onPress={openSpinModal}
          >
            {!spinSession &&
            inferredSpinMode ===
              'standard' &&
            !spinEligible ? (
              <View
                style={styles.spinLockedCardBody}
              >


                <Text
                  style={styles.spinLockedTitle}
                >
                 كمل تسوق واكسب
                </Text>

                <View
                  style={styles.spinLockedAmountRow}
                >
                  <Text
                    style={styles.spinLockedCurrentValue}
                  >
                    {Math.floor(subtotal)}
                  </Text>

                  <Text
                    style={styles.spinLockedGoalText}
                  >
                    من 200 ج
                  </Text>
                </View>

                <View
                  style={styles.spinProgressArea}
                >
                  <View
                    style={styles.spinProgressTrack}
                  >
                    <View
                      style={[
                        styles.spinProgressFill,
                        {
                          width:
                            `${spinProgress * 100}%` as `${number}%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                <View
                  style={styles.spinLockedRemainingRow}
                >
                  <Text
                    style={styles.spinLockedRemainingNumber}
                  >
                    {Math.ceil(
                      spinRemainingToUnlock,
                    )} ج
                  </Text>

                  <Text
                    style={styles.spinLockedRemainingLabel}
                  >
                    باقي
                  </Text>
                </View>





                <View
                  style={styles.spinLockedCornerGlow}
                />
              </View>
            ) : !spinSession ? (
              <View
                style={styles.spinCardReadyBody}
              >
                <View
                  style={styles.spinCardReadyGlowOne}
                />
                <View
                  style={styles.spinCardReadyGlowTwo}
                />



                <Text
                  style={styles.spinCardReadyTitle}
                >
                  مكافأتك جاهزة
                </Text>

                <Text
                  style={styles.spinCardReadySubtitle}
                >
                  لفة واحدة. مكافأة مضمونة.
                </Text>

                <View
                  style={styles.spinCardReadyFooter}
                >
                  <Text
                    style={styles.spinCardReadyFooterText}
                  >
                    لف العجلة واكسب
                  </Text>


                </View>
              </View>
            ) : (
              <View
                style={styles.spinRewardCardBody}
              >
                <View
                  style={styles.spinRewardCardHeaderRow}
                >
                  <View
                    style={styles.spinRewardCardBadge}
                  >
                    <Ionicons
                      name={
                        spinRewardPaused
                          ? 'time-outline'
                          : 'checkmark'
                      }
                      size={12}
                      color={
                        spinRewardPaused
                          ? '#8A6519'
                          : '#5CB66A'
                      }
                    />
                  </View>

                  <Text
                    style={styles.spinRewardCardHeaderText}
                  >
                    {spinRewardPaused
                      ? 'مكافأتك محفوظة'
                      : spinReward?.type ===
                        'next_order_discount'
                        ? 'تم حفظ مكافأتك'
                        : 'تم تطبيق مكافأتك'}
                  </Text>
                </View>

                <Text
                  style={styles.spinRewardCardValue}
                >
                  {spinReward?.type ===
                  'processing_fee_waiver'
                    ? '10'
                    : String(
                        spinReward?.value ??
                          0,
                      )}
                </Text>

                <Text
                  style={styles.spinRewardCardCurrency}
                >
                  {spinReward?.type ===
                  'next_order_discount'
                    ? 'ج للطلب الجاي'
                    : 'جنيه'}
                </Text>

                <Text
                  style={styles.spinRewardCardSubtitle}
                >
                  {getSpinCardDescription()}
                </Text>
              </View>
            )}

            {spinError ? (
              <Text
                style={styles.spinInlineErrorText}
              >
                {spinError}
              </Text>
            ) : null}
          </Pressable>
        </View>


        {/* RECOMMENDATIONS */}

        {recommendations.length > 0 && (
          <View
            style={
              styles.recommendationsSection
            }
          >
            <Text
              style={
                styles.recommendationsTitle
              }
            >
              قد يعجبك أيضًا...
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.recommendationsScroll
              }
            >
              {recommendations.map(
                (product) => {
                  const imageUrl =
                    getProductImage(
                      product,
                    );

                  const displayPrice =
                    getProductDisplayPrice(
                      product,
                    );

                  const hasVariants =
                    product.variants.length > 0;

                  return (
                    <View
                      key={product.id}
                      style={
                        styles.recommendationCard
                      }
                    >
                      <View
                        style={
                          styles.recommendationImageWrapper
                        }
                      >
                        {canDisplayImage(
                          imageUrl,
                        ) ? (
                          <Image
                            source={{
                              uri: imageUrl!,
                            }}
                            style={
                              styles.recommendationImage
                            }
                            resizeMode="cover"
                            onError={() =>
                              markImageAsFailed(
                                imageUrl!,
                              )
                            }
                          />
                        ) : (
                          <View
                            style={
                              styles.recommendationImageFallback
                            }
                          >
                            {product.icon ? (
                              <Text
                                style={
                                  styles.recommendationEmoji
                                }
                              >
                                {product.icon}
                              </Text>
                            ) : (
                              <Ionicons
                                name="image-outline"
                                size={28}
                                color="#b5b5b5"
                              />
                            )}
                          </View>
                        )}

                        <Pressable
                          style={({ pressed }) => [
                            styles.recommendationAddButton,

                            pressed &&
                              styles.recommendationAddButtonPressed,
                          ]}
                          onPress={() =>
                            addRecommendation(
                              product,
                            )
                          }
                        >
                          <Ionicons
                            name={
                              hasVariants
                                ? 'chevron-forward'
                                : 'add'
                            }
                            size={
                              hasVariants
                                ? 17
                                : 20
                            }
                            color={BRAND_GREEN}
                          />
                        </Pressable>
                      </View>

                      <Text
                        style={
                          styles.recommendationName
                        }
                        numberOfLines={2}
                      >
                        {product.name}
                      </Text>

                      <Text
                        style={
                          styles.recommendationPrice
                        }
                        numberOfLines={1}
                      >
                        {hasVariants
                          ? `من ${formatPrice(
                              displayPrice,
                            )}`
                          : formatPrice(
                              displayPrice,
                            )}
                      </Text>
                    </View>
                  );
                },
              )}
            </ScrollView>
          </View>
        )}


        {/* ORDER NOTES — REFERENCE STYLE */}

        <View
          style={
            styles.referenceNotesSection
          }
        >
          <Text
            style={
              styles.referenceSectionTitle
            }
          >
            ملاحظات إضافية
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="دوّن ملاحظة على الطلب"
            style={({ pressed }) => [
              styles.referenceNotesRow,
              pressed &&
                styles.referenceNotesRowPressed,
            ]}
            onPress={
              openOrderNoteEditor
            }
          >
            <Ionicons
              name="chatbox-outline"
              size={21}
              color="#242424"
              style={
                styles.referenceNotesIcon
              }
            />

            <View
              style={
                styles.referenceNotesCopy
              }
            >
              <Text
                style={
                  styles.referenceNotesLabel
                }
              >
                دوّن ملاحظة
              </Text>

              <Text
                style={[
                  styles.referenceNotesPreview,
                  !orderNotes.trim() &&
                    styles.referenceNotesPreviewPlaceholder,
                ]}
                numberOfLines={2}
              >
                {orderNotes.trim()
                  ? orderNotes
                  : 'هل تود أن تخبرنا أي شيء آخر؟'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* VOUCHER — REFERENCE STYLE */}

        <View
          style={
            styles.referenceVoucherSection
          }
        >
          <Text
            style={
              styles.referenceSectionTitle
            }
          >
            وفّر على طلبك
          </Text>

          {hasActiveCurrentOrderSpinReward ? (
            <View
              style={
                styles.referenceVoucherSpinNotice
              }
            >
              <View
                style={
                  styles.referenceVoucherSpinNoticeIcon
                }
              >
                <Ionicons
                  name="gift-outline"
                  size={18}
                  color={BRAND_GREEN}
                />
              </View>

              <View
                style={
                  styles.referenceVoucherSpinNoticeCopy
                }
              >
                <Text
                  style={
                    styles.referenceVoucherSpinNoticeTitle
                  }
                >
                  القسيمة غير متاحة مع مكافأة Spin
                </Text>

                <Text
                  style={
                    styles.referenceVoucherSpinNoticeText
                  }
                >
                  لا يمكن استخدام قسيمة مع مكافأة الـSpin على نفس الطلب.
                </Text>
              </View>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.referenceVoucherField,
                  appliedVoucher &&
                    styles.referenceVoucherFieldApplied,
                ]}
              >
                <Ionicons
                  name={
                    appliedVoucher
                      ? 'ticket'
                      : 'ticket-outline'
                  }
                  size={20}
                  color={
                    appliedVoucher
                      ? BRAND_GREEN
                      : '#A0A0A0'
                  }
                />

                {appliedVoucher ? (
                  <View
                    style={
                      styles.referenceVoucherAppliedCopy
                    }
                  >
                    <Text
                      style={
                        styles.referenceVoucherAppliedCode
                      }
                      numberOfLines={1}
                    >
                      {appliedVoucher.code}
                    </Text>

                    <Text
                      style={
                        styles.referenceVoucherAppliedSaving
                      }
                      numberOfLines={1}
                    >
                      وفّرت{' '}
                      {formatSummaryAmount(
                        voucherDiscount,
                      )}{' '}
                      ج.م
                    </Text>
                  </View>
                ) : (
                  <TextInput
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!isApplyingVoucher}
                    maxLength={32}
                    placeholder="قم بإدخال رمز القسيمة هنا"
                    placeholderTextColor="#777777"
                    returnKeyType="done"
                    style={
                      styles.referenceVoucherInput
                    }
                    value={
                      voucherCode
                    }
                    onChangeText={
                      handleVoucherCodeChange
                    }
                    onSubmitEditing={() => {
                      void applyCartVoucher();
                    }}
                  />
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    appliedVoucher
                      ? 'إزالة القسيمة'
                      : 'إرسال رمز القسيمة'
                  }
                  disabled={
                    !appliedVoucher &&
                    (
                      isApplyingVoucher ||
                      voucherCode
                        .trim()
                        .length < 3
                    )
                  }
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.referenceVoucherAction,
                    pressed &&
                      styles.referenceVoucherActionPressed,
                  ]}
                  onPress={() => {
                    if (appliedVoucher) {
                      removeAppliedVoucher();
                      return;
                    }

                    void applyCartVoucher();
                  }}
                >
                  {isApplyingVoucher &&
                  !appliedVoucher ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        BRAND_GREEN
                      }
                    />
                  ) : (
                    <Text
                      style={[
                        styles.referenceVoucherActionText,
                        !appliedVoucher &&
                          voucherCode
                            .trim()
                            .length < 3 &&
                          styles.referenceVoucherActionTextDisabled,
                      ]}
                    >
                      {appliedVoucher
                        ? 'إزالة'
                        : 'إرسال'}
                    </Text>
                  )}
                </Pressable>
              </View>

              {voucherError ? (
                <View
                  style={
                    styles.referenceVoucherErrorRow
                  }
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={13}
                    color="#D64B4B"
                  />

                  <Text
                    style={
                      styles.referenceVoucherErrorText
                    }
                  >
                    {voucherError}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* PAYMENT SUMMARY — REFERENCE STYLE */}

        <View
          style={
            styles.referencePaymentSummary
          }
        >
          <Text
            style={
              styles.referencePaymentTitle
            }
          >
            ملخص الدفع
          </Text>

          <View
            style={
              styles.referenceSummaryRow
            }
          >
            <Text
              style={
                styles.referenceSummaryLabel
              }
            >
              المجموع الفرعي
            </Text>

            <Text
              style={
                styles.referenceSummaryValue
              }
            >
              {formatSummaryAmount(
                subtotal,
              )}
            </Text>
          </View>

          {voucherDiscount > 0 &&
            voucherDiscountTarget ===
              'order_subtotal' && (
              <View
                style={
                  styles.referenceSummaryRow
                }
              >
                <Text
                  style={
                    styles.referenceDiscountLabel
                  }
                >
                  خصم القسيمة
                </Text>

                <Text
                  style={
                    styles.referenceDiscountValue
                  }
                >
                  -{formatSummaryAmount(
                    voucherDiscount,
                  )}
                </Text>
              </View>
            )}

          <View
            style={
              styles.referenceSummaryRow
            }
          >
            <View
              style={
                styles.referenceSummaryLabelWithInfo
              }
            >
              <Text
                style={
                  styles.referenceSummaryLabel
                }
              >
                رسوم التوصيل
              </Text>

              <Ionicons
                name="information-circle-outline"
                size={14}
                color="#8C8C8C"
              />
            </View>

            <Text
              style={
                styles.referenceSummaryValue
              }
            >
              {formatSummaryAmount(
                deliveryFee,
              )}
            </Text>
          </View>

          {voucherDiscount > 0 &&
            voucherDiscountTarget ===
              'delivery_fee' && (
              <View
                style={
                  styles.referenceSummaryRow
                }
              >
                <Text
                  style={
                    styles.referenceDiscountLabel
                  }
                >
                  خصم التوصيل
                </Text>

                <Text
                  style={
                    styles.referenceDiscountValue
                  }
                >
                  -{formatSummaryAmount(
                    voucherDiscount,
                  )}
                </Text>
              </View>
            )}

          <View
            style={
              styles.referenceSummaryRow
            }
          >
            <View
              style={
                styles.referenceSummaryLabelWithInfo
              }
            >
              <Text
                style={
                  styles.referenceSummaryLabel
                }
              >
                رسوم الخدمة
              </Text>

              <Ionicons
                name="information-circle-outline"
                size={14}
                color="#8C8C8C"
              />
            </View>

            <Text
              style={
                styles.referenceSummaryValue
              }
            >
              {formatSummaryAmount(
                paymentProcessingFee,
              )}
            </Text>
          </View>

          {activeSpinSavings > 0 ? (
            <View
              style={
                styles.referenceSummaryRow
              }
            >
              <Text
                style={
                  styles.referenceDiscountLabel
                }
              >
                {spinReward?.type ===
                'processing_fee_waiver'
                  ? 'مكافأة Spin — رسوم الخدمة'
                  : 'مكافأة Spin'}
              </Text>

              <Text
                style={
                  styles.referenceDiscountValue
                }
              >
                -{formatSummaryAmount(
                  activeSpinSavings,
                )}
              </Text>
            </View>
          ) : null}

          {spinReward?.type ===
          'next_order_discount' &&
          !spinRewardDifferentStore ? (
            <View
              style={
                styles.referenceSummaryRow
              }
            >
              <Text
                style={
                  styles.referenceSummaryLabel
                }
              >
                مكافأة الطلب الجاي
              </Text>

              <Text
                style={
                  styles.referenceDiscountValue
                }
              >
                {formatSummaryAmount(
                  spinReward.value,
                )} ج.م
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.referenceSummaryRow,
              styles.referenceTotalRow,
            ]}
          >
            <Text
              style={
                styles.referenceTotalLabel
              }
            >
              المبلغ الإجمالي (ج.م)
            </Text>

            <Text
              style={
                styles.referenceTotalValue
              }
            >
              {formatSummaryAmount(
                grandTotal,
              )}
            </Text>
          </View>
        </View>

        {!minimumReached &&
          Number(minimumOrder) > 0 && (
            <View
              style={styles.minimumNotice}
            >
              <Ionicons
                name="information-circle-outline"
                size={15}
                color="#8a6519"
              />

              <Text
                style={
                  styles.minimumNoticeText
                }
              >
                متبقي{' '}
                {formatPrice(
                  remainingForMinimum,
                )}{' '}
                للوصول إلى الحد الأدنى
                للطلب
              </Text>
            </View>
          )}
      </ScrollView>

      {/* BOTTOM CHECKOUT */}

      <View
        style={[
          styles.checkoutBarWrapper,
          {
            paddingBottom: Math.max(
              insets.bottom,
              18,
            ),
          },
        ]}
      >
        <View style={styles.checkoutBar}>
          <Pressable
            style={({ pressed }) => [
              styles.addItemsButton,

              pressed &&
                styles.bottomButtonPressed,
            ]}
            onPress={continueShopping}
          >
            <Text
              style={
                styles.addItemsButtonText
              }
            >
              أضف المزيد
            </Text>
          </Pressable>

          <Pressable
            disabled={!minimumReached}
            style={({ pressed }) => [
              styles.checkoutButton,

              !minimumReached &&
                styles.checkoutButtonDisabled,

              pressed &&
                minimumReached &&
                styles.bottomButtonPressed,
            ]}
            onPress={handleCheckout}
          >
            <Text
              style={[
                styles.checkoutButtonText,

                !minimumReached &&
                  styles.checkoutButtonTextDisabled,
              ]}
            >
              {minimumReached
                ? 'تابع للدفع'
                : `متبقي ${Math.ceil(
                    remainingForMinimum,
                  )}`}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* SPIN REWARD BOTTOM SHEET */}

      <Modal
        visible={spinModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeSpinModal}
      >
        <View
          style={styles.spinModalRoot}
        >
          <Pressable
            style={styles.spinModalBackdrop}
            disabled={
              spinModalPhase ===
              'spinning'
            }
            onPress={closeSpinModal}
          />

          <View
            style={[
              styles.spinSheet,
              styles.spinSheetDark,
            ]}
          >
            <View
              style={styles.spinSheetHandle}
            />

            {spinModalPhase !==
            'spinning' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
                hitSlop={10}
                style={({ pressed }) => [
                  styles.spinSheetClose,
                  styles.spinSheetCloseDark,
                  pressed &&
                    styles.spinSheetClosePressed,
                ]}
                onPress={closeSpinModal}
              >
                <Ionicons
                  name="close"
                  size={19}
                  color="#F5F8F6"
                />
              </Pressable>
            ) : null}

            {spinModalPhase ===
            'result' &&
            spinReward ? (
              <View
                style={
                  styles.spinResultContent
                }
              >
                <View
                  style={
                    styles.spinResultGlowTop
                  }
                />
                <View
                  style={
                    styles.spinResultGlowCenter
                  }
                />
                <View
                  style={
                    styles.spinResultConfettiOne
                  }
                />
                <View
                  style={
                    styles.spinResultConfettiTwo
                  }
                />
                <View
                  style={
                    styles.spinResultConfettiThree
                  }
                />
                <View
                  style={
                    styles.spinResultConfettiFour
                  }
                />
                <View
                  style={
                    styles.spinResultConfettiFive
                  }
                />
                <View
                  style={
                    styles.spinResultConfettiSix
                  }
                />

                <View
                  style={
                    styles.spinResultStatusBadge
                  }
                >
                  <View
                    style={
                      styles.spinResultStatusIcon
                    }
                  >
                    <Ionicons
                      name={
                        spinReward?.type ===
                          'next_order_discount'
                          ? 'gift-outline'
                          : 'checkmark'
                      }
                      size={16}
                      color="#FFFFFF"
                    />
                  </View>

                  <Text
                    style={
                      styles.spinResultStatusText
                    }
                  >
                    {spinReward?.type ===
                    'next_order_discount'
                      ? 'تم حفظ مكافأتك'
                      : 'تم تطبيق مكافأتك'}
                  </Text>
                </View>

                <Text
                  style={
                    styles.spinResultMassiveValue
                  }
                >
                  {spinReward.type ===
                  'processing_fee_waiver'
                    ? '10'
                    : String(
                        spinReward.value ?? 0,
                      )}
                </Text>

                <Text
                  style={
                    styles.spinResultCurrencyWord
                  }
                >
                  جنيه
                </Text>

                <Text
                  style={
                    styles.spinResultMessage
                  }
                >
                  {spinReward.type ===
                  'next_order_discount'
                    ? 'اتحفظت للطلب الجاي'
                    : 'اتخصمت من طلبك'}
                </Text>

                {spinReward.type ===
                'next_order_discount' ? (
                  <View
                    style={
                      styles.spinResultFutureMeta
                    }
                  >
                    <Text
                      style={
                        styles.spinResultFutureMetaText
                      }
                    >
                      صالحة لمدة 3 أيام • عند طلب {spinReward.minimumNextOrder ?? 0}ج أو أكتر
                    </Text>
                  </View>
                ) : (
                  <View
                    style={
                      styles.spinResultLedger
                    }
                  >
                    <View
                      style={
                        styles.spinResultLedgerDivider
                      }
                    />

                    <View
                      style={
                        styles.spinResultLedgerRow
                      }
                    >
                      <Text
                        style={
                          styles.spinResultLedgerOldValue
                        }
                      >
                        ج {formatSummaryAmount(
                          grandTotalBeforeSpin,
                        )}
                      </Text>

                      <Ionicons
                        name="arrow-forward"
                        size={20}
                        color="rgba(255,255,255,0.72)"
                      />

                      <Text
                        style={
                          styles.spinResultLedgerNewValue
                        }
                      >
                        ج {formatSummaryAmount(
                          grandTotal,
                        )}
                      </Text>
                    </View>
                  </View>
                )}

                {spinRewardPaused ? (
                  <View
                    style={
                      styles.spinPausedNotice
                    }
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={15}
                      color="#E5C56F"
                    />

                    <Text
                      style={
                        styles.spinPausedNoticeText
                      }
                    >
                      {spinRewardDifferentStore
                        ? 'المكافأة مرتبطة بالسلة اللي لفيت منها.'
                        : `المكافأة محفوظة لحد ما ترجع السلة لـ${Math.ceil(
                            spinUnlockSubtotal,
                          )}ج.`}
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  style={({ pressed }) => [
                    styles.spinPrimaryButton,
                    styles.spinPrimaryButtonResult,
                    pressed &&
                      styles.bottomButtonPressed,
                  ]}
                  onPress={closeSpinModal}
                >
                  <View
                    style={
                      styles.spinPrimaryButtonRow
                    }
                  >
                    <Text
                      style={[
                        styles.spinPrimaryButtonText,
                        styles.spinPrimaryButtonTextDark,
                      ]}
                    >
                      {spinReward.type ===
                        'next_order_discount'
                        ? 'تمام'
                        : 'كمّل الطلب'}
                    </Text>


                  </View>
                </Pressable>
              </View>
            ) : (
              <View
                style={
                  styles.spinReadyContent
                }
              >
                <View
                  style={
                    styles.spinReadyBackdropGlowTop
                  }
                />
                <View
                  style={
                    styles.spinReadyBackdropGlowBottom
                  }
                />



                <Text
                  style={
                    styles.spinSheetTitle
                  }
                >
                  مكافأتك جاهزة
                </Text>



                {spinModalPhase ===
                  'spinning' ? (
                  <SpinWheelGraphic
                    rewards={getSpinRewards(
                      inferredSpinMode,
                    )}
                    rotation={spinRotation}
                  />
                ) : (
                  <View
                    style={
                      styles.spinRevealStage
                    }
                  >
                    <View
                      style={
                        styles.spinRevealOrbitGlow
                      }
                    />
                    <View
                      style={
                        styles.spinRevealOrbitRing
                      }
                    />

                    <View
                      style={
                        styles.spinRevealTicketWrap
                      }
                    >
                      <Ionicons
                        name="ticket"
                        size={40}
                        color="#09150F"
                      />
                    </View>
                  </View>
                )}

                <Pressable
                  disabled={
                    spinModalPhase ===
                      'spinning' ||
                    isClaimingSpin
                  }
                  style={({ pressed }) => [
                    styles.spinPrimaryButton,
                    styles.spinPrimaryButtonLight,
                    (spinModalPhase ===
                      'spinning' ||
                      isClaimingSpin) &&
                      styles.spinPrimaryButtonDisabled,
                    pressed &&
                      spinModalPhase !==
                        'spinning' &&
                      !isClaimingSpin &&
                      styles.bottomButtonPressed,
                  ]}
                  onPress={() => {
                    void handleSpin();
                  }}
                >
                  {spinModalPhase ===
                    'spinning' ||
                  isClaimingSpin ? (
                    <View
                      style={
                        styles.spinButtonLoading
                      }
                    >
                      <ActivityIndicator
                        size="small"
                        color="#07140F"
                      />

                      <Text
                        style={[
                          styles.spinPrimaryButtonText,
                          styles.spinPrimaryButtonTextLight,
                        ]}
                      >
                        جاري الكشف...
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={
                        styles.spinPrimaryButtonRow
                      }
                    >
                      <Text
                        style={[
                          styles.spinPrimaryButtonText,
                          styles.spinPrimaryButtonTextLight,
                        ]}
                      >
                        العب واكسب
                      </Text>


                    </View>
                  )}
                </Pressable>

                <View
                  style={styles.spinFinePrintRow}
                >
                  <Text
                    style={styles.spinFinePrint}
                  >
                    يمكنك استخدامها الآن
                  </Text>

                  <Ionicons
                    name="shield-checkmark-outline"
                    size={12}
                    color="#7DBE72"
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ORDER NOTE EDITOR */}

      <Modal
        visible={
          noteEditorVisible
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={
          closeOrderNoteEditor
        }
        onShow={() => {
          requestAnimationFrame(
            () => {
              noteInputRef.current?.focus();
            },
          );
        }}
      >
        <KeyboardAvoidingView
          style={
            styles.noteEditorModalRoot
          }
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : 'height'
          }
        >
          <Pressable
            style={
              styles.noteEditorBackdrop
            }
            onPress={
              closeOrderNoteEditor
            }
          />

          <View
            style={
              styles.noteEditorSheet
            }
          >
            <View
              style={
                styles.noteEditorInputFrame
              }
            >
              <TextInput
                ref={
                  noteInputRef
                }
                autoFocus
                multiline
                maxLength={200}
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
                style={
                  styles.noteEditorInput
                }
                value={
                  draftOrderNote
                }
                onChangeText={
                  handleDraftOrderNoteChange
                }
                onSubmitEditing={
                  closeOrderNoteEditor
                }
                placeholder="دوّن ملاحظة"
                placeholderTextColor="#A0A0A0"
                textAlign="right"
                textAlignVertical="top"
              />
            </View>

            <Text
              style={
                styles.noteEditorCounter
              }
            >
              {draftOrderNote.length}/200
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CLEAR CART MODAL */}

      {clearModalVisible ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() =>
            setClearModalVisible(false)
          }
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
            <View
              style={styles.modalDangerIcon}
            >
              <Ionicons
                name="trash-outline"
                size={22}
                color="#d64b4b"
              />
            </View>

            <Text
              style={styles.modalTitle}
            >
              إفراغ السلة؟
            </Text>

            <Text
              style={
                styles.modalDescription
              }
            >
              سيتم حذف منتجات{' '}
              {storeName ?? 'هذا المتجر'}{' '}
              فقط، ولن تتأثر السلال الأخرى.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.dangerButton,

                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={handleClearCart}
            >
              <Text
                style={
                  styles.dangerButtonText
                }
              >
                نعم، إفراغ هذه السلة
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.modalCancelButton,

                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={() =>
                setClearModalVisible(false)
              }
            >
              <Text
                style={
                  styles.modalCancelButtonText
                }
              >
                إلغاء
              </Text>
            </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /* ============================================================
   * MULTI CART PICKER
   * ============================================================
   */

  cartPickerScreen: {
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'flex-end',
  },

  cartPickerBackdrop: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    backgroundColor:
      'rgba(0, 0, 0, 0.46)',
  },

  cartPickerSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '76%',
    minHeight: 310,
    overflow: 'hidden',
    paddingBottom: 11,
    paddingHorizontal: 18,
    paddingTop: 0,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -6,
    },
    shadowOpacity: 0.16,
    shadowRadius: 16,

    elevation: 24,
  },

  sheetDragArea: {
    marginHorizontal: -18,
    paddingHorizontal: 18,
    paddingTop: 7,
  },

  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#e5e5e5',
    borderRadius: 3,
    height: 4,
    marginTop: 3,
    width: 44,
  },

  sheetTopRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    height: 52,
    justifyContent: 'flex-start',
  },

  sheetCloseButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e1e1e1',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },

  sheetCloseButtonPressed: {
    backgroundColor: '#f6f6f6',
    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  cartPickerTitle: {
    color: '#1e1e1e',
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 28,
    marginBottom: 10,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  cartPickerList: {
    flexGrow: 0,
  },

  cartPickerListContent: {
    paddingBottom: 4,
  },

  cartPickerRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    minHeight: 92,
    paddingVertical: 8,
  },

  cartPickerRowBorder: {
    borderBottomColor: '#e6e6e6',
    borderBottomWidth: 1,
  },

  cartPickerRowPressed: {
    opacity: 0.74,
  },

  cartPickerLogoBox: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderColor: '#eeeeee',
    borderRadius: 11,
    borderWidth: 1,
    height: 62,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 62,
  },

  cartPickerLogo: {
    height: '100%',
    width: '100%',
  },

  cartPickerLogoFallback: {
    fontSize: 30,
  },

  cartPickerStoreContent: {
    flex: 1,
    marginHorizontal: 12,
  },

  cartPickerStoreName: {
    color: '#1d1d1d',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  cartPickerItemCount: {
    color: '#444444',
    fontSize: 12.5,
    marginTop: 3,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  cartPickerPrice: {
    color: '#1d1d1d',
    fontSize: 14.5,
    fontWeight: '700',
    minWidth: 80,
    textAlign: 'left',
  },

  cartPickerNote: {
    borderTopColor: '#e6e6e6',
    borderTopWidth: 1,
    marginTop: 7,
    paddingHorizontal: 10,
    paddingTop: 18,
  },

  cartPickerNoteText: {
    color: '#858585',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  homeIndicator: {
    alignSelf: 'center',
    backgroundColor: '#111111',
    borderRadius: 4,
    height: 5,
    marginTop: 20,
    width: 134,
  },

  /* ============================================================
   * NORMAL CART SCREEN
   * ============================================================
   */

  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  mainScrollView: {
    flex: 1,
  },

  pageContent: {
    paddingBottom: 114,
  },

  /* ---------------------------------- */
  /* STICKY HEADER                      */
  /* ---------------------------------- */

  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    flexShrink: 0,
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 14,
    position: 'relative',
    zIndex: 100,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.025,
    shadowRadius: 4,

    elevation: 2,
  },

  backButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e5e5',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },

  headerContent: {
    flex: 1,
    marginLeft: 12,
  },

  pageTitle: {
    color: '#202020',
    fontSize: 18,
    fontWeight: '800',
  },

  headerStoreName: {
    color: '#8a8a8a',
    fontSize: 11,
    marginTop: 2,
  },

  clearCartButton: {
    paddingHorizontal: 6,
    paddingVertical: 7,
  },

  clearCartButtonText: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '700',
  },

  /* ---------------------------------- */
  /* CART ITEMS                         */
  /* ---------------------------------- */

  itemsSection: {
    paddingHorizontal: 18,
  },

  itemRow: {
    flexDirection: 'row',
    minHeight: 178,
    paddingBottom: 18,
    paddingTop: 8,
    borderBottomColor: '#e8e8e8',
    borderBottomWidth: 1,
  },

  itemRowLast: {
    borderBottomWidth: 0,
  },

  itemContent: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingRight: 12,
  },

  itemName: {
    color: '#242424',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'left',
  },

  variantName: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    textAlign: 'left',
    width: '100%',
  },

  editButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    marginTop: 8,
    paddingVertical: 2,
  },

  editButtonText: {
    borderBottomColor: BRAND_GREEN,
    borderBottomWidth: 1,
    color: BRAND_GREEN,
    fontSize: 12.5,
    fontWeight: '600',
    marginLeft: 4,
  },

  itemPriceContainer: {
    marginTop: 'auto',
    paddingBottom: 4,
  },

  itemPrice: {
    color: '#242424',
    fontSize: 14.5,
    fontWeight: '600',
  },

  itemMedia: {
    height: 158,
    position: 'relative',
    width: 158,
  },

  itemImage: {
    backgroundColor: '#f2f2f2',
    borderRadius: 13,
    height: '100%',
    width: '100%',
  },

  itemImageFallback: {
    alignItems: 'center',
    backgroundColor: '#f4f4f4',
    borderRadius: 13,
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },

  itemEmoji: {
    fontSize: 40,
  },

  quantityControl: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e4e4e4',
    borderRadius: 21,
    borderWidth: 1,
    bottom: -6,
    flexDirection: 'row',
    height: 40,
    justifyContent: 'space-between',
    left: 6,
    paddingHorizontal: 4,
    position: 'absolute',
    right: 6,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 5,

    elevation: 4,
  },

  quantityButton: {
    alignItems: 'center',
    borderRadius: 17,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },

  quantityText: {
    color: '#242424',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'center',
  },

  /* ---------------------------------- */
  /* RECOMMENDATIONS                    */
  /* ---------------------------------- */

  recommendationsSection: {
    backgroundColor: '#faf8f4',
    marginTop: 8,
    paddingBottom: 18,
    paddingTop: 19,
  },

  recommendationsTitle: {
    color: '#242424',
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 18,
  },

  recommendationsScroll: {
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 14,
  },

  recommendationCard: {
    width: 142,
  },

  recommendationImageWrapper: {
    height: 170,
    position: 'relative',
    width: 142,
  },

  recommendationImage: {
    backgroundColor: '#f1f1f1',
    borderColor: '#e3e3e3',
    borderRadius: 14,
    borderWidth: 1,
    height: '100%',
    width: '100%',
  },

  recommendationImageFallback: {
    alignItems: 'center',
    backgroundColor: '#f3f3f3',
    borderColor: '#e3e3e3',
    borderRadius: 14,
    borderWidth: 1,
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },

  recommendationEmoji: {
    fontSize: 34,
  },

  recommendationAddButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e5e5e5',
    borderRadius: 19,
    borderWidth: 1,
    bottom: 8,
    height: 38,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    width: 38,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.09,
    shadowRadius: 5,

    elevation: 4,
  },

  recommendationAddButtonPressed: {
    transform: [
      {
        scale: 0.94,
      },
    ],
  },

  recommendationName: {
    color: '#252525',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 8,
  },

  recommendationPrice: {
    color: '#363636',
    fontSize: 12,
    marginTop: 3,
  },


  /* ---------------------------------- */
  /* SPIN REWARD                        */
  /* ---------------------------------- */

  spinSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingTop: 18,
  },

  spinCard: {
    backgroundColor: '#FAFBFA',
    borderColor: '#E8ECE9',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },

  spinCardReady: {
    backgroundColor: '#07140F',
    borderColor: '#10261D',
  },

  spinCardRewarded: {
    backgroundColor: '#07140F',
    borderColor: '#10261D',
  },

  spinCardPaused: {
    borderColor: '#DDBD73',
  },

  spinCardPressed: {
    opacity: 0.92,
    transform: [
      {
        scale: 0.994,
      },
    ],
  },

  spinLockedCardBody: {
    minHeight: 136,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'relative',
  },

  spinLockedCardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  spinLockedTopIcon: {
    alignItems: 'center',
    borderColor: '#E1E5E2',
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },

  spinLockedTitle: {
    color: '#0E1914',
    fontSize: 15.5,
    fontWeight: '900',
    letterSpacing: -0.35,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  spinLockedAmountRow: {
    alignItems: 'flex-end',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    marginTop: 11,
  },

  spinLockedCurrentValue: {
    color: '#02130F',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.6,
    lineHeight: 40,
  },

  spinLockedGoalText: {
    color: '#5E6866',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 4,
    marginRight: 7,
    writingDirection: 'rtl',
  },

  spinProgressArea: {
    marginTop: 8,
  },

  spinProgressTrack: {
    backgroundColor: '#E8ECEA',
    borderRadius: 999,
    height: 5,
    overflow: 'hidden',
    width: '100%',
  },

  spinProgressFill: {
    backgroundColor: '#15995B',
    borderRadius: 999,
    height: '100%',
  },

  spinLockedRemainingRow: {
    alignItems: 'baseline',
    flexDirection: 'row-reverse',
    marginTop: 7,
  },

  spinLockedRemainingNumber: {
    color: '#178857',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 19,
  },

  spinLockedRemainingLabel: {
    color: '#535F5B',
    fontSize: 11,
    fontWeight: '600',
    marginRight: 5,
    writingDirection: 'rtl',
  },

  spinLockedDivider: {
    backgroundColor: '#ECEFED',
    height: 1,
    marginTop: 8,
    width: '100%',
  },

  spinLockedHintRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    marginTop: 8,
  },

  spinLockedHintIcon: {
    alignItems: 'center',
    borderColor: '#E6E9E7',
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    marginLeft: 8,
    width: 28,
  },

  spinLockedHintText: {
    color: '#57605D',
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  spinLockedCornerGlow: {
    backgroundColor: 'rgba(84, 193, 115, 0.11)',
    borderRadius: 100,
    bottom: -75,
    height: 132,
    position: 'absolute',
    right: -10,
    transform: [
      { rotate: '-20deg' },
    ],
    width: 132,
  },

  spinCardReadyBody: {
    minHeight: 108,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'relative',
  },

  spinCardReadyGlowOne: {
    backgroundColor: 'rgba(66, 195, 94, 0.26)',
    borderRadius: 105,
    bottom: -60,
    height: 180,
    left: -30,
    position: 'absolute',
    width: 180,
  },

  spinCardReadyGlowTwo: {
    backgroundColor: 'rgba(191, 255, 166, 0.10)',
    borderRadius: 100,
    height: 120,
    position: 'absolute',
    right: 40,
    top: -30,
    width: 120,
  },

  spinCardReadyPill: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(6, 38, 26, 0.72)',
    borderColor: 'rgba(181, 255, 188, 0.12)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  spinCardReadyPillText: {
    color: '#F3FBF5',
    fontSize: 9.5,
    fontWeight: '700',
    writingDirection: 'rtl',
  },

  spinCardReadyTitle: {
    color: '#F7FBF8',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 23,
    marginTop: 7,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  spinCardReadySubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10.5,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 3,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  spinCardReadyFooter: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 36,
  },

  spinCardReadyFooterText: {
    color: '#07140F',
    fontSize: 11.5,
    fontWeight: '900',
    marginHorizontal: 5,
    writingDirection: 'rtl',
  },

  spinRewardCardBody: {
    minHeight: 108,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'relative',
  },

  spinRewardCardHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
  },

  spinRewardCardBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(101, 206, 120, 0.24)',
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },

  spinRewardCardHeaderText: {
    color: '#8FD37B',
    fontSize: 11.5,
    fontWeight: '800',
    marginRight: 5,
    writingDirection: 'rtl',
  },

  spinRewardCardValue: {
    color: '#FFFFFF',
    fontSize: 50,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 56,
    marginTop: 5,
    textAlign: 'center',
  },

  spinRewardCardCurrency: {
    color: '#79BC66',
    fontSize: 13.5,
    fontWeight: '800',
    marginTop: -2,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  spinRewardCardSubtitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  spinInlineErrorText: {
    color: '#B5473A',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 17,
    paddingHorizontal: 18,
    paddingBottom: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  spinModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  spinModalBackdrop: {
    backgroundColor:
      'rgba(0, 0, 0, 0.54)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  spinSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    minHeight: '60%',
    overflow: 'hidden',
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 9,

    shadowColor: '#03150D',
    shadowOffset: {
      width: 0,
      height: -10,
    },
    shadowOpacity: 0.22,
    shadowRadius: 24,

    elevation: 26,
  },

  spinSheetDark: {
    backgroundColor: '#05110D',
  },

  spinSheetHandle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 4,
    height: 4,
    width: 40,
  },

  spinSheetClose: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 17,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    marginTop: 7,
    width: 34,
  },

  spinSheetCloseDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
  },

  spinSheetClosePressed: {
    opacity: 0.65,
    transform: [
      {
        scale: 0.96,
      },
    ],
  },

  spinReadyContent: {
    alignItems: 'center',
    flex: 1,
    overflow: 'hidden',
    paddingTop: 4,
    position: 'relative',
  },

  spinReadyBackdropGlowTop: {
    backgroundColor: 'rgba(141, 234, 126, 0.12)',
    borderRadius: 200,
    height: 240,
    position: 'absolute',
    right: 65,
    top: -70,
    width: 240,
  },

  spinReadyBackdropGlowBottom: {
    backgroundColor: 'rgba(41, 166, 73, 0.14)',
    borderRadius: 180,
    bottom: 120,
    height: 170,
    left: -70,
    width: 170,
    position: 'absolute',
  },

  spinReadyTopPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(5, 29, 20, 0.72)',
    borderColor: 'rgba(201,255,195,0.10)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  spinReadyTopPillText: {
    color: '#EAF8EE',
    fontSize: 10,
    fontWeight: '700',
    writingDirection: 'rtl',
  },

  spinSheetTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 28,
    marginTop: 10,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  spinSheetSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10.5,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 4,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  spinRevealStage: {
    alignItems: 'center',
    height: 142,
    justifyContent: 'center',
    marginTop: 6,
    position: 'relative',
    width: '100%',
  },

  spinRevealOrbitGlow: {
    backgroundColor: 'rgba(102, 255, 120, 0.18)',
    borderRadius: 90,
    bottom: 18,
    height: 120,
    left: 24,
    position: 'absolute',
    width: 120,
  },

  spinRevealOrbitRing: {
    borderColor: 'rgba(232, 244, 225, 0.78)',
    borderRadius: 66,
    borderWidth: 1.5,
    height: 132,
    width: 132,
  },

  spinRevealOrbitDot: {
    backgroundColor: '#F7FFF8',
    borderRadius: 5,
    height: 9,
    position: 'absolute',
    top: 20,
    width: 9,
  },

  spinRevealTicketWrap: {
    alignItems: 'center',
    backgroundColor: '#C8F187',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    position: 'absolute',
    transform: [
      { rotate: '-18deg' },
    ],
    width: 52,
  },

  spinWheelStage: {
    alignItems: 'center',
    height: 252,
    justifyContent: 'center',
    marginTop: 2,
    position: 'relative',
    width: 242,
  },

  spinWheelHaloOuter: {
    backgroundColor: '#EAF8F0',
    borderRadius: 121,
    height: 242,
    opacity: 0.64,
    position: 'absolute',
    width: 242,
  },

  spinWheelHaloInner: {
    backgroundColor: '#F4FCF7',
    borderColor: '#D7EFE0',
    borderRadius: 114,
    borderWidth: 1,
    height: 228,
    position: 'absolute',
    width: 228,
  },

  spinWheelAssembly: {
    alignItems: 'center',
    height: PREMIUM_WHEEL_SIZE,
    justifyContent: 'center',
    width: PREMIUM_WHEEL_SIZE,
  },

  spinWheelOuterRim: {
    backgroundColor: '#073B27',
    borderColor: '#FFFFFF',
    borderRadius:
      PREMIUM_WHEEL_SIZE / 2,
    borderWidth: 5,
    height: PREMIUM_WHEEL_SIZE,
    overflow: 'hidden',
    position: 'relative',
    width: PREMIUM_WHEEL_SIZE,

    shadowColor: '#06321F',
    shadowOffset: {
      width: 0,
      height: 15,
    },
    shadowOpacity: 0.22,
    shadowRadius: 24,

    elevation: 15,
  },

  spinWheelRimHighlight: {
    borderColor: 'rgba(255,255,255,0.46)',
    borderRadius:
      PREMIUM_WHEEL_SIZE / 2,
    borderWidth: 1,
    bottom: 5,
    left: 5,
    position: 'absolute',
    right: 5,
    top: 5,
    zIndex: 5,
  },

  spinWheelSvg: {
    left: 0,
    position: 'absolute',
    top: 0,
  },

  spinWheelLabel: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 8,
  },

  spinWheelLabelMain: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: -0.1,
    lineHeight: 12,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  spinWheelLabelSub: {
    fontSize: 7,
    fontWeight: '800',
    lineHeight: 8,
    marginTop: 1,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  spinWheelLabelLight: {
    color: '#FFFFFF',
  },

  spinWheelLabelLightMuted: {
    color: 'rgba(255,255,255,0.76)',
  },

  spinWheelLabelDark: {
    color: '#0B5B33',
  },

  spinWheelLabelDarkMuted: {
    color: '#4B7B61',
  },

  spinWheelCenterShadow: {
    alignItems: 'center',
    backgroundColor: 'rgba(3,48,28,0.13)',
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    position: 'absolute',
    width: 72,

    shadowColor: '#052E1D',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.2,
    shadowRadius: 10,

    elevation: 14,
  },

  spinWheelCenterOuter: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D9F0E2',
    borderRadius: 32,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },

  spinWheelCenterInner: {
    alignItems: 'center',
    backgroundColor: BRAND_GREEN,
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52,
  },

  spinWheelCenterShine: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 70,
    height: 68,
    left: -27,
    position: 'absolute',
    top: -44,
    transform: [
      {
        rotate: '-18deg',
      },
    ],
    width: 104,
  },

  spinWheelCenterText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 14,
    marginTop: 1,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  spinWheelPointerWrap: {
    alignItems: 'center',
    height: 46,
    justifyContent: 'flex-start',
    position: 'absolute',
    top: 1,
    width: 40,
    zIndex: 30,
  },

  spinWheelPointerCap: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D2EBDD',
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,

    shadowColor: '#072D1D',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.14,
    shadowRadius: 8,

    elevation: 11,
  },

  spinWheelPointerDot: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 5,
    height: 10,
    width: 10,
  },

  spinWheelPointerTip: {
    borderLeftColor: 'transparent',
    borderLeftWidth: 6,
    borderRightColor: 'transparent',
    borderRightWidth: 6,
    borderTopColor: '#FFFFFF',
    borderTopWidth: 11,
    height: 0,
    marginTop: -4,
    width: 0,
  },

  spinPrimaryButton: {
    alignItems: 'center',
    borderRadius: 16,
    height: 46,
    justifyContent: 'center',
    marginTop: 6,
    width: '100%',
  },

  spinPrimaryButtonLight: {
    backgroundColor: '#FFFFFF',
  },

  spinPrimaryButtonResult: {
    backgroundColor: '#67B457',
    marginTop: 16,
  },

  spinPrimaryButtonDisabled: {
    opacity: 0.82,
  },

  spinPrimaryButtonRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
  },

  spinPrimaryButtonText: {
    fontSize: 13,
    fontWeight: '900',
    writingDirection: 'rtl',
  },

  spinPrimaryButtonTextLight: {
    color: '#07140F',
    marginHorizontal: 6,
  },

  spinPrimaryButtonTextDark: {
    color: '#FFFFFF',
    marginHorizontal: 6,
  },

  spinButtonLoading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 9,
  },

  spinFinePrintRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 5,
    marginTop: 8,
  },

  spinFinePrint: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  spinResultContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    paddingBottom: 14,
    paddingHorizontal: 7,
    paddingTop: 14,
    position: 'relative',
  },

  spinResultGlowTop: {
    backgroundColor: 'rgba(221, 255, 180, 0.15)',
    borderRadius: 200,
    height: 260,
    position: 'absolute',
    right: 100,
    top: -120,
    width: 260,
  },

  spinResultGlowCenter: {
    backgroundColor: 'rgba(90, 212, 92, 0.22)',
    borderRadius: 220,
    height: 320,
    position: 'absolute',
    top: 120,
    width: 320,
  },

  spinResultConfettiOne: {
    backgroundColor: 'rgba(170, 255, 120, 0.72)',
    height: 16,
    left: 20,
    position: 'absolute',
    top: 50,
    transform: [{ rotate: '-45deg' }],
    width: 10,
  },

  spinResultConfettiTwo: {
    backgroundColor: 'rgba(90, 205, 112, 0.74)',
    height: 16,
    left: 58,
    position: 'absolute',
    top: 108,
    transform: [{ rotate: '45deg' }],
    width: 10,
  },

  spinResultConfettiThree: {
    backgroundColor: 'rgba(134, 239, 152, 0.74)',
    height: 14,
    position: 'absolute',
    right: 34,
    top: 58,
    transform: [{ rotate: '45deg' }],
    width: 9,
  },

  spinResultConfettiFour: {
    backgroundColor: 'rgba(73, 171, 96, 0.74)',
    height: 16,
    position: 'absolute',
    right: 16,
    top: 116,
    transform: [{ rotate: '-45deg' }],
    width: 10,
  },

  spinResultConfettiFive: {
    backgroundColor: 'rgba(151, 241, 120, 0.66)',
    height: 14,
    left: 74,
    position: 'absolute',
    top: 264,
    transform: [{ rotate: '-45deg' }],
    width: 9,
  },

  spinResultConfettiSix: {
    backgroundColor: 'rgba(73, 171, 96, 0.52)',
    height: 14,
    position: 'absolute',
    right: 46,
    top: 280,
    transform: [{ rotate: '45deg' }],
    width: 9,
  },

  spinResultStatusBadge: {
    alignItems: 'center',
    marginTop: 8,
  },

  spinResultStatusIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(156, 223, 139, 0.84)',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },

  spinResultStatusText: {
    color: '#A5DB82',
    fontSize: 11.5,
    fontWeight: '800',
    marginTop: 7,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  spinResultMassiveValue: {
    color: '#FFFFFF',
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -3.2,
    lineHeight: 70,
    marginTop: 8,
    textAlign: 'center',
  },

  spinResultCurrencyWord: {
    color: '#7DC465',
    fontSize: 16,
    fontWeight: '900',
    marginTop: -2,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  spinResultMessage: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  spinResultFutureMeta: {
    alignItems: 'center',
    marginTop: 13,
    paddingHorizontal: 10,
  },

  spinResultFutureMetaText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 17,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  spinResultLedger: {
    marginTop: 13,
    width: '100%',
  },

  spinResultLedgerDivider: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    height: 1,
    width: '100%',
  },

  spinResultLedgerRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 6,
  },

  spinResultLedgerOldValue: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    fontWeight: '500',
    writingDirection: 'rtl',
  },

  spinResultLedgerNewValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    writingDirection: 'rtl',
  },

  spinPausedNotice: {
    alignItems: 'center',
    backgroundColor: 'rgba(193, 145, 42, 0.14)',
    borderColor: 'rgba(221, 188, 110, 0.24)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    width: '100%',
  },

  spinPausedNoticeText: {
    color: '#E2C98B',
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  /* ---------------------------------- */
  /* ORDER NOTES                        */
  /* ---------------------------------- */

  /* ---------------------------------- */
  /* REFERENCE — NOTES                  */
  /* ---------------------------------- */

  referenceNotesSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  referenceSectionTitle: {
    color: '#242424',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 28,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceNotesRow: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    marginTop: 16,
    paddingVertical: 2,
  },

  referenceNotesRowPressed: {
    opacity: 0.58,
  },

  referenceNotesIcon: {
    marginLeft: 11,
    marginTop: 3,
  },

  referenceNotesCopy: {
    flex: 1,
  },

  referenceNotesLabel: {
    color: '#242424',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceNotesPreview: {
    color: '#4A4A4A',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
    marginTop: 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceNotesPreviewPlaceholder: {
    color: '#8A8A8A',
  },

  /* ---------------------------------- */
  /* REFERENCE — VOUCHER                */
  /* ---------------------------------- */

  referenceVoucherSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 28,
  },

  referenceVoucherField: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DCDCDC',
    borderRadius: 16,
    borderWidth: 1.2,
    flexDirection: 'row-reverse',
    marginTop: 14,
    minHeight: 54,
    paddingHorizontal: 15,
  },

  referenceVoucherFieldApplied: {
    borderColor: '#CBEBD8',
  },

  referenceVoucherSpinNotice: {
    alignItems: 'center',
    backgroundColor: BRAND_GREEN_SOFT,
    borderColor: '#CBEBD8',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    marginTop: 14,
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  referenceVoucherSpinNoticeIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },

  referenceVoucherSpinNoticeCopy: {
    flex: 1,
    marginRight: 11,
  },

  referenceVoucherSpinNoticeTitle: {
    color: '#176A3A',
    fontSize: 12.5,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceVoucherSpinNoticeText: {
    color: '#4F765F',
    fontSize: 10.5,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceVoucherInput: {
    color: '#242424',
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    minHeight: 50,
    paddingHorizontal: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceVoucherAppliedCopy: {
    flex: 1,
    marginHorizontal: 12,
  },

  referenceVoucherAppliedCode: {
    color: '#242424',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'ltr',
  },

  referenceVoucherAppliedSaving: {
    color: BRAND_GREEN,
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceVoucherAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 48,
    paddingHorizontal: 4,
  },

  referenceVoucherActionPressed: {
    opacity: 0.55,
  },

  referenceVoucherActionText: {
    color: '#242424',
    fontSize: 12.5,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  referenceVoucherActionTextDisabled: {
    color: '#A0A0A0',
  },

  referenceVoucherErrorRow: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    gap: 6,
    marginTop: 9,
  },

  referenceVoucherErrorText: {
    color: '#D64B4B',
    flex: 1,
    fontSize: 10.5,
    lineHeight: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  /* ---------------------------------- */
  /* REFERENCE — PAYMENT SUMMARY        */
  /* ---------------------------------- */

  referencePaymentSummary: {
    backgroundColor: '#ffffff',
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 30,
  },

  referencePaymentTitle: {
    color: '#242424',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.45,
    lineHeight: 29,
    marginBottom: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    minHeight: 32,
  },

  referenceSummaryLabel: {
    color: '#313131',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceSummaryLabelWithInfo: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
  },

  referenceSummaryValue: {
    color: '#303030',
    fontSize: 13,
    fontWeight: '500',
    minWidth: 82,
    textAlign: 'left',
    writingDirection: 'ltr',
  },

  referenceDiscountLabel: {
    color: BRAND_GREEN,
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceDiscountValue: {
    color: BRAND_GREEN,
    fontSize: 12.5,
    fontWeight: '800',
    minWidth: 82,
    textAlign: 'left',
    writingDirection: 'ltr',
  },

  referenceTotalRow: {
    marginTop: 14,
    minHeight: 42,
  },

  referenceTotalLabel: {
    color: '#202020',
    fontSize: 16.5,
    fontWeight: '900',
    lineHeight: 23,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  referenceTotalValue: {
    color: BRAND_GREEN,
    fontSize: 18,
    fontWeight: '900',
    minWidth: 94,
    textAlign: 'left',
    writingDirection: 'ltr',
  },

  minimumNotice: {
    alignItems: 'center',
    backgroundColor: '#fff8e7',
    borderRadius: 11,
    flexDirection: 'row',
    marginHorizontal: 18,
    marginTop: 11,
    padding: 9,
  },

  minimumNoticeText: {
    color: '#82651f',
    flex: 1,
    fontSize: 10.5,
    fontWeight: '600',
    marginLeft: 6,
  },

  /* ---------------------------------- */
  /* BOTTOM BAR                         */
  /* ---------------------------------- */

  checkoutBarWrapper: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e8e8e8',
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 0,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,

    elevation: 12,
  },

  checkoutBar: {
    flexDirection: 'row-reverse',
    gap: 10,
  },

  addItemsButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#252525',
    borderRadius: 25,
    borderWidth: 1.5,
    flex: 1,
    height: 52,
    justifyContent: 'center',
  },

  addItemsButtonText: {
    color: '#242424',
    fontSize: 14.5,
    fontWeight: '800',
  },

  checkoutButton: {
    alignItems: 'center',
    backgroundColor: BRAND_GREEN,
    borderRadius: 25,
    flex: 1,
    height: 52,
    justifyContent: 'center',
  },

  checkoutButtonDisabled: {
    backgroundColor: '#dddddd',
  },

  checkoutButtonText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '800',
  },

  checkoutButtonTextDisabled: {
    color: '#8b8b8b',
  },

  bottomButtonPressed: {
    opacity: 0.88,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  /* ---------------------------------- */
  /* ORDER NOTE EDITOR                  */
  /* ---------------------------------- */

  noteEditorModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  noteEditorBackdrop: {
    backgroundColor:
      'rgba(0, 0, 0, 0.50)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  noteEditorSheet: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  noteEditorInputFrame: {
    backgroundColor: '#FFFFFF',
    borderColor: '#242424',
    borderRadius: 19,
    borderWidth: 1.5,
    minHeight: 162,
    overflow: 'hidden',
  },

  noteEditorInput: {
    color: '#242424',
    fontSize: 14.5,
    lineHeight: 22,
    minHeight: 158,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  noteEditorCounter: {
    color: '#8A8A8A',
    fontSize: 12,
    marginTop: 8,
    paddingHorizontal: 16,
    textAlign: 'left',
    writingDirection: 'ltr',
  },

  /* ---------------------------------- */
  /* MODALS                             */
  /* ---------------------------------- */

  modalOverlay: {
    alignItems: 'center',
    backgroundColor:
      'rgba(0, 0, 0, 0.50)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },

  modalCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    maxWidth: 400,
    padding: 20,
    width: '100%',
  },

  modalDangerIcon: {
    alignItems: 'center',
    backgroundColor: '#fff1f1',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },

  modalTitle: {
    color: '#242424',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },

  modalDescription: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 7,
    textAlign: 'center',
  },

  dangerButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#d84a4a',
    borderRadius: 13,
    marginTop: 18,
    paddingVertical: 11,
  },

  dangerButtonText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
  },

  modalCancelButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#f2f2f2',
    borderRadius: 13,
    marginTop: 8,
    paddingVertical: 11,
  },

  modalCancelButtonText: {
    color: '#555555',
    fontSize: 12.5,
    fontWeight: '700',
  },

  /* ---------------------------------- */
  /* EMPTY CART                         */
  /* ---------------------------------- */

  emptyScreen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },

  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 56,
    paddingHorizontal: 28,
  },

  emptyIllustration: {
    alignItems: 'center',
    height: 178,
    justifyContent: 'center',
    width: 188,
  },

  emptyEyebrow: {
    backgroundColor: EMPTY_CART_MINT,
    borderRadius: 999,
    color: '#07883E',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 26,
    overflow: 'hidden',
    paddingHorizontal: 13,
    paddingVertical: 7,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  emptyTitle: {
    color: '#1F2421',
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 32,
    marginTop: 16,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  emptyDescription: {
    color: '#7A807C',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 285,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  primaryButton: {
    alignItems: 'center',
    backgroundColor: BRAND_GREEN,
    borderRadius: 27,
    flexDirection: 'row-reverse',
    gap: 10,
    height: 54,
    justifyContent: 'center',
    marginTop: 30,
    minWidth: 188,
    paddingHorizontal: 22,
  },

  primaryButtonPressed: {
    opacity: 0.9,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  primaryButtonIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 16,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },

  buttonPressed: {
    opacity: 0.7,
  },
});
