// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      /**
       * Expo SDK 57 enables the newest React Hooks compiler rules. The
       * existing application intentionally uses React Native Animated values
       * held in refs and several established load-on-mount effects. Treat
       * those newly introduced rules as migration warnings for this release
       * instead of forcing a broad behavioural refactor during the SDK
       * security upgrade. New lint errors from every other rule still fail CI.
       */
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: [
      'src/services/catalog-service.ts',
      'src/services/delivery-location-service.ts',
      'src/services/order-service.ts',
      'src/store/cart-store.ts',
    ],
    rules: {
      /**
       * These compatibility modules deliberately re-export the legacy/base
       * public API and then provide explicit local overrides for selected
       * functions. Explicit exports take precedence over star re-exports at
       * module resolution time, so the duplicate-name report is intentional
       * here and disabling only this lint rule preserves the existing API.
       */
      'import/export': 'off',
    },
  },
  {
    files: ['supabase/functions/**/*.ts'],
    rules: {
      /**
       * Supabase Edge Functions use Deno-native `jsr:` and `npm:` module
       * specifiers. They are resolved by the Edge runtime, while the Node
       * resolver used by Expo ESLint cannot resolve those protocols.
       */
      'import/no-unresolved': 'off',
    },
  },
]);
