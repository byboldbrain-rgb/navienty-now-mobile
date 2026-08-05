import {
    useEffect,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    type StoreCatalog,
    type StoreSummary,
    getStoreCatalog,
    listStores,
} from '../services/catalog-service';

export default function CatalogTestScreen() {
  const [stores, setStores] =
    useState<StoreSummary[]>([]);

  const [firstCatalog, setFirstCatalog] =
    useState<StoreCatalog | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  async function loadCatalog() {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const loadedStores =
        await listStores();

      setStores(loadedStores);

      const firstStore =
        loadedStores[0];

      if (!firstStore) {
        setFirstCatalog(null);
        return;
      }

      const loadedCatalog =
        await getStoreCatalog(
          firstStore.id,
        );

      setFirstCatalog(loadedCatalog);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown catalog error.';

      setErrorMessage(message);
      setStores([]);
      setFirstCatalog(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCatalog();
  }, []);

  const productsCount =
    firstCatalog?.sections.reduce(
      (total, section) =>
        total +
        section.products.length,
      0,
    ) ?? 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.content
      }
    >
      <Text style={styles.title}>
        Supabase Catalog Test
      </Text>

      {isLoading && (
        <View style={styles.card}>
          <ActivityIndicator
            size="large"
          />

          <Text style={styles.message}>
            جاري تحميل المتاجر والمنتجات
            من Supabase...
          </Text>
        </View>
      )}

      {!isLoading &&
        errorMessage && (
          <View style={styles.errorCard}>
            <Text
              style={styles.errorTitle}
            >
              فشل تحميل الكتالوج
            </Text>

            <Text
              style={styles.errorText}
            >
              {errorMessage}
            </Text>
          </View>
        )}

      {!isLoading &&
        !errorMessage && (
          <>
            <View
              style={styles.successCard}
            >
              <Text
                style={
                  styles.successTitle
                }
              >
                تم تحميل الكتالوج بنجاح
              </Text>

              <Text style={styles.row}>
                المتاجر: {stores.length}
              </Text>

              <Text style={styles.row}>
                أول متجر:{' '}
                {firstCatalog?.store.name ??
                  'لا يوجد'}
              </Text>

              <Text style={styles.row}>
                الأقسام:{' '}
                {firstCatalog?.sections
                  .length ?? 0}
              </Text>

              <Text style={styles.row}>
                المنتجات:{' '}
                {productsCount}
              </Text>
            </View>

            <Text
              style={styles.sectionTitle}
            >
              المتاجر القادمة من Supabase
            </Text>

            {stores.map((store) => (
              <View
                key={store.id}
                style={styles.storeCard}
              >
                <Text
                  style={styles.storeIcon}
                >
                  {store.icon}
                </Text>

                <View
                  style={
                    styles.storeContent
                  }
                >
                  <Text
                    style={
                      styles.storeName
                    }
                  >
                    {store.name}
                  </Text>

                  <Text
                    style={
                      styles.storeMeta
                    }
                  >
                    {store.categoryName} •{' '}
                    {store.deliveryTime}
                  </Text>

                  <Text
                    style={
                      styles.storeMeta
                    }
                  >
                    رسوم التوصيل:{' '}
                    {store.deliveryFee}{' '}
                    ج.م
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed &&
            styles.buttonPressed,
        ]}
        onPress={() => {
          void loadCatalog();
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
    paddingBottom: 50,
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
    lineHeight: 21,
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

  sectionTitle: {
    color: '#25252b',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
    marginTop: 25,
    textAlign: 'right',
  },

  storeCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 15,
  },

  storeIcon: {
    fontSize: 31,
  },

  storeContent: {
    flex: 1,
    marginLeft: 13,
  },

  storeName: {
    color: '#25252b',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },

  storeMeta: {
    color: '#777781',
    fontSize: 10,
    marginTop: 5,
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
