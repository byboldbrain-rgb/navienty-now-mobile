# Navienty Now Mobile

Navienty Now mobile application built with Expo Router, React Native, TypeScript, and Supabase.

## Current release stack

- Expo SDK 57
- React Native 0.86.2
- React 19.2.3
- TypeScript 6
- Supabase (`now` schema)
- Expo Notifications

The native app identifiers are `com.navienty.now` on both Android and iOS.

## Local development

Install the exact locked dependencies:

```bash
npm ci
```

Copy the environment template and provide local development values without committing them:

```bash
cp .env.example .env.local
```

Required public client variables:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Start Expo:

```bash
npx expo start
```

## Required checks

Run the same release gates used by Mobile CI:

```bash
node scripts/validate-image-assets.mjs
node scripts/validate-release-config.mjs
node scripts/validate-checkout-handoff.mjs
node scripts/validate-native-maps-config.mjs
node scripts/validate-notification-lifecycle.mjs
node scripts/validate-app-store-account-controls.mjs
node scripts/validate-social-auth-parity.mjs
npm run audit:prod
npm test
npx tsc --noEmit
npm run lint
```

`npm run audit:prod` keeps High/Critical dependency findings blocking. It contains a narrowly scoped temporary exception for the exact currently unpatched `image-size` advisories inherited through Metro build tooling; remove that exception as soon as upstream provides a patched dependency chain.

## EAS environments

`eas.json` explicitly separates:

- `development`
- `preview`
- `production`

Configure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the matching EAS environment. Do not commit environment values, Expo access tokens, certificates, keystores, provisioning profiles, or private keys.

The production iOS environment also requires a Google Maps key restricted to
the `com.navienty.now` bundle identifier. See
[`docs/app-store-release-runbook.md`](docs/app-store-release-runbook.md) for
the exact App Store, Supabase, Sign in with Apple, privacy, and TestFlight
release sequence.

Android EAS builds read the gitignored Firebase configuration from a secret
file environment variable named `GOOGLE_SERVICES_JSON`. Local development can
instead provide `google-services.json` or `google-services.dev.json` at the
repository root; neither file may be committed.

## Release Candidate builds

The release-candidate workflow is:

```text
.github/workflows/rc-eas-build.yml
```

It requires the GitHub Actions repository secret:

```text
EXPO_TOKEN
```

The workflow verifies Expo authentication and submits Android and iOS `preview` builds to EAS. The secret must be stored in GitHub Actions/EAS configuration only and must never be committed to this repository.

Before a release PR is marked ready for review, the resulting Android and iOS binaries must pass the physical-device smoke-test checklist documented on the launch-hardening pull request.

## Push notifications

`expo-notifications` is part of the current SDK 57 dependency set. Push registration and notification routing require a native EAS build; Expo Go is not the release-validation target.

After changing native dependencies, notification configuration, app identifiers, or signing configuration, create a new native preview/production build before testing the affected behavior.
