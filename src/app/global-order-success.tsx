import { Ionicons } from '@expo/vector-icons';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  NAVIENTY_NOW_COLORS,
} from '../theme/navienty-now-theme';

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function GlobalOrderSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params =
    useLocalSearchParams<{
      code?: string | string[];
      stores?: string | string[];
      total?: string | string[];
    }>();

  const code = single(params.code) ?? '';
  const stores = Number(single(params.stores) ?? 0);
  const total = Number(single(params.total) ?? 0);

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 20),
        },
      ]}
    >
      <StatusBar style="dark" />

      <View style={styles.successIcon}>
        <Ionicons
          name="checkmark"
          size={38}
          color="#FFFFFF"
        />
      </View>

      <Text style={styles.title}>
        طلبك اتبعت بنجاح
      </Text>

      <Text style={styles.description}>
        السلة اتقسمت داخليًا على {stores || 1} {stores === 1 ? 'متجر' : 'متاجر'}، لكن بالنسبالك ده طلب واحد ورسوم التوصيل اتحسبت مرة واحدة بس.
      </Text>

      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>
          رقم الطلب المجمّع
        </Text>
        <Text style={styles.codeValue}>
          {code || '—'}
        </Text>
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>الإجمالي</Text>
          <Text style={styles.totalValue}>
            {total.toFixed(2)} ج.م
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.pressed,
        ]}
        onPress={() => router.replace('/')}
      >
        <Text style={styles.primaryButtonText}>
          الرجوع للرئيسية
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.page,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successIcon: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.primary,
    borderRadius: 38,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  title: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 23,
    fontWeight: '900',
    marginTop: 20,
    textAlign: 'center',
  },
  description: {
    color: NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 12.5,
    lineHeight: 21,
    marginTop: 9,
    maxWidth: 350,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  codeCard: {
    backgroundColor: '#FFFFFF',
    borderColor: NAVIENTY_NOW_COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 22,
    maxWidth: 360,
    padding: 18,
    width: '100%',
  },
  codeLabel: {
    color: NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10.5,
    textAlign: 'center',
  },
  codeValue: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 5,
    textAlign: 'center',
  },
  divider: {
    backgroundColor: '#EEEEEE',
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  totalRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 12,
    fontWeight: '800',
  },
  totalValue: {
    color: NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 17,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: NAVIENTY_NOW_COLORS.primary,
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 54,
    maxWidth: 360,
    width: '100%',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
});
