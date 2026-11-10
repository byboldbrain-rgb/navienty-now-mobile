import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import getServicePackageById, {
  type ServicePackage,
} from '../../services/service-packages-service';

type ServicePackageCartProps = {
  servicePackageId: string;
};

const GREEN = '#00B14F';

function formatPrice(packagePrice: number, currencySymbol: string) {
  return `${packagePrice.toLocaleString('en-EG')} ${currencySymbol}`;
}

/**
 * Service packages have their own booking flow; unlike merchant
 * orders, these do not use store-to-destination delivery charges.
 */
export default function ServicePackageCart({
  servicePackageId,
}: ServicePackageCartProps) {
  const router = useRouter();
  const [servicePackage, setServicePackage] =
    useState<ServicePackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadPackage() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const result = await getServicePackageById(servicePackageId);
        if (cancelled) return;

        if (!result) {
          setServicePackage(null);
          setErrorMessage('الباقة غير متاحة حاليًا.');
        } else {
          setServicePackage(result);
        }
      } catch (error) {
        if (cancelled) return;
        setServicePackage(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'تعذر تحميل تفاصيل الباقة.',
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadPackage();
    return () => {
      cancelled = true;
    };
  }, [servicePackageId, retry]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="الرجوع"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#232323" />
        </Pressable>
        <Text style={styles.title}>مراجعة الباقة</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={GREEN} />
          <Text style={styles.muted}>جاري تحميل تفاصيل الباقة...</Text>
        </View>
      ) : !servicePackage ? (
        <View style={styles.centered}>
          <Ionicons
            name="alert-circle-outline"
            size={32}
            color="#999999"
          />
          <Text style={styles.message}>
            {errorMessage ?? 'الباقة غير متاحة حاليًا.'}
          </Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => setRetry((value) => value + 1)}
          >
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.content}
          >
            <View style={styles.packageCard}>
              {servicePackage.imageUrl ? (
                <Image
                  source={{ uri: servicePackage.imageUrl }}
                  style={styles.packageImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.packagePlaceholder}>
                  <Ionicons
                    name="shirt-outline"
                    size={38}
                    color={GREEN}
                  />
                </View>
              )}
              <Text style={styles.packageName}>
                {servicePackage.nameAr}
              </Text>
              {servicePackage.descriptionAr ? (
                <Text style={styles.description}>
                  {servicePackage.descriptionAr}
                </Text>
              ) : null}
            </View>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>ملخص الحجز</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.muted}>سعر الباقة</Text>
                <Text style={styles.amount}>
                  {formatPrice(
                    servicePackage.price,
                    servicePackage.currencySymbol,
                  )}
                </Text>
              </View>
              <Text style={styles.note}>
                هتراجع بياناتك وطريقة الدفع في الخطوة التالية.
              </Text>
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              style={styles.checkoutButton}
              onPress={() =>
                router.push({
                  pathname: '/checkout',
                  params: { servicePackageId: servicePackage.id },
                })
              }
            >
              <Text style={styles.checkoutText}>متابعة الحجز</Text>
              <Ionicons name="arrow-forward" size={20} color="#ffffff" />
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 36 },
  title: { fontSize: 18, fontWeight: '700', color: '#222222' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  message: { color: '#444444', fontSize: 15, textAlign: 'center' },
  retryButton: {
    backgroundColor: '#ebf8f0',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryText: { color: '#008840', fontWeight: '700' },
  body: { flex: 1 },
  content: { padding: 18, gap: 20 },
  packageCard: {
    borderRadius: 18,
    padding: 18,
    gap: 12,
    backgroundColor: '#f6f7f6',
  },
  packageImage: { height: 210, width: '100%', borderRadius: 14 },
  packagePlaceholder: {
    height: 154,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6f6ec',
    borderRadius: 14,
  },
  packageName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1c1c1c',
    textAlign: 'right',
  },
  description: {
    fontSize: 14,
    lineHeight: 23,
    color: '#5f6461',
    textAlign: 'right',
  },
  summary: { padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#eeeeee', gap: 16 },
  summaryTitle: { fontSize: 17, fontWeight: '700', color: '#222222', textAlign: 'right' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  muted: { color: '#777777', fontSize: 14 },
  amount: { color: '#191919', fontWeight: '700', fontSize: 16 },
  note: { color: '#777777', fontSize: 12, lineHeight: 20, textAlign: 'right' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#eeeeee' },
  checkoutButton: {
    minHeight: 54,
    backgroundColor: GREEN,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  checkoutText: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
});
