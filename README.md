# Navienty Now Mobile

This is the mobile application for Navienty Now, built with Expo Router, React Native, TypeScript, and Supabase.

## Development

Install dependencies and start Expo:

```bash
npm install
npx expo start
```

Run the project checks before merging launch-hardening changes:

```bash
npx tsc --noEmit
npm run lint
```

## Push notifications

The database-side customer push-subscription contract is already available through Supabase RPCs. The native `expo-notifications` dependency is intentionally not added until it can be installed with Expo so `package.json` and `package-lock.json` stay synchronized.

For Expo SDK 54, install the compatible notification package from a normal project checkout with:

```bash
npx expo install expo-notifications
```

After changing native dependencies or notification configuration, create a new development/production build before testing remote push notifications.
