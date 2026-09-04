import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RestaurantsScreenSkeleton } from '../../components/ui/loading-skeleton';
import { CuisinesModal } from '../../features/restaurants/cuisines-modal';
import { RestaurantCard } from '../../features/restaurants/restaurant-card';
import {
  type CuisineItem,
  type CuisineKey,
  getCuisineKeyFromRouteParam,
  getVisibleRestaurants,
  PREVIEW_CUISINES,
  VIEW_ALL_CUISINE,
} from '../../features/restaurants/restaurants-domain';
import { useRestaurantsData } from '../../features/restaurants/use-restaurants-data';
import type { StoreSummary } from '../../services/catalog-service';
import { useCustomerStore } from '../../store/customer-store';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../../theme/navienty-now-theme';

const NAVIGATION_PRESS_GUARD_MS = 700;

function BackArrowIcon() {
  return (
    <View style={styles.backArrowCanvas}>
      <View style={styles.backArrowStem} />
      <View
        style={[
          styles.backArrowDiagonal,
          styles.backArrowTop,
        ]}
      />
      <View
        style={[
          styles.backArrowDiagonal,
          styles.backArrowBottom,
        ]}
      />
    </View>
  );
}

function CuisinePreviewItem({
  active,
  cuisine,
  onPress,
}: {
  active: boolean;
  cuisine: Pick<CuisineItem, 'image' | 'label'>;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={cuisine.label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.cuisinePreviewItem,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.cuisinePreviewImage,
          active && styles.cuisinePreviewImageActive,
        ]}
      >
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={`ØµÙˆØ±Ø© ${cuisine.label}`}
          resizeMode="cover"
          source={cuisine.image}
          style={styles.cuisinePreviewPhoto}
        />
      </View>

      <Text
        numberOfLines={1}
        style={[
          styles.cuisinePreviewLabel,
          active && styles.cuisinePreviewLabelActive,
        ]}
      >
        {cuisine.label}
      </Text>
    </Pressable>
  );
}

function ClosedStoreNotice({
  onClose,
  store,
}: {
  onClose: () => void;
  store: StoreSummary | null;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="fade"
      statusBarTranslucent
      transparent
      visible={Boolean(store)}
      onRequestClose={onClose}
    >
      <View style={styles.closedNoticeModal}>
        <Pressable
          accessibilityLabel="Ø¥ØºÙ„Ø§Ù‚ Ø§Ù„ØªÙ†Ø¨ÙŠÙ‡"
          accessibilityRole="button"
          style={styles.closedNoticeBackdrop}
          onPress={onClose}
        />

        <View
          accessibilityViewIsModal
          style={[
            styles.closedNoticeCard,
            {
              marginBottom: Math.max(18, insets.bottom + 8),
            },
          ]}
        >
          <Pressable
            accessibilityLabel="Ø¥ØºÙ„Ø§Ù‚"
            accessibilityRole="button"
            hitSlop={10}
            style={({ pressed }) => [
              styles.closedNoticeCloseButton,
              pressed && styles.closedNoticePressed,
            ]}
            onPress={onClose}
          >
            <Text style={styles.closedNoticeCloseText}>Ã—</Text>
          </Pressable>

          <View style={styles.closedNoticeContent}>
            <Text
              numberOfLines={2}
              style={styles.closedNoticeTitle}
            >
              {store?.name ?? 'Ø§Ù„Ù…Ø·Ø¹Ù…'} Ù…ØºÙ„Ù‚ Ø­Ø§Ù„ÙŠØ§Ù‹
            </Text>
          </View>

          <View style={styles.closedNoticeWarningIcon}>
            <Text style={styles.closedNoticeWarningText}>!</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function RestaurantsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    cuisine?: string | string[];
  }>();

  const requestedCuisineKey = getCuisineKeyFromRouteParam(
    params.cuisine,
  );

  const cuisinesPreviewScrollRef = useRef<ScrollView | null>(null);
  const navigationGuardRef = useRef(0);

  const savedServiceAreaId = useCustomerStore(
    (state) => state.locationServiceAreaId,
  );

  const {
    stores,
    isLoading,
    errorMessage,
    reload,
  } = useRestaurantsData(savedServiceAreaId);

  const [selectedCuisineKey, setSelectedCuisineKey] =
    useState<CuisineKey | null>(null);
  const [draftCuisineKey, setDraftCuisineKey] =
    useState<CuisineKey | null>(null);
  const [isCuisinesModalVisible, setIsCuisinesModalVisible] =
    useState(false);
  const [closedStoreNotice, setClosedStoreNotice] =
    useState<StoreSummary | null>(null);

  useEffect(() => {
    if (!requestedCuisineKey) {
      return;
    }

    setSelectedCuisineKey(requestedCuisineKey);
    setDraftCuisineKey(requestedCuisineKey);
  }, [requestedCuisineKey]);

  const visibleStores = useMemo(
    () => getVisibleRestaurants(stores, selectedCuisineKey),
    [selectedCuisineKey, stores],
  );

  const hasActiveFilters = selectedCuisineKey !== null;

  const handleRestaurantPress = useCallback(
    (store: StoreSummary) => {
      if (store.isManuallyClosed) {
        setClosedStoreNotice(store);
        return;
      }

      const now = Date.now();
      if (now - navigationGuardRef.current < NAVIGATION_PRESS_GUARD_MS) {
        return;
      }

      navigationGuardRef.current = now;

      router.push({
        pathname: '/store/[id]',
        params: {
          id: store.id,
        },
      });
    },
    [router],
  );

  const renderRestaurant = useCallback(
    ({ item, index }: ListRenderItemInfo<StoreSummary>) => (
      <View style={styles.storeListItem}>
        <RestaurantCard
          priority={index < 4 ? 'high' : 'normal'}
          store={item}
          onPress={handleRestaurantPress}
        />
      </View>
    ),
    [handleRestaurantPress],
  );

  const openCuisinesModal = useCallback(() => {
    setDraftCuisineKey(selectedCuisineKey);
    setIsCuisinesModalVisible(true);
  }, [selectedCuisineKey]);

  const closeCuisinesModal = useCallback(() => {
    setIsCuisinesModalVisible(false);
  }, []);

  const toggleSelectedCuisine = useCallback(
    (cuisineKey: CuisineKey) => {
      setSelectedCuisineKey((currentCuisineKey) =>
        currentCuisineKey === cuisineKey ? null : cuisineKey,
      );
    },
    [],
  );

  const toggleDraftCuisine = useCallback(
    (cuisineKey: CuisineKey) => {
      setDraftCuisineKey((currentCuisineKey) =>
        currentCuisineKey === cuisineKey ? null : cuisineKey,
      );
    },
    [],
  );

  const applyCuisineFilters = useCallback(() => {
    setSelectedCuisineKey(draftCuisineKey);
    setIsCuisinesModalVisible(false);
  }, [draftCuisineKey]);

  const resetCuisineFilters = useCallback(() => {
    setDraftCuisineKey(null);
  }, []);

  const resetAllFilters = useCallback(() => {
    setSelectedCuisineKey(null);
  }, []);

  const listHeader = (
    <View style={styles.container}>
      <ScrollView
        horizontal
        contentContainerStyle={styles.cuisinesPreviewContent}
        key="restaurants-cuisines-exact-order"
        ref={cuisinesPreviewScrollRef}
        showsHorizontalScrollIndicator={false}
        style={styles.cuisinesPreview}
        onContentSizeChange={() =>
          cuisinesPreviewScrollRef.current?.scrollToEnd({
            animated: false,
          })
        }
      >
        {PREVIEW_CUISINES.map((cuisine) => (
          <CuisinePreviewItem
            key={cuisine.key}
            active={selectedCuisineKey === cuisine.key}
            cuisine={cuisine}
            onPress={() => toggleSelectedCuisine(cuisine.key)}
          />
        ))}

        <CuisinePreviewItem
          active={false}
          cuisine={VIEW_ALL_CUISINE}
          onPress={openCuisinesModal}
        />
      </ScrollView>

      {hasActiveFilters && (
        <View style={styles.clearFiltersRow}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.clearFiltersButton,
              pressed && styles.pressed,
            ]}
            onPress={resetAllFilters}
          >
            <Text style={styles.clearFiltersText}>Ø…Ø³Ø­ Ø§Ù„ÙÙ„Ø§ØªØ±</Text>
          </Pressable>
        </View>
      )}

      {visibleStores.length > 0 && (
        <View style={styles.storesListTopSpacer} />
      )}
    </View>
  );

  const listEmpty = (
    <View style={styles.container}>
      <View style={styles.emptyCard}>
        <Text style={styles.emptyIcon}>ğŸ”</Text>
        <Text style={styles.emptyTitle}>Ù„Ø§ ØªÙˆØ¬Ø¯ Ù†ØªØ§Ø¦Ø¯</Text>
        <Text style={styles.emptyDescription}>
          Ø¬Ø±Ø¬Ø¨ Ø§Ø®ØªÙŠØ§Ø± Ù…Ø·ØªØ® Ù…Ø®ØªÙ„Ù Ø£Ù‰ Ø§Ø²Ø§Ù„Ø© Ø¨Ø¹Ø¶ Ø§Ù„ÙÙ„Ø§ØªØ±.
        </Text>

        {hasActiveFilters && (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.emptyResetButton,
              pressed && styles.pressed,
            ]}
            onPress={resetAllFilters}
          >
            <Text style={styles.emptyResetButtonText}>
              Ø¹Ø±Ø¶ ÙƒÙ„ Ø§Ù„Ù…Ø·Ø§Ø¹Ù…(€€€€€€€€€€€€ğ½Q•áĞø(€€€€€€€€€€ğ½AÉ•ÍÍ…‰±”ø(€€€€€€€€¥ô(€€€€€€ğ½Y¥•Üø(€€€€ğ½Y¥•Üø(€€¤ì((€¥˜€¡¥Í1½…‘¥¹œ¤ì(€€€É•ÑÕÉ¸€ñI•ÍÑ…ÕÉ…¹ÑÍMÉ••¹M­•±•Ñ½¸€¼øì(€ô((€¥˜€¡•ÉÉ½É5•ÍÍ…”¤ì(€€€É•ÑÕÉ¸€ (€€€€€€ñY¥•ÜÍÑå±”õíÍÑå±•Ì¹ÍÑ…Ñ•MÉ••¹ôø(€€€€€€€€ñQ•áĞÍÑå±”õíÍÑå±•Ì¹ÍÑ…Ñ•%½¹ôûÂ~6,÷¾â<ğ½Q•áĞø(€€€€€€€€ñQ•áĞÍÑå±”õíÍÑå±•Ì¹ÍÑ…Ñ•Q¥Ñ±•ôûb«bçbŸbÇbŸfƒfb«b´ƒbŸffbßbŸbçfğ½Q•áĞø(€€€€€€€€ñQ•áĞÍÑå±”õíÍÑå±•Ì¹ÍÑ…Ñ••ÍÉ¥ÁÑ¥½¹ôùí•ÉÉ½É5•ÍÍ…•ôğ½Q•áĞø((€€€€€€€€ñAÉ•ÍÍ…‰±”(€€€€€€€€€…•ÍÍ¥‰¥±¥ÑåI½±”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€ÍÑå±”õì¡ìÁÉ•ÍÍ•ô¤€ôøl(€€€€€€€€€€€ÍÑå±•Ì¹É•ÑÉå	ÕÑÑ½¸°(€€€€€€€€€€€ÁÉ•ÍÍ•€˜˜ÍÑå±•Ì¹ÁÉ•ÍÍ•°(€€€€€€€€€uô(€€€€€€€€€½¹AÉ•ÍÌõì ¤€ôøì(€€€€€€€€€€€Ù½¥É•±½… ¤ì(€€€€€€€€€õô(€€€€€€€€ø(€€€€€€€€€€ñQ•áĞÍÑå±”õíÍÑå±•Ì¹É•ÑÉå	ÕÑÑ½¹Q•áÑôûb—bçbŸb¿b¤ƒbŸffb·bŸf#fb¤ğ½Q•áĞø(€€€€€€€€ğ½AÉ•ÍÍ…‰±”ø(€€€€€€ğ½Y¥•Üø(€€€€¤ì(€ô((€É•ÑÕÉ¸€ (€€€€ñY¥•ÜÍÑå±”õíÍÑå±•Ì¹ÍÉ••¹ôø(€€€€€€ñY¥•Ü(€€€€€€€ÍÑå±”õíl(€€€€€€€€€ÍÑå±•Ì¹Ñ½Á!•…‘•È°(€€€€€€€€€ì(€€€€€€€€€€€µ¥¹!•¥¡Ğè5…Ñ ¹µ…à ÄÀÀ°¥¹Í•ÑÌ¹Ñ½À€¬€ÜØ¤°(€€€€€€€€€€€Á…‘‘¥¹Q½Àè5…Ñ ¹µ…à ÌĞ°¥¹Í•ÑÌ¹Ñ½À€¬€ÄÀ¤°(€€€€€€€€€ô°(€€€€€€€uô(€€€€€€ø(€€€€€€€€ñAÉ•ÍÍ…‰±”(€€€€€€€€€…•ÍÍ¥‰¥±¥Ñå1…‰•°ô‹bŸfbçf#b¿b¤ˆ(€€€€€€€€€…•ÍÍ¥‰¥±¥ÑåI½±”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€ÍÑå±”õì¡ìÁÉ•ÍÍ•ô¤€ôøl(€€€€€€€€€€€ÍÑå±•Ì¹‰…­	ÕÑÑ½¸°(€€€€€€€€€€€ÁÉ•ÍÍ•€˜˜ÍÑå±•Ì¹¡•…‘•É	ÕÑÑ½¹AÉ•ÍÍ•°(€€€€€€€€€uô(€€€€€€€€€½¹AÉ•ÍÌõì ¤€ôøÉ½ÕÑ•È¹‰…¬ ¥ô(€€€€€€€€ø(€€€€€€€€€€ñ	…­ÉÉ½İ%½¸€¼ø(€€€€€€€€ğ½AÉ•ÍÍ…‰±”ø(€€€€€€ğ½Y¥•Üø((€€€€€€ñ±…Ñ1¥ÍĞ(€€€€€€€½¹Ñ•¹Ñ½¹Ñ…¥¹•ÉMÑå±”õíÍÑå±•Ì¹Á…•½¹Ñ•¹Ñô(€€€€€€€‘…Ñ„õíÙ¥Í¥‰±•MÑ½É•Íô(€€€€€€€¥¹¥Ñ¥…±9ÕµQ½I•¹‘•ÈõìÙô(€€€€€€€­•åáÑÉ…Ñ½Èõì¡ÍÑ½É”¤€ôøÍÑ½É”¹¥‘ô(€€€€€€€1¥ÍÑµÁÑå½µÁ½¹•¹Ğõí±¥ÍÑµÁÑåô(€€€€€€€1¥ÍÑ½½Ñ•É½µÁ½¹•¹Ğõì(€€€€€€€€€Ù¥Í¥‰±•MÑ½É•Ì¹±•¹Ñ €ø€À€ü€ (€€€€€€€€€€€€ñY¥•ÜÍÑå±”õíÍÑå±•Ì¹ÍÑ½É•Í1¥ÍÑ	½ÑÑ½µMÁ…•Éô€¼ø(€€€€€€€€€€¤€è¹Õ±°(€€€€€€€ô(€€€€€€€1¥ÍÑ!•…‘•É½µÁ½¹•¹Ğõí±¥ÍÑ!•…‘•Éô(€€€€€€€µ…áQ½I•¹‘•ÉA•É	…Ñ õìáô(€€€€€€€É•¹‘•É%Ñ•´õíÉ•¹‘•ÉI•ÍÑ…ÕÉ…¹Ñô(€€€€€€€Í¡½İÍY•ÉÑ¥…±MÉ½±±%¹‘¥…Ñ½Èõí™…±Í•ô(€€€€€€€İ¥¹‘½İM¥é”õìİô(€€€€€€¼ø((€€€€€€ñ±½Í•‘MÑ½É•9½Ñ¥”(€€€€€€€ÍÑ½É”õí±½Í•‘MÑ½É•9½Ñ¥•ô(€€€€€€€½¹±½Í”õì ¤€ôøÍ•Ñ±½Í•‘MÑ½É•9½Ñ¥”¡¹Õ±°¥ô(€€€€€€¼ø((€€€€€€ñÕ¥Í¥¹•Í5½‘…°(€€€€€€€‘É…™ÑÕ¥Í¥¹•-•äõí‘É…™ÑÕ¥Í¥¹•-•åô(€€€€€€€Ù¥Í¥‰±”õí¥ÍÕ¥Í¥¹•Í5½‘…±Y¥Í¥‰±•ô(€€€€€€€½¹ÁÁ±äõí…ÁÁ±åÕ¥Í¥¹•¥±Ñ•ÉÍô(€€€€€€€½¹±½Í”õí±½Í•Õ¥Í¥¹•Í5½‘…±ô(€€€€€€€½¹I•Í•ĞõíÉ•Í•ÑÕ¥Í¥¹•¥±Ñ•ÉÍô(€€€€€€€½¹Q½±•Õ¥Í¥¹”õíÑ½±•É…™ÑÕ¥Í¥¹•ô(€€€€€€¼ø(€€€€ğ½Y¥•Üø(€€¤ì)ô()½¹ÍĞÍÑå±•Ì€ôMÑå±•M¡••Ğ¹É•…Ñ”¡ì(€ÍÉ••¸èì(€€€‰…­É½Õ¹‘½±½Èè€œœ°(€€€™±•àè€Ä°(€ô°((€Ñ½Á!•…‘•Èèì(€€€…±¥¹%Ñ•µÌè€•¹Ñ•Èœ°(€€€‰…­É½Õ¹‘½±½Èè€œœ°(€€€‰½É‘•É	½ÑÑ½µ½±½Èè€œœ°(€€€‰½É‘•É	½ÑÑ½µ]¥‘Ñ è€Ä°(€€€™±•á¥É•Ñ¥½¸è€É½Üœ°(€€€…Àè€ÄĞ°(€€€Á…‘‘¥¹	½ÑÑ½´è€ÄĞ°(€€€Á…‘‘¥¹!½É¥é½¹Ñ…°è9Y%9Qe}9=]}1e=UP¹Á…•ÕÑÑ•È°(€€€Í¡…‘½İ½±½Èè€œŒÀÀÀÀÀÀœ°(€€€Í¡…‘½İ=™™Í•Ğèì(€€€€€¡•¥¡Ğè€È°(€€€€€İ¥‘Ñ è€À°(€€€ô°(€€€Í¡…‘½İ=Á…¥Ñäè€À¸ÀÔ°(€€€Í¡…‘½İI…‘¥ÕÌè€Ø°(€€€é%¹‘•àè€ÄÀ°(€ô°((€‰…­	ÕÑÑ½¸èì(€€€…±¥¹%Ñ•µÌè€•¹Ñ•Èœ°(€€€‰…­É½Õ¹‘½±½Èè€œœ°(€€€‰½É‘•É½±½Èè€œÅÅÄœ°(€€€‰½É‘•ÉI…‘¥ÕÌè€ÈĞ°(€€€‰½É‘•É]¥‘Ñ è€Ä°(€€€¡•¥¡Ğè€ĞØ°(€€€©ÕÍÑ¥™å½¹Ñ•¹Ğè€•¹Ñ•Èœ°(€€€İ¥‘Ñ è€ĞØ°(€ô°((€¡•…‘•É	ÕÑÑ½¹AÉ•ÍÍ•èì(€€€‰…­É½Õ¹‘½±½Èè€œİİÜœ°(€€€ÑÉ…¹Í™½É´èmìÍ…±”è€À¸äÜõt°(€ô°((€‰…­ÉÉ½İ…¹Ù…Ìèì(€€€¡•¥¡Ğè€ÈÌ°(€€€Á½Í¥Ñ¥½¸è€É•±…Ñ¥Ù”œ°(€€€İ¥‘Ñ è€ÈĞ°(€ô°((€‰…­ÉÉ½İMÑ•´èì(€€€‰…­É½Õ¹‘½±½Èè€œŒÈĞÈĞÈĞœ°(€€€‰½É‘•ÉI…‘¥ÕÌè€È°(€€€¡•¥¡Ğè€È¸È°(€€€±•™Ğè€Ì°(€€€Á½Í¥Ñ¥½¸è€…‰Í½±ÕÑ”œ°(€€€Ñ½Àè€ÄÀ¸Ì°(€€€İ¥‘Ñ è€Ää°(€ô°((€‰…­ÉÉ½İ¥…½¹…°èì(€€€‰…­É½Õ¹‘½±½Èè€œŒÈĞÈĞÈĞœ°(€€€‰½É‘•ÉI…‘¥ÕÌè€È°(€€€¡•¥¡Ğè€È¸È°(€€€±•™Ğè€È°(€€€Á½Í¥Ñ¥½¸è€…‰Í½±ÕÑ”œ°(€€€İ¥‘Ñ è€ÄÀ°(€ô°((€‰…­ÉÉ½İQ½Àèì(€€€Ñ½Àè€Ü°(€€€ÑÉ…¹Í™½É´èmìÉ½Ñ…Ñ”è€œ´ĞÉ‘•œœõt°(€ô°((€‰…­ÉÉ½İ	½ÑÑ½´èì(€€€Ñ½Àè€ÄĞ°(€€€ÑÉ…¹Í™½É´èmìÉ½Ñ…Ñ”è€œĞÉ‘•œœõt°(€ô°((€Á…•½¹Ñ•¹Ğèì(€€€™±•áÉ½Üè€Ä°(€€€Á…‘‘¥¹	½ÑÑ½´è€ĞÈ°(€ô°((€½¹Ñ…¥¹•Èèì(€€€…±¥¹M•±˜è€•¹Ñ•Èœ°(€€€µ…á]¥‘Ñ è9Y%9Qe}9=]}1e=UP¹½¹Ñ•¹Ñ5…á]¥‘Ñ °(€€€İ¥‘Ñ è€œÄÀÀ”œ°(€ô°((€Õ¥Í¥¹•ÍAÉ•Ù¥•Üèì(€€€‰…­É½Õ¹‘½±½Èè€œœ°(€€€‘¥É•Ñ¥½¸è€±ÑÈœ°(€ô°((€Õ¥Í¥¹•ÍAÉ•Ù¥•İ½¹Ñ•¹Ğèì(€€€‘¥É•Ñ¥½¸è€±ÑÈœ°(€€€™±•á¥É•Ñ¥½¸è€É½ÜµÉ•Ù•ÉÍ”œ°(€€€…Àè€ÄØ°(€€€Á…‘‘¥¹	½ÑÑ½´è€ÄÌ°(€€€Á…‘‘¥¹!½É¥é½¹Ñ…°è9Y%9Qe}9=]}1e=UP¹Á…•ÕÑÑ•È°(€€€Á…‘‘¥¹Q½Àè€Äà°(€ô°((€Õ¥Í¥¹•AÉ•Ù¥•İ%Ñ•´èì(€€€…±¥¹%Ñ•µÌè€•¹Ñ•Èœ°(€€€İ¥‘Ñ è€àĞ°(€ô°((€Õ¥Í¥¹•AÉ•Ù¥•İ%µ…”èì(€€€…±¥¹%Ñ•µÌè€•¹Ñ•Èœ°(€€€‰…­É½Õ¹‘½±½Èè€œÙÑÄœ°(€€€‰½É‘•É½±½Èè€œÅÅÈœ°(€€€‰½É‘•ÉI…‘¥ÕÌè€Ìä°(€€€‰½É‘•É]¥‘Ñ è€Ä°(€€€¡•¥¡Ğè€Üà°(€€€©ÕÍÑ¥™å½¹Ñ•¹Ğè€•¹Ñ•Èœ°(€€€½Ù•É™±½Üè€¡¥‘‘•¸œ°(€€€Í¡…‘½İ½±½Èè€œŒÄÄÄÄÄÄœ°(€€€Í¡…‘½İ=™™Í•Ğèì(€€€€€¡•¥¡Ğè€È°(€€€€€İ¥‘Ñ è€À°(€€€ô°(€€€Í¡…‘½İ=Á…¥Ñäè€À¸Àà°(€€€Í¡…‘½İI…‘¥ÕÌè€Ô°(€€€İ¥‘Ñ è€Üà°(€ô°((€Õ¥Í¥¹•AÉ•Ù¥•İ%µ…•Ñ¥Ù”èì(€€€‰…­É½Õ¹‘½±½Èè€œáÀœ°(€€€‰½É‘•É½±½Èè9Y%9Qe}9=]}=1=IL¹ÁÉ¥µ…Éä°(€€€‰½É‘•É]¥‘Ñ è€È°(€ô°((€Õ¥Í¥¹•AÉ•Ù¥•İA¡½Ñ¼èì(€€€‰½É‘•ÉI…‘¥ÕÌè€Ìä°(€€€¡•¥¡Ğè€œÄÀÀ”œ°(€€€İ¥‘Ñ è€œÄÀÀ”œ°(€ô°((€Õ¥Í¥¹•AÉ•Ù¥•İ1…‰•°èì(€€€½±½Èè€œŒÙÙÜÀœ°(€€€™½¹ÑM¥é”è€ÄÈ°(€€€µ…É¥¹Q½Àè€à°(€€€µ…á]¥‘Ñ è€àĞ°(€€€Ñ•áÑ±¥¸è€•¹Ñ•Èœ°(€ô°((€Õ¥Í¥¹•AÉ•Ù¥•İ1…‰•±Ñ¥Ù”èì(€€€½±½Èè9Y%9Qe}9=]}=1=IL¹ÁÉ¥µ…Éä°(€€€™½¹Ñ]•¥¡Ğè€œäÀÀœ°(€ô°((€±•…É¥±Ñ•ÉÍI½Üèì(€€€…±¥¹%Ñ•µÌè€™±•àµÍÑ…ÉĞœ°(€€€Á…‘‘¥¹!½É¥é½¹Ñ…°è9Y%9Qe}9=]}1e=UP¹Á…•ÕÑÑ•È°(€€€Á…‘‘¥¹Q½Àè€Äà°(€ô°((€±•…É¥±Ñ•ÉÍ	ÕÑÑ½¸èì(€€€©ÕÍÑ¥™å½¹Ñ•¹Ğè€•¹Ñ•Èœ°(€€€µ¥¹!•¥¡Ğè€ÌØ°(€ô°((€±•…É¥±Ñ•ÉÍQ•áĞèì(€€€½±½Èè9Y%9Qe}9=]}=1=IL¹ÁÉ¥µ…Éä°(€€€™½¹ÑM¥é”è€ÄÈ°(€€€™½¹Ñ]•¥¡Ğè€œäÀÀœ°(€ô°((€ÍÑ½É•Í1¥ÍÑQ½ÁMÁ…•Èèì(€€€¡•¥¡Ğè€ÄÈ°(€ô°((€ÍÑ½É•Í1¥ÍÑ	½ÑÑ½µMÁ…•Èèì(€€€¡•¥¡Ğè€à°(€ô°((€ÍÑ½É•1¥ÍÑ%Ñ•´èì(€€€…±¥¹M•±˜è€•¹Ñ•Èœ°(€€€µ…á]¥‘Ñ è9Y%9Qe}9=]}1e=UP¹½¹Ñ•¹Ñ5…á]¥‘Ñ °(€€€Á…‘‘¥¹!½É¥é½¹Ñ…°è9Y%9Qe}9=]}1e=UP¹Á…•ÕÑÑ•È°(€€€İ¥‘Ñ è€œÄÀÀ”œ°(€ô°((€±½Í•‘9½Ñ¥•5½‘…°èì(€€€™±•àè€Ä°(€€€©ÕÍÑ¥™å½¹Ñ•¹Ğè€™±•àµ•¹œ°(€ô°((€±½Í•‘9½Ñ¥•	…­‘É½Àèì(€€€‰…­É½Õ¹‘½±½Èè€É‰„ Äà°Äà°ÈÀ°À¸Èà¤œ°(€€€‰½ÑÑ½´è€À°(€€€±•™Ğè€À°(€€€Á½Í¥Ñ¥½¸è€…‰Í½±ÕÑ”œ°(€€€É¥¡Ğè€À°(€€€Ñ½Àè€À°(€ô°((€±½Í•‘9½Ñ¥•…Éèì(€€€…±¥¹%Ñ•µÌè€•¹Ñ•Èœ°(€€€…±¥¹M•±˜è€•¹Ñ•Èœ°(€€€‰…­É½Õ¹‘½±½Èè€œÑàœ°(€€€‰½É‘•ÉI…‘¥ÕÌè€ÈĞ°(€€€™±•á¥É•Ñ¥½¸è€É½Üœ°(€€€µ…É¥¹!½É¥é½¹Ñ…°è€ÄØ°(€€€µ…á]¥‘Ñ è9Y%9Qe}9=]}1e=UP¹½¹Ñ•¹Ñ5…á]¥‘Ñ °(€€€µ¥¹!•¥¡Ğè€ÄÀØ°(€€€Á…‘‘¥¹!½É¥é½¹Ñ…°è€ÄØ°(€€€Á…‘‘¥¹Y•ÉÑ¥…°è€ÄÔ°(€€€Í¡…‘½İ½±½Èè€œŒÀÀÀÀÀÀœ°(€€€Í¡…‘½İ=™™Í•Ğèì(€€€€€¡•¥¡Ğè€Ğ°(€€€€€İ¥‘Ñ è€À°(€€€ô°(€€€Í¡…‘½İ=Á…¥Ñäè€À¸ÄØ°(€€€Í¡…‘½İI…‘¥ÕÌè€ÄÈ°(€€€İ¥‘Ñ è€œäÈ”œ°(€ô°((€±½Í•‘9½Ñ¥•±½Í•	ÕÑÑ½¸èì(€€€…±¥¹%Ñ•µÌè€•¹Ñ•Èœ°(€€€™±•áM¡É¥¹¬è€À°(€€€¡•¥¡Ğè€ÌĞ°(€€€©ÕÍÑ¥™å½¹Ñ•¹Ğè€•¹Ñ•Èœ°(€€€İ¥‘Ñ è€ÌĞ°(€ô°((€±½Í•‘9½Ñ¥•±½Í•Q•áĞèì(€€€½±½Èè€œŒÈØÈØÈØœ°(€€€™½¹ÑM¥é”è€ÌĞ°(€€€™½¹Ñ]•¥¡Ğè€œÌÀÀœ°(€€€±¥¹•!•¥¡Ğè€ÌĞ°(€ô°((€±½Í•‘9½Ñ¥•½¹Ñ•¹Ğèì(€€€™±•àè€Ä°(€€€Á…‘‘¥¹!½É¥é½¹Ñ…°è€ÄÀ°(€ô°((€±½Í•‘9½Ñ¥•Q¥Ñ±”èì(€€€½±½Èè€œŒÈÔÈÔÈÔœ°(€€€™½¹ÑM¥é”è€ÄÔ°(€€€™½¹Ñ]•¥¡Ğè€œäÀÀœ°(€€€±¥¹•!•¥¡Ğè€ÈÄ°(€€€Ñ•áÑ±¥¸è€É¥¡Ğœ°(€€€İÉ¥Ñ¥¹¥É•Ñ¥½¸è€ÉÑ°œ°(€ô°((€±½Í•‘9½Ñ¥•]…É¹¥¹%½¸èì(€€€…±¥¹%Ñ•µÌè€•¹Ñ•Èœ°(€€€™±•áM¡É¥¹¬è€À°(€€€¡•¥¡Ğè€Ìà°(€€€©ÕÍÑ¥™å½¹Ñ•¹Ğè€•¹Ñ•Èœ°(€€€µ…É¥¹1•™Ğè€È°(€€€İ¥‘Ñ è€Ìà°(€ô°((€±½Í•‘9½Ñ¥•]…É¹¥¹Q•áĞèì(€€€½±½Èè€œŒåÙÀÀœ°(€€€™½¹ÑM¥é”è€ÌÄ°(€€€™½¹Ñ]•¥¡Ğè€œäÀÀœ°(€€€±¥¹•!•¥¡Ğè€ÌĞ°(€ô°((€±½Í•‘9½Ñ¥•AÉ•ÍÍ•èì(€€€½Á…¥Ñäè€À¸ÔÔ°(€ô°((€•µÁÑå…Éèì(€€€…±¥¹%Ñ•µÌè€•¹Ñ•Èœ°(€€€‰…­É½Õ¹‘½±½Èè€œœ°(€€€‰½É‘•É½±½Èè€œœ°(€€€‰½É‘•ÉI…‘¥ÕÌè€ÈÈ°(€€€‰½É‘•É]¥‘Ñ è€Ä°(€€€µ…É¥¹!½É¥é½¹Ñ…°è9Y%9Qe}9=]}1e=UP¹Á…•ÕÑÑ•È°(€€€µ…É¥¹Q½Àè€ÈÀ°(€€€Á…‘‘¥¹œè€Èà°(€ô°((€•µÁÑå%½¸èì(€€€™½¹ÑM¥é”è€ĞÈ°(€ô°((€•µÁÑåQ¥Ñ±”èì(€€€½±½Èè€œŒÈÀÈÀÈĞœ°(€€€™½¹ÑM¥é”è€ÄÜ°(€€€™½¹Ñ]•¥¡Ğè€œäÀÀœ°(€€€µ…É¥¹Q½Àè€ÄÈ°(€ô°((€•µÁÑå•ÍÉ¥ÁÑ¥½¸èì(€€€½±½Èè€œŒİİàÄœ°(€€€™½¹ÑM¥é”è€ÄÈ°(€€€±¥¹•!•¥¡Ğè€ÈÀ°(€€€µ…É¥¹Q½Àè€Ü°(€€€Ñ•áÑ±¥¸è€•¹Ñ•Èœ°(€ô°((€•µÁÑåI•Í•Ñ	ÕÑÑ½¸èì(€€€‰…­É½Õ¹‘½±½Èè9Y%9Qe}9=]}=1=IL¹ÁÉ¥µ…Éä°(€€€‰½É‘•ÉI…‘¥ÕÌè€äää°(€€€µ…É¥¹Q½Àè€Äà°(€€€Á…‘‘¥¹!½É¥é½¹Ñ…°è€Ää°(€€€Á…‘‘¥¹Y•ÉÑ¥…°è€ÄÄ°(€ô°((€•µÁÑåI•Í•Ñ	ÕÑÑ½¹Q•áĞèì(€€€½±½Èè€œœ°(€€€™½¹ÑM¥é”è€ÄÈ°(€€€™½¹Ñ]•¥¡Ğè€œäÀÀœ°(€ô°((€ÍÑ…Ñ•MÉ••¸èì(€€€…±¥¹%Ñ•µÌè€•¹Ñ•Èœ°(€€€‰…­É½Õ¹‘½±½Èè€œœ°(€€€™±•àè€Ä°(€€€©ÕÍÑ¥™å½¹Ñ•¹Ğè€•¹Ñ•Èœ°(€€€Á…‘‘¥¹!½É¥é½¹Ñ…°è€Èà°(€ô°((€ÍÑ…Ñ•%½¸èì(€€€™½¹ÑM¥é”è€ÔÈ°(€ô°((€ÍÑ…Ñ•Q¥Ñ±”èì(€€€½±½Èè€œŒÄÜÄÜÅœ°(€€€™½¹ÑM¥é”è€ÈÄ°(€€€™½¹Ñ]•¥¡Ğè€œäÀÀœ°(€€€µ…É¥¹Q½Àè€ÄÜ°(€€€Ñ•áÑ±¥¸è€•¹Ñ•Èœ°(€ô°((€ÍÑ…Ñ••ÍÉ¥ÁÑ¥½¸èì(€€€½±½Èè€œŒÜÌÜÌİœ°(€€€™½¹ÑM¥é”è€ÄÌ°(€€€±¥¹•!•¥¡Ğè€ÈÄ°(€€€µ…É¥¹Q½Àè€à°(€€€Ñ•áÑ±¥¸è€•¹Ñ•Èœ°(€ô°((€É•ÑÉå	ÕÑÑ½¸èì(€€€‰…­É½Õ¹‘½±½Èè9Y%9Qe}9=]}=1=IL¹ÁÉ¥µ…Éä°(€€€‰½É‘•ÉI…‘¥ÕÌè€ÄÔ°(€€€µ…É¥¹Q½Àè€ÈÈ°(€€€Á…‘‘¥¹!½É¥é½¹Ñ…°è€ÈĞ°(€€€Á…‘‘¥¹Y•ÉÑ¥…°è€ÄÌ°(€ô°((€É•ÑÉå	ÕÑÑ½¹Q•áĞèì(€€€½±½Èè€œœ°(€€€™½¹ÑM¥é”è€ÄĞ°(€€€™½¹Ñ]•¥¡Ğè€œäÀÀœ°(€ô°((€ÁÉ•ÍÍ•èì(€€€½Á…¥Ñäè€À¸ÜØ°(€€€ÑÉ…¹Í™½É´èmìÍ…±”è€À¸äàÔõt°(€ô°)ô¤ì(