import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
  getGlobalOrderGroup,
  type GlobalOrderGroup,
} from '../services/global-order-group-service';

const GREEN = '#00B14F';

function money(amount: number) {
  const value = Math.round(amount * 100) / 100;
  return `${Number.isInteger(value) ? value : value.toFixed(2)} ج`;
}

export default function GlobalOrderSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const [group, setGroup] = useState<GlobalOrderGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setError('رابط تأكيد الطلب غير مكتمل.');
      return;
    }
    getGlobalOrderGroup(token)
      .then((result) => {
        if (!cancelled) {
          setGroup(result);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : 'تعذر تحميل تفاصيل الطلب.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" color="#FFF" size={38} />
        </View>
        <Text style={styles.title}>تم تسجيل طلباتك بنجاح</Text>
        <Text style={styles.subtitle}>
          كل متجر له أوردر مستقل، وجميع الأوردرات مرتبطة بنفس الطلب المجمّع.
        </Text>

        {error ? (
          <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => setAttempt((n) => n + 1)}>
              <Text style={styles.retry}>إعادة المحاولة</Text>
            </Pressable>
          </View>
        ) : !group ? (
          <ActivityIndicator color={GREEN} size="large" />
        ) : (
          <>
            <View style={styles.codeCard}>
              <Text style={styles.muted}>رقم الطلب المجمّع</Text>
              <Text style={styles.code}>{group.groupCode}</Text>
              <Text style={styles.muted}>{group.orders.length} أوردرات</Text>
            </View>

            {group.orders.map((order, index) => (
              <View style={styles.card} key={order.id}>
                <View style={styles.row}>
                  <Text style={styles.tag}>الأوردر #{index + 1}</Text>
                  <Text style={styles.storeName}>{order.storeName}</Text>
                </View>
                <Text style={styles.muted}>{order.orderCode}</Text>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={styles.amount}>{money(order.subtotal)}</Text>
                  <Text style={styles.muted}>المنتجات</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.amount}>
                    {order.deliveryFee === 0 ? 'مجاني' : money(order.deliveryFee)}
                  </Text>
                  <Text style={styles.muted}>التوصيل</Text>
                </View>
              </View>
            ))}

            <View style={styles.card}>
              <Text style={styles.summaryTitle}>ملخص الدفع</Text>
              <View style={styles.row}>
                <Text style={styles.amount}>{money(group.subtotal)}</Text>
                <Text style={styles.muted}>المنتجات</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.amount}>{money(group.deliveryFee)}</Text>
                <Text style={styles.muted}>توصيل جميع الأماكن</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.amount}>
                  {money(group.paymentProcessingFee)}
                </Text>
                <Text style={styles.muted}>رسوم الدفع (مرة واحدة)</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.finalAmount}>{money(group.totalAmount)}</Text>
                <Text style={styles.summaryTitle}>الإجمالي النهائي</Text>
              </View>
            </View>
          </>
        )}

        <Pressable style={styles.primary} onPress={() => router.replace('/orders')}>
          <Text style={styles.primaryText}>متابعة جميع الطلبات</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.replace('/')}>
          <Text style={styles.secondaryText}>الرجوع للرئيسية</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FA' },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 18, paddingTop: 32, paddingBottom: 30, gap: 15 },
  checkCircle: { alignItems: 'center', justifyContent: 'center', width: 74, height: 74, backgroundColor: GREEN, borderRadius: 37, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '900', color: '#191919', textAlign: 'center' },
  subtitle: { fontSize: 13, lineHeight: 22, color: '#6D6D6D', textAlign: 'center', marginBottom: 6 },
  codeCard: { alignItems: 'center', width: '100%', gap: 6, backgroundColor: '#EAF8F0', borderRadius: 17, padding: 21 },
  code: { fontSize: 23, color: '#13653C', fontWeight: '900', letterSpacing: 1 },
  card: { width: '100%', backgroundColor: '#FFF', padding: 17, gap: 11, borderRadius: 16, borderWidth: 1, borderColor: '#ECECEC' },
  row: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  storeName: { color: '#191919', fontSize: 16, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  muted: { color: '#777', fontSize: 13, textAlign: 'right' },
  tag: { color: '#12844A', fontSize: 12, fontWeight: '800', padding: 7, backgroundColor: '#EAF8F0', borderRadius: 9 },
  divider: { height: 1, backgroundColor: '#ECECEC', marginVertical: 3 },
  amount: { fontSize: 14, fontWeight: '700', color: '#222' },
  summaryTitle: { fontSize: 16, fontWeight: '800', color: '#222' },
  finalAmount: { fontSize: 21, fontWeight: '900', color: '#111' },
  error: { color: '#B42318', textAlign: 'center' },
  retry: { color: GREEN, fontWeight: '800', textAlign: 'center' },
  primary: { width: '100%', backgroundColor: GREEN, minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  secondary: { padding: 10, alignItems: 'center', width: '100%' },
  secondaryText: { color: '#4E4E4E', fontSize: 15, fontWeight: '700' },
});
