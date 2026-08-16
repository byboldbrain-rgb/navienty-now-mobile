import {
    useEffect,
    useRef,
    type ReactNode,
} from 'react';
import {
    Animated,
    Easing,
    StyleSheet,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

type SkeletonBlockProps = {
  width?: ViewStyle['width'];
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

function SkeletonBlock({
  width = '100%',
  height,
  radius = 14,
  style,
}: SkeletonBlockProps) {
  return (
    <View
      style={[
        styles.block,
        {
          width,
          height,
          borderRadius: radius,
        },
        style,
      ]}
    />
  );
}

function SkeletonSurface({
  children,
  backgroundColor = '#FFFFFF',
}: {
  children: ReactNode;
  backgroundColor?: string;
}) {
  const opacity = useRef(
    new Animated.Value(0.52),
  ).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.92,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.52,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.screen,
        { backgroundColor },
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          { opacity },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

function HeaderSkeleton() {
  return (
    <View style={styles.simpleHeader}>
      <SkeletonBlock
        width={44}
        height={44}
        radius={22}
      />

      <SkeletonBlock
        width="34%"
        height={20}
        radius={10}
      />

      <SkeletonBlock
        width={44}
        height={44}
        radius={22}
      />
    </View>
  );
}

export function AccountScreenSkeleton() {
  return (
    <SkeletonSurface backgroundColor="#F7F7FA">
      <View style={styles.page}>
        <HeaderSkeleton />

        <View style={styles.accountProfileCard}>
          <SkeletonBlock
            width={78}
            height={78}
            radius={18}
          />

          <View style={styles.flex}>
            <SkeletonBlock
              width="36%"
              height={20}
              radius={10}
              style={styles.alignEnd}
            />
            <SkeletonBlock
              width="68%"
              height={12}
              radius={6}
              style={[
                styles.alignEnd,
                styles.gap8,
              ]}
            />
            <SkeletonBlock
              width="52%"
              height={10}
              radius={5}
              style={[
                styles.alignEnd,
                styles.gap8,
              ]}
            />
          </View>
        </View>

        <View style={styles.largeCard}>
          <View style={styles.rowBetween}>
            <SkeletonBlock
              width={88}
              height={26}
              radius={13}
            />
            <SkeletonBlock
              width={130}
              height={18}
              radius={9}
            />
          </View>

          {[0, 1, 2, 3].map((item) => (
            <View
              key={item}
              style={styles.fieldSkeleton}
            >
              <SkeletonBlock
                width={72}
                height={10}
                radius={5}
                style={styles.alignEnd}
              />
              <SkeletonBlock
                height={48}
                radius={14}
                style={styles.gap8}
              />
            </View>
          ))}
        </View>

        <View style={styles.largeCard}>
          {[0, 1].map((item) => (
            <View
              key={item}
              style={[
                styles.menuSkeleton,
                item > 0 && styles.topBorder,
              ]}
            >
              <SkeletonBlock
                width={48}
                height={48}
                radius={15}
              />
              <View style={styles.flex}>
                <SkeletonBlock
                  width="44%"
                  height={14}
                  radius={7}
                  style={styles.alignEnd}
                />
                <SkeletonBlock
                  width="70%"
                  height={10}
                  radius={5}
                  style={[
                    styles.alignEnd,
                    styles.gap8,
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </View>
    </SkeletonSurface>
  );
}

export function StoreListScreenSkeleton() {
  return (
    <SkeletonSurface backgroundColor="#F7F7FA">
      <View style={styles.page}>
        <View style={styles.categoryHeroSkeleton}>
          <SkeletonBlock
            width={44}
            height={44}
            radius={14}
            style={styles.lightBlock}
          />

          <View style={styles.heroCopy}>
            <SkeletonBlock
              width={54}
              height={42}
              radius={14}
              style={styles.lightBlock}
            />
            <SkeletonBlock
              width="45%"
              height={28}
              radius={12}
              style={[
                styles.lightBlock,
                styles.gap10,
              ]}
            />
            <SkeletonBlock
              width="70%"
              height={13}
              radius={7}
              style={[
                styles.lightBlock,
                styles.gap10,
              ]}
            />
          </View>
        </View>

        <View style={styles.sectionHeaderSkeleton}>
          <SkeletonBlock
            width={70}
            height={28}
            radius={14}
          />
          <View style={styles.sectionCopySkeleton}>
            <SkeletonBlock
              width={145}
              height={20}
              radius={10}
              style={styles.alignEnd}
            />
            <SkeletonBlock
              width={112}
              height={10}
              radius={5}
              style={[
                styles.alignEnd,
                styles.gap8,
              ]}
            />
          </View>
        </View>

        {[0, 1, 2, 3].map((item) => (
          <View
            key={item}
            style={styles.storeListCard}
          >
            <SkeletonBlock
              width={78}
              height={78}
              radius={17}
            />

            <View style={styles.flex}>
              <SkeletonBlock
                width="58%"
                height={15}
                radius={7}
                style={styles.alignEnd}
              />
              <SkeletonBlock
                width="82%"
                height={10}
                radius={5}
                style={[
                  styles.alignEnd,
                  styles.gap8,
                ]}
              />
              <SkeletonBlock
                width="64%"
                height={9}
                radius={5}
                style={[
                  styles.alignEnd,
                  styles.gap8,
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </SkeletonSurface>
  );
}

export function RestaurantsScreenSkeleton() {
  return (
    <SkeletonSurface backgroundColor="#F7F7FA">
      <View style={styles.page}>
        <HeaderSkeleton />

        <SkeletonBlock
          height={50}
          radius={16}
          style={styles.gap18}
        />

        <View style={styles.categoryRow}>
          {[0, 1, 2, 3, 4].map((item) => (
            <View
              key={item}
              style={styles.categoryItem}
            >
              <SkeletonBlock
                width={62}
                height={62}
                radius={31}
              />
              <SkeletonBlock
                width={54}
                height={9}
                radius={5}
                style={styles.gap8}
              />
            </View>
          ))}
        </View>

        <View style={styles.filterRow}>
          <SkeletonBlock
            width={78}
            height={34}
            radius={17}
          />
          <SkeletonBlock
            width={92}
            height={34}
            radius={17}
          />
          <SkeletonBlock
            width={84}
            height={34}
            radius={17}
          />
        </View>

        {[0, 1, 2].map((item) => (
          <View
            key={item}
            style={styles.restaurantCard}
          >
            <SkeletonBlock
              height={150}
              radius={20}
            />
            <View style={styles.restaurantCardCopy}>
              <SkeletonBlock
                width="52%"
                height={17}
                radius={8}
                style={styles.alignEnd}
              />
              <SkeletonBlock
                width="78%"
                height={10}
                radius={5}
                style={[
                  styles.alignEnd,
                  styles.gap8,
                ]}
              />
              <SkeletonBlock
                width="58%"
                height={10}
                radius={5}
                style={[
                  styles.alignEnd,
                  styles.gap8,
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </SkeletonSurface>
  );
}

export function CatalogHomeScreenSkeleton() {
  return (
    <SkeletonSurface backgroundColor="#FFFFFF">
      <View style={styles.catalogPage}>
        <View style={styles.leftHeader}>
          <SkeletonBlock
            width={46}
            height={46}
            radius={23}
          />
        </View>

        <SkeletonBlock
          width={165}
          height={21}
          radius={10}
          style={styles.gap10}
        />

        <View style={styles.catalogCategories}>
          {[0, 1, 2, 3].map((column) => (
            <View
              key={column}
              style={styles.catalogCategoryColumn}
            >
              {[0, 1, 2].map((row) => (
                <View
                  key={row}
                  style={styles.catalogCategoryItem}
                >
                  <SkeletonBlock
                    width={80}
                    height={80}
                    radius={13}
                  />
                  <SkeletonBlock
                    width={64}
                    height={10}
                    radius={5}
                    style={styles.gap8}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>

        <SkeletonBlock
          width={84}
          height={5}
          radius={3}
          style={styles.centered}
        />

        <SkeletonBlock
          height={250}
          radius={0}
          style={styles.gap22}
        />

        <View style={styles.productRail}>
          {[0, 1, 2, 3].map((item) => (
            <View
              key={item}
              style={styles.featuredSkeleton}
            >
              <SkeletonBlock
                height={105}
                radius={12}
              />
              <SkeletonBlock
                width="88%"
                height={10}
                radius={5}
                style={styles.gap8}
              />
              <SkeletonBlock
                width="50%"
                height={10}
                radius={5}
                style={styles.gap8}
              />
            </View>
          ))}
        </View>
      </View>
    </SkeletonSurface>
  );
}

export function ProductGridScreenSkeleton() {
  return (
    <SkeletonSurface backgroundColor="#FFFFFF">
      <View style={styles.catalogPage}>
        <HeaderSkeleton />

        <SkeletonBlock
          height={48}
          radius={16}
          style={styles.gap16}
        />

        <View style={styles.filterRow}>
          <SkeletonBlock
            width={82}
            height={34}
            radius={17}
          />
          <SkeletonBlock
            width={90}
            height={34}
            radius={17}
          />
          <SkeletonBlock
            width={74}
            height={34}
            radius={17}
          />
        </View>

        <View style={styles.grid}>
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <View
              key={item}
              style={styles.gridCard}
            >
              <SkeletonBlock
                height={152}
                radius={15}
              />
              <SkeletonBlock
                width="82%"
                height={11}
                radius={6}
                style={styles.gap8}
              />
              <SkeletonBlock
                width="58%"
                height={10}
                radius={5}
                style={styles.gap8}
              />
              <View style={styles.rowBetween}>
                <SkeletonBlock
                  width="42%"
                  height={12}
                  radius={6}
                />
                <SkeletonBlock
                  width={34}
                  height={34}
                  radius={17}
                />
              </View>
            </View>
          ))}
        </View>
      </View>
    </SkeletonSurface>
  );
}

export function StoreScreenSkeleton() {
  return (
    <SkeletonSurface backgroundColor="#FFFFFF">
      <View style={styles.catalogPage}>
        <View style={styles.leftHeader}>
          <SkeletonBlock
            width={46}
            height={46}
            radius={23}
          />
        </View>

        <SkeletonBlock
          height={210}
          radius={0}
          style={styles.gap10}
        />

        <View style={styles.storeHeaderCopy}>
          <SkeletonBlock
            width="48%"
            height={24}
            radius={12}
            style={styles.alignEnd}
          />
          <SkeletonBlock
            width="74%"
            height={11}
            radius={6}
            style={[
              styles.alignEnd,
              styles.gap8,
            ]}
          />
          <SkeletonBlock
            width="60%"
            height={10}
            radius={5}
            style={[
              styles.alignEnd,
              styles.gap8,
            ]}
          />
        </View>

        <View style={styles.filterRow}>
          <SkeletonBlock
            width={80}
            height={34}
            radius={17}
          />
          <SkeletonBlock
            width={100}
            height={34}
            radius={17}
          />
          <SkeletonBlock
            width={88}
            height={34}
            radius={17}
          />
        </View>

        {[0, 1, 2].map((item) => (
          <View
            key={item}
            style={styles.productRowSkeleton}
          >
            <SkeletonBlock
              width={112}
              height={112}
              radius={18}
            />

            <View style={styles.flex}>
              <SkeletonBlock
                width="68%"
                height={14}
                radius={7}
                style={styles.alignEnd}
              />
              <SkeletonBlock
                width="92%"
                height={10}
                radius={5}
                style={[
                  styles.alignEnd,
                  styles.gap8,
                ]}
              />
              <SkeletonBlock
                width="40%"
                height={13}
                radius={7}
                style={[
                  styles.alignEnd,
                  styles.gap12,
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </SkeletonSurface>
  );
}

export function CheckoutScreenSkeleton() {
  return (
    <SkeletonSurface backgroundColor="#F7F7FA">
      <View style={styles.page}>
        <HeaderSkeleton />

        <View style={styles.largeCard}>
          <SkeletonBlock
            width="42%"
            height={19}
            radius={9}
            style={styles.alignEnd}
          />

          <SkeletonBlock
            height={62}
            radius={16}
            style={styles.gap16}
          />

          <SkeletonBlock
            height={62}
            radius={16}
            style={styles.gap10}
          />
        </View>

        <View style={styles.largeCard}>
          <SkeletonBlock
            width="38%"
            height={19}
            radius={9}
            style={styles.alignEnd}
          />

          {[0, 1, 2, 3].map((item) => (
            <View
              key={item}
              style={styles.paymentSkeleton}
            >
              <SkeletonBlock
                width={46}
                height={46}
                radius={13}
              />
              <SkeletonBlock
                width="48%"
                height={13}
                radius={7}
              />
              <SkeletonBlock
                width={22}
                height={22}
                radius={11}
              />
            </View>
          ))}
        </View>

        <View style={styles.largeCard}>
          <SkeletonBlock
            width="35%"
            height={19}
            radius={9}
            style={styles.alignEnd}
          />

          {[0, 1, 2, 3].map((item) => (
            <View
              key={item}
              style={styles.summaryRow}
            >
              <SkeletonBlock
                width={80}
                height={11}
                radius={6}
              />
              <SkeletonBlock
                width={110}
                height={11}
                radius={6}
              />
            </View>
          ))}

          <SkeletonBlock
            height={56}
            radius={18}
            style={styles.gap18}
          />
        </View>
      </View>
    </SkeletonSurface>
  );
}

export function OrdersScreenSkeleton() {
  return (
    <SkeletonSurface backgroundColor="#F7F7FA">
      <View style={styles.ordersPage}>
        <HeaderSkeleton />

        <View style={styles.orderSummarySkeleton}>
          <View style={styles.flexCenter}>
            <SkeletonBlock
              width={42}
              height={22}
              radius={9}
            />
            <SkeletonBlock
              width={72}
              height={10}
              radius={5}
              style={styles.gap8}
            />
          </View>
          <View style={styles.summarySeparator} />
          <View style={styles.flexCenter}>
            <SkeletonBlock
              width={42}
              height={22}
              radius={9}
            />
            <SkeletonBlock
              width={72}
              height={10}
              radius={5}
              style={styles.gap8}
            />
          </View>
        </View>

        <SkeletonBlock
          width={120}
          height={20}
          radius={10}
          style={[
            styles.alignEnd,
            styles.gap24,
          ]}
        />

        {[0, 1, 2].map((item) => (
          <View
            key={item}
            style={styles.orderCardSkeleton}
          >
            <View style={styles.row}>
              <SkeletonBlock
                width={58}
                height={58}
                radius={16}
              />
              <View style={styles.flex}>
                <SkeletonBlock
                  width="54%"
                  height={15}
                  radius={7}
                  style={styles.alignEnd}
                />
                <SkeletonBlock
                  width="68%"
                  height={9}
                  radius={5}
                  style={[
                    styles.alignEnd,
                    styles.gap8,
                  ]}
                />
              </View>
            </View>

            <SkeletonBlock
              height={38}
              radius={13}
              style={styles.gap14}
            />

            <View style={styles.summaryRow}>
              <SkeletonBlock
                width={76}
                height={30}
                radius={12}
              />
              <SkeletonBlock
                width={90}
                height={30}
                radius={12}
              />
            </View>
          </View>
        ))}
      </View>
    </SkeletonSurface>
  );
}

export function OrderDetailsScreenSkeleton() {
  return (
    <SkeletonSurface backgroundColor="#F7F7FA">
      <View style={styles.page}>
        <HeaderSkeleton />

        <View style={styles.largeCard}>
          <View style={styles.row}>
            <SkeletonBlock
              width={66}
              height={66}
              radius={18}
            />
            <View style={styles.flex}>
              <SkeletonBlock
                width="52%"
                height={18}
                radius={9}
                style={styles.alignEnd}
              />
              <SkeletonBlock
                width="70%"
                height={10}
                radius={5}
                style={[
                  styles.alignEnd,
                  styles.gap8,
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.largeCard}>
          {[0, 1, 2, 3].map((item) => (
            <View
              key={item}
              style={styles.timelineRow}
            >
              <SkeletonBlock
                width={40}
                height={40}
                radius={20}
              />
              <View style={styles.flex}>
                <SkeletonBlock
                  width="48%"
                  height={13}
                  radius={7}
                  style={styles.alignEnd}
                />
                <SkeletonBlock
                  width="72%"
                  height={9}
                  radius={5}
                  style={[
                    styles.alignEnd,
                    styles.gap8,
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.largeCard}>
          {[0, 1, 2, 3].map((item) => (
            <View
              key={item}
              style={styles.summaryRow}
            >
              <SkeletonBlock
                width={92}
                height={11}
                radius={6}
              />
              <SkeletonBlock
                width={120}
                height={11}
                radius={6}
              />
            </View>
          ))}
        </View>
      </View>
    </SkeletonSurface>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  block: {
    backgroundColor: '#E8E9ED',
  },
  lightBlock: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  page: {
    alignSelf: 'center',
    maxWidth: 560,
    paddingHorizontal: 18,
    paddingTop: 42,
    width: '100%',
  },
  catalogPage: {
    alignSelf: 'center',
    maxWidth: 560,
    paddingBottom: 32,
    paddingTop: 10,
    width: '100%',
  },
  ordersPage: {
    alignSelf: 'center',
    maxWidth: 520,
    paddingHorizontal: 18,
    paddingTop: 42,
    width: '100%',
  },
  simpleHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
  },
  leftHeader: {
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  flex: {
    flex: 1,
    marginLeft: 14,
  },
  flexCenter: {
    alignItems: 'center',
    flex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  alignEnd: {
    alignSelf: 'flex-end',
  },
  centered: {
    alignSelf: 'center',
  },
  gap8: {
    marginTop: 8,
  },
  gap10: {
    marginTop: 10,
  },
  gap12: {
    marginTop: 12,
  },
  gap14: {
    marginTop: 14,
  },
  gap16: {
    marginTop: 16,
  },
  gap18: {
    marginTop: 18,
  },
  gap22: {
    marginTop: 22,
  },
  gap24: {
    marginTop: 24,
  },
  accountProfileCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#ECECF0',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 22,
    padding: 18,
  },
  largeCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#ECECF0',
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 17,
    padding: 16,
  },
  fieldSkeleton: {
    marginTop: 14,
  },
  menuSkeleton: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 80,
    paddingVertical: 14,
  },
  topBorder: {
    borderTopColor: '#EFEFF2',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  categoryHeroSkeleton: {
    backgroundColor: '#6D56DF',
    borderRadius: 28,
    minHeight: 220,
    padding: 21,
  },
  heroCopy: {
    alignItems: 'flex-end',
    marginTop: 18,
  },
  sectionHeaderSkeleton: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 28,
  },
  sectionCopySkeleton: {
    alignItems: 'flex-end',
  },
  storeListCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E8EC',
    borderRadius: 21,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    minHeight: 112,
    padding: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  categoryItem: {
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 22,
  },
  restaurantCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#ECECF0',
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 16,
    overflow: 'hidden',
  },
  restaurantCardCopy: {
    padding: 14,
  },
  catalogCategories: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 14,
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  catalogCategoryColumn: {
    gap: 15,
    width: 85,
  },
  catalogCategoryItem: {
    alignItems: 'center',
    width: 85,
  },
  productRail: {
    flexDirection: 'row',
    gap: 8,
    overflow: 'hidden',
    paddingHorizontal: 20,
  },
  featuredSkeleton: {
    width: 105,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 20,
    paddingHorizontal: 16,
  },
  gridCard: {
    width: '48.5%',
  },
  storeHeaderCopy: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  productRowSkeleton: {
    alignItems: 'center',
    borderTopColor: '#EFEFF2',
    borderTopWidth: 1,
    flexDirection: 'row',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  paymentSkeleton: {
    alignItems: 'center',
    borderTopColor: '#EFEFF2',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  orderSummarySkeleton: {
    alignItems: 'center',
    backgroundColor: '#6D56DF',
    borderRadius: 22,
    flexDirection: 'row',
    marginTop: 20,
    paddingVertical: 18,
  },
  summarySeparator: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    height: 38,
    width: 1,
  },
  orderCardSkeleton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#ECECF1',
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 14,
    padding: 17,
  },
  timelineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 18,
  },
});
