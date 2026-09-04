import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

import {
    SEARCH_SCOPES,
    type SearchScopeKey,
} from '../../config/search-scopes';
import {
    NAVIENTY_NOW_LAYOUT,
} from '../../theme/navienty-now-theme';

const PLACEHOLDER_ROTATION_MS = 1800;

type CategorySearchEntryProps = {
  scope: SearchScopeKey;
  suggestions?: readonly string[];
  style?: StyleProp<ViewStyle>;
};

export default function CategorySearchEntry({
  scope,
  suggestions = [],
  style,
}: CategorySearchEntryProps) {
  const router = useRouter();

  const cleanSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const suggestion of suggestions) {
      const value = suggestion.trim();

      if (!value) {
        continue;
      }

      const normalized =
        value.toLocaleLowerCase('ar');

      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      result.push(value);
    }

    return result;
  }, [suggestions]);

  const [activeSuggestionIndex, setActiveSuggestionIndex] =
    useState(0);

  useEffect(() => {
    setActiveSuggestionIndex(0);

    if (cleanSuggestions.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setActiveSuggestionIndex(
        (currentIndex) =>
          (currentIndex + 1) %
          cleanSuggestions.length,
      );
    }, PLACEHOLDER_ROTATION_MS);

    return () => {
      clearInterval(timer);
    };
  }, [cleanSuggestions]);

  const scopeConfig = SEARCH_SCOPES[scope];

  const activeSuggestion =
    cleanSuggestions[
      activeSuggestionIndex %
        Math.max(1, cleanSuggestions.length)
    ] ?? scopeConfig.placeholderFallback;

  return (
    <Pressable
      accessibilityLabel={`فتح البحث في ${scopeConfig.label}. ابحث عن ${activeSuggestion}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.searchEntry,
        style,
        pressed && styles.searchEntryPressed,
      ]}
      onPress={() => {
        router.push({
          pathname: '/search/[scope]',
          params: {
            scope,
          },
        });
      }}
    >
      <View style={styles.searchIconWrap}>
        <Ionicons
          color="#8C8C8C"
          name="search-outline"
          size={19}
        />
      </View>

      <Text
        numberOfLines={1}
        style={styles.searchPlaceholder}
      >
        <Text style={styles.searchFixedText}>
          ابحث عن{' '}
        </Text>
        <Text style={styles.searchDynamicText}>
          {activeSuggestion}
        </Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchEntry: {
    alignItems: 'center',
    backgroundColor: '#F6F6F6',
    borderColor: '#E4E4E4',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row-reverse',
    height: 42,
    marginBottom: 10,
    marginHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    marginTop: 10,
    paddingHorizontal: 13,
  },

  searchEntryPressed: {
    backgroundColor: '#F1F1F1',
    opacity: 0.94,
  },

  searchIconWrap: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    marginLeft: 6,
    width: 22,
  },

  searchPlaceholder: {
    color: '#303030',
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  searchFixedText: {
    color: '#303030',
    fontWeight: '500',
  },

  searchDynamicText: {
    color: '#696969',
    fontWeight: '500',
  },
});
