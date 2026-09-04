import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
    useCallback,
    useEffect,
    useState,
} from 'react';
import {
    ActivityIndicator,
    AppState,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    getNotificationPreferences,
    updateNotificationPreferences,
    type NotificationPreferences,
    type UpdateNotificationPreferencesInput,
} from '../services/notification-preferences-service';
import {
    registerPushNotifications,
} from '../services/push-notifications-service';
import {
    NAVIENTY_NOW_COLORS,
    NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';

type SavingKey =
  | 'orders'
  | 'service'
  | 'account'
  | 'offers'
  | 'quiet-hours'
  | null;

type PermissionState = {
  granted: boolean;
  canAskAgain: boolean;
  status: Notifications.PermissionStatus;
};

const DEFAULT_QUIET_HOURS_START =
  '23:00:00';
const DEFAULT_QUIET_HOURS_END =
  '09:00:00';

function mapPermissionState(
  permissions: Notifications.NotificationPermissionsStatus,
): PermissionState {
  return {
    granted:
      permissions.granted ||
      permissions.status ===
        Notifications.PermissionStatus.GRANTED,
    canAskAgain:
      permissions.canAskAgain,
    status:
      permissions.status,
  };
}

function SettingRow({
  icon,
  title,
  description,
  value,
  disabled,
  onValueChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Ionicons
          color={NAVIENTY_NOW_COLORS.primaryDark}
          name={icon}
          size={21}
        />
      </View>

      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>
          {title}
        </Text>
        <Text style={styles.settingDescription}>
          {description}
        </Text>
      </View>

      <Switch
        accessibilityLabel={title}
        disabled={disabled}
        ios_backgroundColor="#D5D7DA"
        onValueChange={onValueChange}
        thumbColor={Platform.OS === 'android'
          ? NAVIENTY_NOW_COLORS.white
          : undefined}
        trackColor={{
          false: '#D5D7DA',
          true: NAVIENTY_NOW_COLORS.primary,
        }}
        value={value}
      />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const router = useRouter();

  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [permissionState, setPermissionState] =
    useState<PermissionState | null>(null);
  const [isLoading, setIsLoading] =
    useState(true);
  const [isRequestingPermission, setIsRequestingPermission] =
    useState(false);
  const [savingKey, setSavingKey] =
    useState<SavingKey>(null);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const refreshPermission =
    useCallback(async () => {
      try {
        const permissions =
          await Notifications.getPermissionsAsync();

        setPermissionState(
          mapPermissionState(permissions),
        );
      } catch (error) {
        console.warn(
          'Unable to read notification permission:',
          error,
        );
      }
    }, []);

  const loadPreferences =
    useCallback(async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const [nextPreferences] =
          await Promise.all([
            getNotificationPreferences(),
            refreshPermission(),
          ]);

        setPreferences(nextPreferences);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'تعذر تحميل إعدادات الإشعارات.',
        );
      } finally {
        setIsLoading(false);
      }
    }, [refreshPermission]);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    const subscription =
      AppState.addEventListener(
        'change',
        (state) => {
          if (state === 'active') {
            void refreshPermission();
          }
        },
      );

    return () => {
      subscription.remove();
    };
  }, [refreshPermission]);

  async function savePreference(
    key: Exclude<SavingKey, null>,
    patch: UpdateNotificationPreferencesInput,
  ) {
    if (!preferences || savingKey) {
      return;
    }

    try {
      setSavingKey(key);
      setErrorMessage(null);

      const next =
        await updateNotificationPreferences(
          patch,
        );

      setPreferences(next);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر حفظ إعدادات الإشعارات.',
      );
    } finally {
      setSavingKey(null);
    }
  }

  async function enableSystemNotifications() {
    if (isRequestingPermission) {
      return;
    }

    try {
      setIsRequestingPermission(true);
      setErrorMessage(null);

      if (
        permissionState &&
        !permissionState.granted &&
        !permissionState.canAskAgain
      ) {
        await Linking.openSettings();
        return;
      }

      await registerPushNotifications({
        requestPermission: true,
      });

      await refreshPermission();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تفعيل إشعارات الجهاز.',
      );
    } finally {
      setIsRequestingPermission(false);
    }
  }

  const systemNotificationsEnabled =
    permissionState?.granted === true;

  return (
    <SafeAreaView
      edges={['top']}
      style={styles.safeArea}
    >
      <StatusBar style="dark" />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="العودة"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              color={NAVIENTY_NOW_COLORS.text}
              name="chevron-forward"
              size={24}
            />
          </Pressable>

          <Text style={styles.headerTitle}>
            إعدادات الإشعارات
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator
              color={NAVIENTY_NOW_COLORS.primary}
              size="small"
            />
            <Text style={styles.loadingText}>
              جاري تحميل الإعدادات...
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.systemCard}>
              <View style={styles.systemHeader}>
                <View
                  style={[
                    styles.systemStatusIcon,
                    systemNotificationsEnabled
                      ? styles.systemStatusIconEnabled
                      : styles.systemStatusIconDisabled,
                  ]}
                >
                  <Ionicons
                    color={
                      systemNotificationsEnabled
                        ? NAVIENTY_NOW_COLORS.primaryDark
                        : NAVIENTY_NOW_COLORS.error
                    }
                    name={
                      systemNotificationsEnabled
                        ? 'notifications'
                        : 'notifications-off-outline'
                    }
                    size={23}
                  />
                </View>

                <View style={styles.systemCopy}>
                  <Text style={styles.systemTitle}>
                    إشعارات الجهاز
                  </Text>
                  <Text style={styles.systemDescription}>
                    {systemNotificationsEnabled
                      ? 'مفعلة على الجهاز. هتوصلك الإشعارات حسب اختياراتك تحت.'
                      : 'الإشعارات مقفولة من نظام الجهاز. فعّلها علشان تستقبل التحديثات.'}
                  </Text>
                </View>
              </View>

              {!systemNotificationsEnabled && (
                <Pressable
                  accessibilityRole="button"
                  disabled={isRequestingPermission}
                  onPress={() => {
                    void enableSystemNotifications();
                  }}
                  style={({ pressed }) => [
                    styles.permissionButton,
                    pressed && styles.permissionButtonPressed,
                    isRequestingPermission &&
                      styles.disabled,
                  ]}
                >
                  {isRequestingPermission ? (
                    <ActivityIndicator
                      color={NAVIENTY_NOW_COLORS.white}
                      size="small"
                    />
                  ) : (
                    <Text style={styles.permissionButtonText}>
                      {permissionState?.canAskAgain === false
                        ? 'فتح إعدادات الجهاز'
                        : 'تفعيل الإشعارات'}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                التحديثات المهمة
              </Text>
              <Text style={styles.sectionDescription}>
                تحكم في أنواع التحديثات اللي تحب تستقبلها من Navienty Now.
              </Text>
            </View>

            {preferences && (
              <View style={styles.card}>
                <SettingRow
                  description="تأكيد الطلب، التجهيز، خروجه للتوصيل والتسليم أو الإلغاء."
                  disabled={savingKey !== null}
                  icon="receipt-outline"
                  title="تحديثات الطلبات"
                  value={preferences.orderUpdatesEnabled}
                  onValueChange={(value) => {
                    void savePreference(
                      'orders',
                      {
                        orderUpdatesEnabled: value,
                      },
                    );
                  }}
                />

                <View style={styles.divider} />

                <SettingRow
                  description="حالة حجز الغسيل والمكواة من الاستلام لحد التسليم."
                  disabled={savingKey !== null}
                  icon="shirt-outline"
                  title="تحديثات الخدمات"
                  value={preferences.serviceUpdatesEnabled}
                  onValueChange={(value) => {
                    void savePreference(
                      'service',
                      {
                        serviceUpdatesEnabled: value,
                      },
                    );
                  }}
                />

                <View style={styles.divider} />

                <SettingRow
                  description="الإشعارات المهمة المتعلقة بالحساب والدفع والمحفظة."
                  disabled={savingKey !== null}
                  icon="person-circle-outline"
                  title="الحساب والدفع"
                  value={preferences.accountUpdatesEnabled}
                  onValueChange={(value) => {
                    void savePreference(
                      'account',
                      {
                        accountUpdatesEnabled: value,
                      },
                    );
                  }}
                />
              </View>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                العروض والمزايا
              </Text>
              <Text style={styles.sectionDescription}>
                العروض مقفولة افتراضيًا. مش هنبعتلك رسائل تسويقية إلا لو اخترت تفعيلها بنفسك.
              </Text>
            </View>

            {preferences && (
              <View style={styles.card}>
                <SettingRow
                  description="خصومات، مكافآت وعروض مختارة من Navienty Now."
                  disabled={savingKey !== null}
                  icon="pricetag-outline"
                  title="العروض"
                  value={preferences.offersEnabled}
                  onValueChange={(value) => {
                    void savePreference(
                      'offers',
                      {
                        offersEnabled: value,
                      },
                    );
                  }}
                />

                {preferences.offersEnabled && (
                  <>
                    <View style={styles.divider} />

                    <SettingRow
                      description="لو مفعلة، مش هنبعت عروض من 11 مساءً لحد 9 صباحًا بتوقيت القاهرة. تحديثات الطلبات لا تتأخر."
                      disabled={savingKey !== null}
                      icon="moon-outline"
                      title="فترة هدوء للعروض"
                      value={preferences.quietHoursEnabled}
                      onValueChange={(value) => {
                        void savePreference(
                          'quiet-hours',
                          {
                            quietHoursEnabled: value,
                            quietHoursStart:
                              DEFAULT_QUIET_HOURS_START,
                            quietHoursEnd:
                              DEFAULT_QUIET_HOURS_END,
                            timezone:
                              'Africa/Cairo',
                          },
                        );
                      }}
                    />
                  </>
                )}
              </View>
            )}

            {savingKey && (
              <View style={styles.savingRow}>
                <ActivityIndicator
                  color={NAVIENTY_NOW_COLORS.primary}
                  size="small"
                />
                <Text style={styles.savingText}>
                  جاري حفظ التغيير...
                </Text>
              </View>
            )}

            {errorMessage && (
              <View style={styles.errorCard}>
                <Ionicons
                  color={NAVIENTY_NOW_COLORS.error}
                  name="alert-circle-outline"
                  size={20}
                />
                <Text style={styles.errorText}>
                  {errorMessage}
                </Text>
              </View>
            )}

            <View style={styles.privacyNote}>
              <Ionicons
                color={NAVIENTY_NOW_COLORS.textMuted}
                name="shield-checkmark-outline"
                size={18}
              />
              <Text style={styles.privacyNoteText}>
                تفضيلاتك محفوظة على حساب/جلسة Navienty Now الحالية. قفل إشعارات التطبيق من إعدادات الهاتف يمنع وصولها حتى لو كانت مفعلة هنا.
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: NAVIENTY_NOW_COLORS.page,
    flex: 1,
  },
  screen: {
    backgroundColor: NAVIENTY_NOW_COLORS.surface,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.page,
    borderBottomColor: NAVIENTY_NOW_COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 62,
    paddingHorizontal: NAVIENTY_NOW_LAYOUT.pageGutter,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.white,
    borderColor: NAVIENTY_NOW_COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  headerSpacer: {
    width: 40,
  },
  pressed: {
    opacity: 0.62,
  },
  loadingState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 12,
    marginTop: 12,
  },
  content: {
    alignSelf: 'center',
    maxWidth: NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    paddingBottom: 44,
    paddingHorizontal: NAVIENTY_NOW_LAYOUT.pageGutter,
    paddingTop: 20,
    width: '100%',
  },
  systemCard: {
    backgroundColor: NAVIENTY_NOW_COLORS.white,
    borderColor: NAVIENTY_NOW_COLORS.border,
    borderRadius: NAVIENTY_NOW_LAYOUT.majorRadius,
    borderWidth: 1,
    padding: 17,
  },
  systemHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
  },
  systemStatusIcon: {
    alignItems: 'center',
    borderRadius: 17,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  systemStatusIconEnabled: {
    backgroundColor: NAVIENTY_NOW_COLORS.primaryPale,
  },
  systemStatusIconDisabled: {
    backgroundColor: '#FFF0F0',
  },
  systemCopy: {
    alignItems: 'flex-end',
    flex: 1,
    marginLeft: 0,
    marginRight: 13,
  },
  systemTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  systemDescription: {
    color: NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10.5,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  permissionButton: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.primary,
    borderRadius: NAVIENTY_NOW_LAYOUT.controlRadius,
    justifyContent: 'center',
    marginTop: 15,
    minHeight: 48,
  },
  permissionButtonPressed: {
    backgroundColor: NAVIENTY_NOW_COLORS.primaryPressed,
  },
  permissionButtonText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 13,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.58,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    marginBottom: 10,
    marginTop: 23,
  },
  sectionTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sectionDescription: {
    color: NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10.5,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  card: {
    backgroundColor: NAVIENTY_NOW_COLORS.white,
    borderColor: NAVIENTY_NOW_COLORS.border,
    borderRadius: NAVIENTY_NOW_LAYOUT.cardRadius,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    minHeight: 88,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  settingIcon: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 15,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  settingCopy: {
    alignItems: 'flex-end',
    flex: 1,
    marginHorizontal: 12,
  },
  settingTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  settingDescription: {
    color: NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 9.5,
    lineHeight: 16,
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  divider: {
    backgroundColor: NAVIENTY_NOW_COLORS.border,
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 15,
  },
  savingRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    marginTop: 16,
  },
  savingText: {
    color: NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10,
    marginRight: 8,
  },
  errorCard: {
    alignItems: 'center',
    backgroundColor: '#FFF4F4',
    borderColor: '#F0CCCC',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    marginTop: 16,
    padding: 12,
  },
  errorText: {
    color: '#A13838',
    flex: 1,
    fontSize: 10,
    lineHeight: 17,
    marginRight: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  privacyNote: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
    marginTop: 20,
    paddingHorizontal: 4,
  },
  privacyNoteText: {
    color: NAVIENTY_NOW_COLORS.textMuted,
    flex: 1,
    fontSize: 9.5,
    lineHeight: 17,
    marginRight: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
