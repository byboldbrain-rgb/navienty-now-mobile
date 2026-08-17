import fs from 'node:fs';

const filePath = 'src/store/cart-store.ts';

function replaceExactly(
  source,
  pattern,
  replacement,
  expectedCount,
  label,
) {
  const matches = source.match(pattern) ?? [];

  if (matches.length !== expectedCount) {
    throw new Error(
      `${label}: expected ${expectedCount} replacement(s), found ${matches.length}.`,
    );
  }

  return source.replace(pattern, replacement);
}

let source = fs.readFileSync(filePath, 'utf8');

source = replaceExactly(
  source,
  /^import AsyncStorage from '@react-native-async-storage\/async-storage';/m,
  `import AsyncStorage from '@react-native-async-storage/async-storage';\n\nimport {\n  hasDifferentRestaurantCart,\n  isRestaurantCartCategory,\n  isSameCartLine,\n} from '../domain/cart-rules';\n\nexport {\n  isRestaurantCartCategory,\n} from '../domain/cart-rules';`,
  1,
  'cart-rule imports',
);

source = replaceExactly(
  source,
  /\/\*\*\n \* Used by screens when they need to apply the restaurant-only rule\.\n \*\/\nexport function isRestaurantCartCategory\([\s\S]*?\n\}\n\n\/\*\*\n \* A cart line is identified by:[\s\S]*?\n\}\n\nfunction normalizeCartProduct/,
  'function normalizeCartProduct',
  1,
  'remove duplicated cart rules',
);

source = replaceExactly(
  source,
  /          if \(\n            isRestaurantCartCategory\(\n              categorySlug,\n            \)\n          \) \{\n            const anotherRestaurantCart =\n              Object\.values\(\n                state\.carts,\n              \)\.find\(\n                \(cart\) =>\n                  cart\.items\.length > 0 &&\n                  cart\.storeId !==\n                    store\.id &&\n                  isRestaurantCartCategory\(\n                    cart\.categorySlug,\n                  \),\n              \);\n\n            if \(\n              anotherRestaurantCart\n            \) \{\n              result =\n                'different-restaurant';\n\n              return state;\n            \}\n          \}/,
  `          if (\n            hasDifferentRestaurantCart(\n              Object.values(state.carts),\n              store.id,\n              categorySlug,\n            )\n          ) {\n            result =\n              'different-restaurant';\n\n            return state;\n          }`,
  1,
  'restaurant conflict rule',
);

fs.writeFileSync(filePath, source);
console.log('Applied shared cart business rules to cart-store.');
