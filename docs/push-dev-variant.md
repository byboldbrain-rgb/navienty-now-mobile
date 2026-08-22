# Navienty Now development app variant

The EAS `development` profile builds a separate installable app variant:

- Android application ID: `com.navienty.now.dev`
- iOS bundle identifier: `com.navienty.now.dev`
- Display name: `Navienty Now Dev`
- URL scheme: `navientynow-dev`
- Android Firebase config: `google-services.dev.json`

Production remains unchanged:

- Android application ID: `com.navienty.now`
- iOS bundle identifier: `com.navienty.now`
- Android Firebase config: `google-services.json`

## Android push setup

Register `com.navienty.now.dev` as a second Android app inside the existing Firebase project, download its `google-services.json`, and save it in the project root as `google-services.dev.json`.

The Firebase Admin / FCM V1 service-account private key must stay outside the repository. Assign the existing FCM V1 service-account key to the development application identifier in EAS credentials.

## Build

```powershell
eas build --profile development --platform android
```

The `development` profile sets `APP_VARIANT=development` automatically.

## Start Metro for the development client on Windows PowerShell

```powershell
$env:APP_VARIANT="development"
npx expo start --dev-client
```

To return the current shell to the production/default configuration later:

```powershell
Remove-Item Env:APP_VARIANT -ErrorAction SilentlyContinue
```
