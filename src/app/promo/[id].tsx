import { Ionicons } from '@expo/vector-icons';
import {
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PremiumPromoTemplate from '../../components/promo/premium-promo-template';
import { useAuthSession } from '../../hooks/use-auth-session';
import getAppBootstrap, {
    findServiceAreaById,
} from '../../services/bootstrap-service';
import {
    getHomeBannerById,
    type HomeBanner,
    type HomeBannerAudience,
} from '../../services/home-banners-service';
import {
    hasHomeBannerAction,
    openHomeBannerAction,
} from '../../services/promo-action-service';
import { useCustomerStore } from '../../store/customer-store';
import {
    NAVIENTY_NOW_COLORS,
    NAVIENTY_NOW_LAYOUT,
} from '../../theme/navienty-now-theme';

function getSingleParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export default function PromoDetailScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();
  const router = useRouter();
  const authState = useAuthSession();

  const storedServiceAreaId =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaId,
    );

  const bannerId = useMemo(
    () => getSingleParam(params.id).trim(),
    [params.id],
  );

  const audience: HomeBannerAudience =
    authState.status === 'signedIn'
      ? 'signed_in'
      : 'signed_out';

  const [banner, setBanner] =
    useState<HomeBanner | null>(null);
  const [areaName, setAreaName] =
    useState<string | null>(null);
  const [
    fallbackWhatsAppNumber,
    setFallbackWhatsAppNumber,
  ] = useState<string | null>(null);
  const [isLoading, setIsLoading] =
    useState(true);
  const [
    isOpeningAction,
    setIsOpeningAction,
  ] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const close = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }, [router]);

  const loadBanner = useCallback(async () => {
    if (!bannerId) {
      setBanner(null);
      setErrorMessage('العرض غير متاح.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const bootstrap =
        await getAppBootstrap();

      const effectiveServiceAreaId =
        storedServiceAreaId ||
        bootstrap.settings
          .default_service_area_id;

      const resolvedArea =
        findServiceAreaById(
          bootstrap,
          effectiveServiceAreaId,
        );

      const loadedBanner =
        await getHomeBannerById(
          bannerId,
          audience,
          effectiveServiceAreaId,
        );

      if (!loadedBanner) {
        setBanner(null);
        setAreaName(
          resolvedArea?.area.name_ar ?? null,
        );
        setErrorMessage(
          'العرض غير متاح في منطقتك حاليًا.',
        );
        return;
      }

      setBanner(loadedBanner);
      setAreaName(
        resolvedArea?.area.name_ar ?? null,
      );
      setFallbackWhatsAppNumber(
        bootstrap.settings
          .support_whatsapp ||
          bootstrap.settings
            .whatsapp_number ||
          null,
      );
    } catch (error) {
      setBanner(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل العرض.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    audience,
    bannerId,
    storedServiceAreaId,
  ]);

  useEffect(() => {
    if (authState.status === 'loading') {
      return;
    }

    void loadBanner();
  }, [
    authState.status,
    loadBanner,
  ]);

  const openAction = useCallback(async () => {
    if (!banner || isOpeningAction) {
      return;
    }

    try {
      setIsOpeningAction(true);

      const opened =
        await openHomeBannerAction({
          banner,
          router,
          fallbackWhatsAppNumber,
        });

      if (!opened) {
        setErrorMessage(
          'لا يمكن فتح هذا العرض حاليًا.',
        );
      }
    } catch (error) {
      console.warn(
        'Unable to open promo action.',
        error,
      );

      setErrorMessage(
        'تعذر فتح الخطوة التالية. حاول مرة أخرى.',
      );
    } finally {
      setIsOpeningAction(false);
    }
  }, [
    banner,
    fallbackWhatsAppNumber,
    isOpeningAction,
    router,
  ]);

  if (
    isLoading ||
    authState.status === 'loading'
  ) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator
          color={NAVIENTY_NOW_COLORS.primary}
          size="large"
        />
        <Text style={styles.stateDescription}>
          جاري تحميل العرض...
        </Text>
      </SafeAreaView>
    );
  }

  if (!banner) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <StatusBar style="dark" />

        <View style={styles.errorIcon}>
          <Ionicons
            color={NAVIENTY_NOW_COLORS.primary}
            name="megaphone-outline"
            size={28}
          />
        </View>

        <Text style={styles.stateTitle}>
          العرض غير متاح
        </Text>

        <Text style={styles.stateDescription}>
          {errorMessage ||
            'قد يكون العرض انتهى أو غير متاح في منطقتك.'}
        </Text>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.stateButton,
            pressed && styles.stateButtonPressed,
          ]}
          onPress={close}
        >
          <Text style={styles.stateButtonText}>
            العودة للرئيسية
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <PremiumPromoTemplate
        areaName={areaName}
        banner={banner}
        ctaEnabled={hasHomeBannerAction(banner)}
        isOpeningAction={isOpeningAction}
        onClose={close}
        onPressCta={() => {
          void openAction();
        }}
      />

      {errorMessage ? (
        <View
          pointerEvents="none"
          style={styles.inlineError}
        >
          <Text style={styles.inlineErrorText}>
            {errorMessage}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,
    flex: 1,
  },

  stateScreen: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter + 10,
  },

  errorIcon: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginBottom: 18,
    width: 56,
  },

  stateTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },

  stateDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 380,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  stateButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 17,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 54,
    paddingHorizontal: 26,
  },

  stateButtonPressed: {
    opacity: 0.86,
  },

  stateButtonText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 15,
    fontWeight: '900',
  },

  inlineError: {
    alignSelf: 'center',
    backgroundColor: '#FDECEC',
    borderRadius: 999,
    bottom: 112,
    maxWidth: 420,
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'absolute',
  },

  inlineErrorText: {
    color: NAVIENTY_NOW_COLORS.error,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
