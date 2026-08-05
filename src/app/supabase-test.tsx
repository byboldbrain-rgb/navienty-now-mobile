import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import getAppBootstrap, {
    type AppBootstrap,
} from '../services/bootstrap-service';

export default function SupabaseTestScreen() {
  const [data, setData] =
    useState<AppBootstrap | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  async function loadBootstrap() {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const bootstrap =
        await getAppBootstrap();

      setData(bootstrap);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown Supabase error.';

      setErrorMessage(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadBootstrap();
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.content
      }
    >
      <Text style={styles.title}>
        Supabase Connection Test
      </Text>

      {isLoading && (
        <View style={styles.card}>
          <ActivityIndicator size="large" />

          <Text style={styles.message}>
            جاري تحميل البيانات من
            Supabase...
          </Text>
        </View>
      )}

      {!isLoading && errorMessage && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>
            فشل الاتصال
          </Text>

          <Text style={styles.errorText}>
            {errorMessage}
          </Text>
        </View>
      )}

      {!isLoading && data && (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>
            تم الاتصال بنجاح
          </Text>

          <Text style={styles.row}>
            اسم التطبيق:{' '}
            {data.settings.app_name}
          </Text>

          <Text style={styles.row}>
            المدن: {data.cities.length}
          </Text>

          <Text style={styles.row}>
            التصنيفات:{' '}
            {
              data.store_categories
                .length
            }
          </Text>

          <Text style={styles.row}>
            طرق الدفع:{' '}
            {
              data.payment_methods
                .length
            }
          </Text>

          <Text style={styles.row}>
            الطلبات مفعلة:{' '}
            {data.settings.orders_enabled
              ? 'نعم'
              : 'لا'}
          </Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed &&
            styles.buttonPressed,
        ]}
        onPress={() => {
          void loadBootstrap();
        }}
      >
        <Text style={styles.buttonText}>
          إعادة الاختبار
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#f7f7fa',
    flex: 1,
  },

  content: {
    alignSelf: 'center',
    maxWidth: 520,
    padding: 20,
    paddingTop: 56,
    width: '100%',
  },

  title: {
    color: '#222228',
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'center',
  },

  card: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginTop: 24,
    padding: 24,
  },

  message: {
    color: '#666670',
    marginTop: 15,
    textAlign: 'center',
  },

  successCard: {
    backgroundColor: '#e9f7ee',
    borderRadius: 20,
    marginTop: 24,
    padding: 20,
  },

  successTitle: {
    color: '#246343',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 14,
    textAlign: 'right',
  },

  row: {
    color: '#315d47',
    fontSize: 14,
    marginBottom: 9,
    textAlign: 'right',
  },

  errorCard: {
    backgroundColor: '#fff0f0',
    borderRadius: 20,
    marginTop: 24,
    padding: 20,
  },

  errorTitle: {
    color: '#a13333',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },

  errorText: {
    color: '#7b3b3b',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    textAlign: 'right',
  },

  button: {
    alignItems: 'center',
    backgroundColor: '#6d56df',
    borderRadius: 17,
    marginTop: 18,
    padding: 15,
  },

  buttonPressed: {
    opacity: 0.75,
  },

  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
});
