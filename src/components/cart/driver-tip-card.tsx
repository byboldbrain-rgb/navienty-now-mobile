import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const ACCENT = '#F27C42';
const MAX_TIP_EGP = 1000;
const SUGGESTED_TIPS = [
  { amount: 10, emoji: '🍦' },
  { amount: 15, emoji: '🍟' },
  { amount: 20, emoji: '🍔' },
] as const;

type DriverTipCardProps = {
  amount: number;
  onChange: (amount: number) => void;
};

function formatTip(amount: number) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function parseTipInput(input: string): number | null {
  const normalized = input
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/,/g, '.')
    .trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > MAX_TIP_EGP) return null;
  return Math.round(value * 100) / 100;
}

/**
 * One gratuity for the entire order, including multi-store checkout.
 * Pressing an active preset again removes the gratuity.
 */
export default function DriverTipCard({ amount, onChange }: DriverTipCardProps) {
  const [customVisible, setCustomVisible] = useState(false);
  const [customText, setCustomText] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  const isCustom = amount > 0 &&
    !SUGGESTED_TIPS.some((item) => item.amount === amount);

  useEffect(() => {
    if (customVisible) {
      setCustomText(amount > 0 ? formatTip(amount) : '');
      setCustomError(null);
    }
  }, [customVisible]);

  function saveCustomTip() {
    const parsed = parseTipInput(customText);
    if (parsed === null) {
      setCustomError('أدخل مبلغًا من 1 إلى 1000 جنيه (بحد أقصى رقمين عشريين).');
      return;
    }
    onChange(parsed);
    setCustomVisible(false);
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>🛵</Text>
          </View>
          <View style={styles.headerCopy}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>كافئ السائق بإكرامية</Text>
              <Ionicons name="information-circle-outline" size={18} color="#333333" />
            </View>
            <Text style={styles.subtitle}>يحتفظ السائق بمبلغ الإكرامية بالكامل</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.optionsScroll}
          contentContainerStyle={styles.options}
        >
          {SUGGESTED_TIPS.map((item) => {
            const selected = amount === item.amount;
            return (
              <Pressable
                key={item.amount}
                accessibilityRole="radio"
                accessibilityLabel={`إكرامية ${item.amount} جنيه`}
                accessibilityState={{ selected }}
                onPress={() => onChange(selected ? 0 : item.amount)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={styles.chipEmoji}>{item.emoji}</Text>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {item.amount} ج.م
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="اختيار مبلغ إكرامية آخر"
            onPress={() => setCustomVisible(true)}
            style={[styles.chip, isCustom && styles.chipSelected]}
          >
            <Ionicons name="pencil-outline" size={17} color={isCustom ? ACCENT : '#292929'} />
            <Text style={[styles.chipText, isCustom && styles.chipTextSelected]}>
              {isCustom ? `${formatTip(amount)} ج.م` : 'مبلغ آخر'}
            </Text>
          </Pressable>
        </ScrollView>

        {amount > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange(0)}
            hitSlop={8}
            style={styles.removeTip}
          >
            <Text style={styles.removeTipText}>إزالة الإكرامية</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal
        visible={customVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <Pressable style={styles.backdrop} onPress={() => setCustomVisible(false)} />
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarEmoji}>🛵</Text>
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>كافئ السائق بإكرامية</Text>
                <Text style={styles.subtitle}>يحتفظ السائق بمبلغ الإكرامية بالكامل</Text>
              </View>
            </View>
            <TextInput
              autoFocus
              keyboardType="decimal-pad"
              maxLength={7}
              placeholder="أدخل مبلغ الإكرامية"
              placeholderTextColor="#A3A3A3"
              style={styles.customInput}
              textAlign="right"
              value={customText}
              onChangeText={(text) => {
                setCustomText(text);
                setCustomError(null);
              }}
              onSubmitEditing={saveCustomTip}
              returnKeyType="done"
            />
            {customError ? <Text style={styles.error}>{customError}</Text> : null}
            <Pressable onPress={saveCustomTip} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>تأكيد الإكرامية</Text>
            </Pressable>
            <Pressable onPress={() => setCustomVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>إغلاق</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E4E4E4',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  header: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF1E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 29 },
  headerCopy: { flex: 1, alignItems: 'flex-end' },
  titleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  title: { color: '#202020', fontSize: 17, fontWeight: '800', textAlign: 'right' },
  subtitle: { marginTop: 5, fontSize: 12, color: '#858585', textAlign: 'right' },
  optionsScroll: { marginTop: 20, flexGrow: 0 },
  options: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, paddingVertical: 2 },
  chip: {
    borderWidth: 1,
    borderColor: '#E1E1E1',
    paddingHorizontal: 15,
    minHeight: 44,
    borderRadius: 24,
    flexDirection: 'row-reverse',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { borderColor: ACCENT, backgroundColor: '#FFF4ED' },
  chipText: { color: '#292929', fontSize: 14, fontWeight: '700' },
  chipTextSelected: { color: '#C95C2E' },
  chipEmoji: { fontSize: 17 },
  removeTip: { alignSelf: 'flex-end', marginTop: 12, paddingVertical: 5 },
  removeTipText: { color: '#9A5750', fontSize: 12, textDecorationLine: 'underline' },
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.48)' },
  dialog: {
    borderRadius: 22,
    padding: 22,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  dialogHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 20 },
  customInput: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: '#242424',
    borderRadius: 16,
    paddingHorizontal: 14,
    color: '#242424',
    fontSize: 20,
  },
  error: { color: '#C83535', textAlign: 'right', fontSize: 12, marginTop: 7 },
  saveButton: { marginTop: 16, borderRadius: 16, minHeight: 52, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 17 },
  closeButton: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#292929',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: { color: '#292929', fontWeight: '700', fontSize: 17 },
});
