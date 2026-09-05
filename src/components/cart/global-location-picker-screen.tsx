import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function GlobalLocationPickerWebScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <Ionicons
        name="location-outline"
        size={44}
        color="#00B14F"
      />
      <Text style={styles.title}>
        تحديد موقع التوصيل متاح من تطبيق الموبايل
      </Text>
      <Pressable
        style={styles.button}
        onPress={() => router.back()}
      >
        <Text style={styles.buttonText}>رجوع</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#202020',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#00B14F',
    borderRadius: 999,
    marginTop: 22,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
});
