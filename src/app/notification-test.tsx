import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  isRunningInExpoGo,
  registerPushNotifications,
  scheduleLocalNotificationTest,
} from '../services/push-notifications-service';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';

type TestState =
  | 'idle'
  | 'local-running'
  | 'remote-running';

export default function NotificationTestScreen() {
  const router = useRouter();
  const expoGo = isRunningInExpoGo();

  const [
    testState,
    setTestState,
  ] = useState<TestState>('idle');

  const [
    resultMessage,
    setResultMessage,
  ] = useState<string | null>(null);

  const [
    expoPushToken,
    setExpoPushToken,
  ] = useState<string | null>(null);

  async function testLocalNotification() {
    try {
      setTestState('local-running');
      setResultMessage(null);

      const result =
        await scheduleLocalNotificationTest();

      if (result === 'scheduled') {
        setResultMessage(
          'تم إرسال Local Notification بنجاح. المفروض تظهر على الجهاز الآن.',
        );
        return;
      }

      if (
        result ===
        'permission-not-granted'
      ) {
        setResultMessage(
          'صلاحية الإشعارات غير مفعّلة على الجهاز.',
        );
        return;
      }

      setResultMessage(
        'الإشعارات غير مدعومة على المنصة الحالية.',
      );
    } catch (error) {
      setResultMessage(
        error instanceof Error
          ? error.message
          : 'فشل اختبار الإشعار المحلي.',
      );
    } finally {
      setTestState('idle');
    }
  }

  async function testRemoteRegistration() {
    try {
      setTestState('remote-running');
      setResultMessage(null);
      setExpoPushToken(null);

      const result =
        await registerPushNotifications({
          requestPermission: true,
        });

      if (result.status === 'registered') {
        setExpoPushToken(
          result.expoPushToken,
        );
        setResultMessage(
          'تم تسجيل الجهاز في Navienty Now Push بنجاح.',
        );
        return;
      }

      if (
        result.status ===
        'permission-not-granted'
      ) {
        setResultMessage(
          'صلاحية الإشعارات غير مفعّلة على الجهاز.',
        );
        return;
      }

      if (
        result.status ===
        'project-id-missing'
      ) {
        setResultMessage(
          'EAS projectId غير موجود في إعدادات التطبيق.',
        );
        return;
      }

      setResultMessage(
        expoGo
          ? 'Remote Push غير متاح داخل Expo Go. استخدم Development Build للاختبار الحقيقي.'
          : 'Remote Push غير مدعوم في البيئة الحالية.',
      );
    } catch (error) {
      setResultMessage(
        error instanceof Error
          ? error.message
          : 'فشل تسجيل Remote Push.',
      );
    } finally {
      setTestState('idle');
    }
  }

  if (!__DEV__) {
    return (
      <SafeAreaView
        edges={['top', 'bottom']}
        style={styles.screen}
      >
        <StatusBar style="dark" />

        <View style={styles.releaseMessage}>
          <Text style={styles.releaseTitle}>
            الصفحة غير متاحة
          </Text>

          <Text style={styles.releaseDescription}>
            أدوات اختبار الإشعارات متاحة في وضع التطوير فقط.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={styles.screen}
    >
      <StatusBar style="dark" />

      <View style={styles.pageShell}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="العودة"
            accessibilityRole="button"
            hitSlop={10}
            style={styles.backButton}
            onPress={() => {
              router.back();
            }}
          >
            <Ionicons
              color="#242424"
              name="arrow-back"
              size={22}
            />
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.title}>
              اختبار الإشعارات
            </Text>

            <Text style={styles.subtitle}>
              Navienty Now Push Diagnostics
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.environmentCard}>
            <Ionicons
              color={
                NAVIENTY_NOW_COLORS.primary
              }
              name={
                expoGo
                  ? 'phone-portrait-outline'
                  : 'construct-outline'
              }
              size={22}
            />

            <View style={styles.environmentCopy}>
              <Text style={styles.environmentTitle}>
                {expoGo
                  ? 'Expo Go'
                  : 'Development / Native Build'}
              </Text>

              <Text
                style={styles.environmentDescription}
              >
                {expoGo
                  ? 'Local Notifications متاحة. Remote Push يحتاج Development Build.'
                  : 'يمكن اختبار Local Notifications وتسجيل Remote Push Token.'}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={testState !== 'idle'}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
              testState !== 'idle' &&
                styles.buttonDisabled,
            ]}
            onPress={() => {
              void testLocalNotification();
            }}
          >
            {testState === 'local-running' ? (
              <ActivityIndicator
                color={NAVIENTY_NOW_COLORS.white}
                size="small"
              />
            ) : (
              <Ionicons
                color={NAVIENTY_NOW_COLORS.white}
                name="notifications-outline"
                size={19}
              />
            )}

            <Text style={styles.primaryButtonText}>
              إرسال Local Notification
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={testState !== 'idle'}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
              testState !== 'idle' &&
                styles.buttonDisabled,
            ]}
            onPress={() => {
              void testRemoteRegistration();
            }}
          >
            {testState === 'remote-running' ? (
              <ActivityIndicator
                color={NAVIENTY_NOW_COLORS.primary}
                size="small"
              />
            ) : (
              <Ionicons
                color={NAVIENTY_NOW_COLORS.primary}
                name="cloud-upload-outline"
                size={19}
              />
            )}

            <Text style={styles.secondaryButtonText}>
              تسجيل Remote Push
            </Text>
          </Pressable>

          {resultMessage ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultText}>
                {resultMessage}
              </Text>
            </View>
          ) : null}

          {expoPushToken ? (
            <View style={styles.tokenCard}>
              <Text style={styles.tokenLabel}>
                Expo Push Token
              </Text>

              <Text selectable style={styles.tokenText}>
                {expoPushToken}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: NAVIENTY_NOW_COLORS.white,
    flex: 1,
  },
  pageShell: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    alignItems: 'center',
    borderColor: '#E1E1E1',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerCopy: {
    alignItems: 'flex-end',
    flex: 1,
  },
  title: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'right',
  },
  subtitle: {
    color: NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10,
    marginTop: 3,
  },
  content: {
    gap: 12,
    padding: 16,
    paddingBottom: 40,
  },
  environmentCard: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 18,
    flexDirection: 'row-reverse',
    gap: 12,
    padding: 16,
  },
  environmentCopy: {
    alignItems: 'flex-end',
    flex: 1,
  },
  environmentTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  environmentDescription: {
    color: NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10.5,
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.primary,
    borderRadius: 15,
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.white,
    borderColor: NAVIENTY_NOW_COLORS.primary,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: NAVIENTY_NOW_COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  resultCard: {
    backgroundColor: '#F7F7F8',
    borderRadius: 14,
    padding: 13,
  },
  resultText: {
    color: NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  tokenCard: {
    backgroundColor: '#F7F7F8',
    borderRadius: 14,
    padding: 13,
  },
  tokenLabel: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
  },
  tokenText: {
    color: NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 9.5,
    lineHeight: 16,
  },
  releaseMessage: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  releaseTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  releaseDescription: {
    color: NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
});
