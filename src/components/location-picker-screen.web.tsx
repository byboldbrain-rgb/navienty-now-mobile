import { Ionicons } from '@expo/vector-icons';
import {
    Stack,
    useRouter,
} from 'expo-router';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const BRAND_GREEN = '#00B14F';
const BRAND_GREEN_SOFT = '#EAF8F0';

export default function LocationPickerWebScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons
            name="map-outline"
            size={42}
            color={BRAND_GREEN}
          />
        </View>

        <Text style={styles.title}>
          تحديد موقع التوصيل متاح على الموبايل
        </Text>

        <Text style={styles.description}>
          افتح التطبيق على Android أو iPhone لاختيار موقع التوصيل من الخريطة.
          نسخة الويب لا تقوم بتحميل مكتبة الخرائط الأصلية.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color="#ffffff"
          />

          <Text style={styles.buttonText}>
            العودة إلى السلة
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },

  card: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#ececec',
    borderRadius: 26,
    borderWidth: 1,
    maxWidth: 480,
    padding: 28,
    width: '100%',
  },

  iconContainer: {
    alignItems: 'center',
    backgroundColor: BRAND_GREEN_SOFT,
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },

  title: {
    color: '#202020',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 18,
    textAlign: 'center',
  },

  description: {
    color: '#6f6f6f',
    fontSize: 14,
    lineHeight: 23,
    marginTop: 10,
    textAlign: 'center',
  },

  button: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: BRAND_GREEN,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 58,
    paddingHorizontal: 18,
  },

  buttonPressed: {
    opacity: 0.78,
  },

  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
});
