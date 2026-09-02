from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative_path: str, old: str, new: str) -> None:
    path = ROOT / relative_path
    text = path.read_text(encoding="utf-8")

    if new in text:
        print(f"SKIP already patched: {relative_path}")
        return

    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"Expected exactly one match in {relative_path}, found {count}.\n"
            f"Pattern:\n{old[:500]}"
        )

    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"PATCHED: {relative_path}")


# ---------------------------------------------------------------------------
# Home routing: make Laundry use the same premium destination on both iOS
# and Android instead of falling through to the generic category route.
# ---------------------------------------------------------------------------
replace_once(
    "src/app/index.tsx",
    """      router.push(\n        '/category/personal-care',\n      );\n      return;\n    }\n\n    if (\n      normalizedSlug === 'request-anything' ||""",
    """      router.push(\n        '/category/personal-care',\n      );\n      return;\n    }\n\n    if (\n      normalizedSlug === 'laundry' ||\n      normalizedSlug === 'laundry-ironing' ||\n      normalizedSlug === 'wash-and-iron' ||\n      normalizedSlug === 'washing-ironing'\n    ) {\n      router.push(\n        '/category/laundry',\n      );\n      return;\n    }\n\n    if (\n      normalizedSlug === 'request-anything' ||""",
)


# ---------------------------------------------------------------------------
# Generic category route: retain the iOS layout exactly, but make fallback
# screens respect real Android top/bottom system insets on cutout, gesture,
# and three-button-navigation devices.
# ---------------------------------------------------------------------------
replace_once(
    "src/app/category/[id].tsx",
    """  Image,\n  Pressable,""",
    """  Image,\n  Platform,\n  Pressable,""",
)

replace_once(
    "src/app/category/[id].tsx",
    """} from 'react-native';\n\nimport { StoreListScreenSkeleton""",
    """} from 'react-native';\nimport { useSafeAreaInsets } from 'react-native-safe-area-context';\n\nimport { StoreListScreenSkeleton""",
)

replace_once(
    "src/app/category/[id].tsx",
    """function GenericCategoryScreen({\n  categorySlug,\n}: {\n  categorySlug: string;\n}) {\n  const router = useRouter();\n\n  const savedServiceAreaId =""",
    """function GenericCategoryScreen({\n  categorySlug,\n}: {\n  categorySlug: string;\n}) {\n  const router = useRouter();\n  const insets = useSafeAreaInsets();\n\n  const savedServiceAreaId =""",
)

replace_once(
    "src/app/category/[id].tsx",
    """    <ScrollView\n      contentContainerStyle={styles.pageContent}\n      showsVerticalScrollIndicator={false}\n      style={styles.screen}\n    >""",
    """    <ScrollView\n      contentContainerStyle={[\n        styles.pageContent,\n        Platform.OS === 'android' && {\n          paddingTop:\n            Math.max(insets.top, 24) + 18,\n          paddingBottom:\n            42 + Math.max(insets.bottom, 0),\n        },\n      ]}\n      showsVerticalScrollIndicator={false}\n      style={styles.screen}\n    >""",
)


# ---------------------------------------------------------------------------
# Restaurants: preserve the existing iOS header geometry. On Android, derive
# the same optical spacing from the real status-bar/cutout inset instead of a
# hard-coded 34 px assumption.
# ---------------------------------------------------------------------------
replace_once(
    "src/app/category/restaurants.tsx",
    """export default function RestaurantsScreen() {\n  const router = useRouter();\n\n  const params =""",
    """export default function RestaurantsScreen() {\n  const router = useRouter();\n  const insets = useSafeAreaInsets();\n\n  const params =""",
)

replace_once(
    "src/app/category/restaurants.tsx",
    """      <View style={styles.topHeader}>""",
    """      <View\n        style={[\n          styles.topHeader,\n          Platform.OS === 'android' && {\n            minHeight:\n              Math.max(insets.top, 24) + 76,\n            paddingTop:\n              Math.max(insets.top, 24) + 10,\n          },\n        ]}\n      >""",
)


# ---------------------------------------------------------------------------
# Store details: this is the most important Android fix. The screen has a
# fixed header, a full-screen product modal, and two fixed bottom bars. Keep
# the iOS values untouched and only add real Android insets where needed.
# ---------------------------------------------------------------------------
replace_once(
    "src/app/store/[id].tsx",
    """  LayoutChangeEvent,\n  Modal,\n  Pressable,""",
    """  LayoutChangeEvent,\n  Modal,\n  Platform,\n  Pressable,""",
)

replace_once(
    "src/app/store/[id].tsx",
    """} from 'react-native';\n\nimport getAppBootstrap""",
    """} from 'react-native';\nimport { useSafeAreaInsets } from 'react-native-safe-area-context';\n\nimport getAppBootstrap""",
)

replace_once(
    "src/app/store/[id].tsx",
    """export default function StoreScreen() {\n  const router = useRouter();\n\n  const savedServiceAreaId =""",
    """export default function StoreScreen() {\n  const router = useRouter();\n  const insets = useSafeAreaInsets();\n\n  const savedServiceAreaId =""",
)

replace_once(
    "src/app/store/[id].tsx",
    """      <View style={styles.topHeader}>""",
    """      <View\n        style={[\n          styles.topHeader,\n          Platform.OS === 'android' && {\n            minHeight:\n              Math.max(insets.top, 24) + 76,\n            paddingTop:\n              Math.max(insets.top, 24) + 10,\n          },\n        ]}\n      >""",
)

replace_once(
    "src/app/store/[id].tsx",
    """        contentContainerStyle={[\n          styles.pageContent,\n\n          cartItemCount > 0 &&\n            styles.pageContentWithBottomBar,\n        ]}""",
    """        contentContainerStyle={[\n          styles.pageContent,\n\n          cartItemCount > 0 &&\n            styles.pageContentWithBottomBar,\n\n          cartItemCount > 0 &&\n            Platform.OS === 'android' && {\n              paddingBottom:\n                140 + Math.max(insets.bottom, 0),\n            },\n        ]}""",
)

replace_once(
    "src/app/store/[id].tsx",
    """                    style={({\n                      pressed,\n                    }) => [\n                      styles.productModalCloseButton,\n\n                      pressed &&\n                        styles.topCircleButtonPressed,\n                    ]}""",
    """                    style={({\n                      pressed,\n                    }) => [\n                      styles.productModalCloseButton,\n\n                      Platform.OS === 'android' && {\n                        top:\n                          Math.max(insets.top, 24) + 12,\n                      },\n\n                      pressed &&\n                        styles.topCircleButtonPressed,\n                    ]}""",
)

replace_once(
    "src/app/store/[id].tsx",
    """                contentContainerStyle={\n                  styles.productModalScrollContent\n                }""",
    """                contentContainerStyle={[\n                  styles.productModalScrollContent,\n                  Platform.OS === 'android' && {\n                    paddingBottom:\n                      170 + Math.max(insets.bottom, 0),\n                  },\n                ]}""",
)

replace_once(
    "src/app/store/[id].tsx",
    """              <View\n                style={\n                  styles.productModalBottomBar\n                }\n              >""",
    """              <View\n                style={[\n                  styles.productModalBottomBar,\n                  Platform.OS === 'android' && {\n                    paddingBottom:\n                      Math.max(insets.bottom, 8) + 12,\n                  },\n                ]}\n              >""",
)

replace_once(
    "src/app/store/[id].tsx",
    """        <View\n          style={\n            styles.cartBarWrapper\n          }\n        >""",
    """        <View\n          style={[\n            styles.cartBarWrapper,\n            Platform.OS === 'android' && {\n              paddingBottom:\n                Math.max(insets.bottom, 8) + 12,\n            },\n          ]}\n        >""",
)


# ---------------------------------------------------------------------------
# Cart: bottom checkout area already uses insets. Replace only the iPhone-ish
# fixed header offset with a real Android status/cutout inset.
# ---------------------------------------------------------------------------
replace_once(
    "src/app/cart.tsx",
    """      {/* STICKY HEADER */}\n\n      <View style={styles.header}>""",
    """      {/* STICKY HEADER */}\n\n      <View\n        style={[\n          styles.header,\n          Platform.OS === 'android' && {\n            paddingTop:\n              Math.max(insets.top, 24) + 10,\n          },\n        ]}\n      >""",
)


# ---------------------------------------------------------------------------
# Checkout: same rule as Cart. Fixed action bar already respects bottom inset;
# extend ScrollView clearance on Android so the last summary row is never
# hidden behind the taller safe bottom action region.
# ---------------------------------------------------------------------------
replace_once(
    "src/app/checkout.tsx",
    """      <View\n        style={styles.header}\n      >""",
    """      <View\n        style={[\n          styles.header,\n          Platform.OS === 'android' && {\n            paddingTop:\n              Math.max(insets.top, 24) + 10,\n          },\n        ]}\n      >""",
)

replace_once(
    "src/app/checkout.tsx",
    """        contentContainerStyle={\n          styles.pageContent\n        }""",
    """        contentContainerStyle={[\n          styles.pageContent,\n          Platform.OS === 'android' && {\n            paddingBottom:\n              114 + Math.max(insets.bottom, 0),\n          },\n        ]}""",
)


# ---------------------------------------------------------------------------
# Orders: the app bottom navigation already consumes bottom safe area. Make the
# scroll content account for that extra Android height, and derive the top
# whitespace from the real status/cutout inset while leaving iOS unchanged.
# ---------------------------------------------------------------------------
replace_once(
    "src/app/orders.tsx",
    """  Image,\n  Pressable,""",
    """  Image,\n  Platform,\n  Pressable,""",
)

replace_once(
    "src/app/orders.tsx",
    """  type ImageSourcePropType,\n} from 'react-native';\n\nimport AppBottomNavigation""",
    """  type ImageSourcePropType,\n} from 'react-native';\nimport { useSafeAreaInsets } from 'react-native-safe-area-context';\n\nimport AppBottomNavigation""",
)

replace_once(
    "src/app/orders.tsx",
    """export default function OrdersScreen() {\n  const router =\n    useRouter();\n\n  const authState =""",
    """export default function OrdersScreen() {\n  const router =\n    useRouter();\n\n  const insets =\n    useSafeAreaInsets();\n\n  const authState =""",
)

replace_once(
    "src/app/orders.tsx",
    """      <ScrollView\n        contentContainerStyle={\n          styles.pageContent\n        }""",
    """      <ScrollView\n        contentContainerStyle={[\n          styles.pageContent,\n          Platform.OS === 'android' && {\n            paddingTop:\n              Math.max(insets.top, 24) + 12,\n            paddingBottom:\n              NAVIENTY_NOW_LAYOUT.bottomNavigationHeight +\n              44 +\n              Math.max(insets.bottom, 0),\n          },\n        ]}""",
)


print("Android production hardening patch completed successfully.")
