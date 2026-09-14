import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {
  AppLaunchGateResult,
} from '../services/app-launch-gate-service';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';

type AppLaunchBlockScreenProps = {
  gate: AppLaunchGateResult;
  isRefreshing: boolean;
  onRefresh: () => void;
};

function getPresentation(
  status: AppLaunchGateResult['status'],
) {
  switch (status) {
    case 'maintenance':
      return {
        icon: 'construct-outline' as const,
        eyebrow: 'صيانة مؤقتة',
        title: 'Navienty Now بيتحسن',
      };

    case 'force-update':
      return {
        icon: 'arrow-up-circle-outline' as const,
        eyebrow: 'تحديث مطلوب',
        title: 'حدّث التطبيق للمتابعة',
      };

    case 'error':
      return {
        icon: 'cloud-offline-outline' as const,
        eyebrow: 'مشكلة في الاتصال',
        title: 'تعذر تشغيل التطبيق',
      };

    default:
      return {
        icon: 'checkmark-circle-outline' as const,
        eyebrow: 'Navienty Now',
        title: 'جاهز',
      };
  }
}

async function openUrl(
  url: string,
) {
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.warn(
      'Unable to open external URL:',
      error,
    );
  }
}

function getWhatsappUrl(
  phone: string | null,
): string | null {
  if (!phone) {
    return null;
  }

  const digits = phone.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  return `https://wa.me/${digits}`;
}

export default function AppLaunchBlockScreen({
  gate,
  isRefreshing,
  onRefresh,
}: AppLaunchBlockScreenProps) {
  const presentation =
    getPresentation(gate.status);

  const whatsappUrl =
    getWhatsappUrl(
      gate.supportWhatsapp,
    );

  const isForceUpdate =
    gate.status === 'force-update';

  const canOpenUpdate =
    isForceUpdate &&
    gate.updateUrl !== null;

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brandText}>
            Navienty Now
          </Text>
        </View>

        <View style={styles.iconWrap}>
          <Ionicons
            name={presentation.icon}
            size={34}
            color={NAVIENTY_NOW_COLORS.primary}
          />
        </View>

        <Text style={styles.eyebrow}>
          {presentation.eyebrow}
        </Text>

        <Text style={styles.title}>
          {presentation.title}
        </Text>

        <Text style={styles.message}>
          {gate.messageAr ??
            'حاول مرة أخرى.'}
        </Text>

        {isForceUpdate ? (
          <View style={styles.versionCard}>
            <View style={styles.versionItem}>
              <Text style={styles.versionLabel}>
                نسختك
              </Text>
              <Text style={styles.versionValue}>
                {gate.currentVersion ?? '—'}
              </Text>
            </View>

            <View style={styles.versionDivider} />

            <View style={styles.versionItem}>
              <Text style={styles.versionLabel}>
                الحد الأدنى
              </Text>
              <Text style={styles.versionValue}>
                {gate.minimumVersion ?? '—'}
              </Text>
            </View>
          </View>
        ) : null}

        {canOpenUpdate ? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryButton,
              pressed &&
                styles.primaryButtonPressed,
            ]}
            onPress={() => {
              if (gate.updateUrl) {
                void openUrl(
                  gate.updateUrl,
                );
              }
            }}
          >
            <Ionicons
              name="download-outline"
              size={19}
              color={NAVIENTY_NOW_COLORS.white}
            />
            <Text style={styles.primaryButtonText}>
              تحديث التطبيق الآن
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isRefreshing}
          style={({ pressed }) => [
            canOpenUpdate
              ? styles.secondaryButton
              : styles.primaryButton,
            pressed &&
              !isRefreshing &&
              (canOpenUpdate
                ? styles.secondaryButtonPressed
                : styles.primaryButtonPressed),
            isRefreshing &&
              styles.buttonDisabled,
          ]}
          onPress={onRefresh}
        >
          {isRefreshing ? (
            <ActivityIndicator
              size="small"
              color={
                canOpenUpdate
                  ? NAVIENTY_NOW_COLORS.primary
                  : NAVIENTY_NOW_COLORS.white
              }
            />
          ) : (
            <Ionicons
              name="refresh-outline"
              size={19}
              color={
                canOpenUpdate
                  ? NAVIENTY_NOW_COLORS.primary
                  : NAVIENTY_NOW_COLORS.white
              }
            />
          )}

          <Text
            style={
              canOpenUpdate
                ? styles.secondaryButtonText
                : styles.primaryButtonText
            }
          >
            {isRefreshing
              ? 'جاري التحقق...'
              : 'إعادة التحقق'}
          </Text>
        </Pressable>

        {whatsappUrl ? (
          <Pressable
            accessibilityRole="link"
            style={({ pressed }) => [
              styles.supportButton,
              pressed &&
                styles.secondaryButtonPressed,
            ]}
            onPress={() =>
              void openUrl(whatsappUrl)
            }
          >
            <Ionicons
              name="logo-whatsapp"
              size={18}
              color={NAVIENTY_NOW_COLORS.textSecondary}
            />
            <Text style={styles.supportButtonText}>
              تواصل مع الدعم
            </Text>
          </Pressable>
        ) : null}

        {isForceUpdate &&
        !gate.updateUrl ? (
          <Text style={styles.helperText}>
            تعذر فتح صفحة التحديث تلقائيًا حاليًا. أعد المحاولة بعد قليل أو تواصل مع الدعم.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
  },

  content: {
    alignItems: 'center',
    maxWidth: 440,
    width: '100%',
  },

  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 42,
  },

  brandDot: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 6,
    height: 12,
    width: 12,
  },

  brandText: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },

  iconWrap: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginBottom: 18,
    width: 56,
  },

  eyebrow: {
    color: NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },

  title: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.7,
    lineHeight: 35,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  message: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 360,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  versionCard: {
    alignItems: 'stretch',
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 20,
    marginTop: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    width: '100%',
  },

  versionItem: {
    alignItems: 'center',
    flex: 1,
  },

  versionDivider: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.border,
    width: 1,
  },

  versionLabel: {
    color:
      NAVIENTY_NOW_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },

  versionValue: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },

  primaryButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
    width: '100%',
  },

  primaryButtonPressed: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPressed,
  },

  primaryButtonText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 15,
    fontWeight: '900',
  },

  secondaryButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryUltraPale,
    borderColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 52,
    paddingHorizontal: 18,
    width: '100%',
  },

  secondaryButtonPressed: {
    opacity: 0.72,
  },

  secondaryButtonText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 15,
    fontWeight: '900',
  },

  supportButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  supportButtonText: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },

  helperText: {
    color: NAVIENTY_NOW_COLORS.textMuted,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 12,
    maxWidth: 360,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  buttonDisabled: {
    opacity: 0.6,
  },
});
