import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const appConfig = JSON.parse(await readFile('app.json', 'utf8'));
const dynamicAppConfig = await readFile('app.config.js', 'utf8');
const expo = appConfig?.expo;

if (!expo || typeof expo !== 'object') {
  throw new Error('app.json is missing the expo configuration object.');
}

const plugins = Array.isArray(expo.plugins) ? expo.plugins : [];
const findPlugin = (name) =>
  plugins.find(
    (plugin) =>
      plugin === name ||
      (Array.isArray(plugin) && plugin[0] === name),
  );
const splashPlugin = plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
);

if (!splashPlugin) {
  throw new Error('expo-splash-screen must be configured as a config plugin.');
}

const splashOptions = splashPlugin[1];
if (!splashOptions || typeof splashOptions !== 'object') {
  throw new Error('expo-splash-screen options are missing.');
}

const splashImage = splashOptions.image;
if (typeof splashImage !== 'string' || splashImage.trim().length === 0) {
  throw new Error(
    'expo-splash-screen.image is required so Android generates splashscreen_logo.',
  );
}

const splashImagePath = path.resolve(splashImage);
await access(splashImagePath);

if (
  splashOptions.imageWidth !== undefined &&
  (!Number.isFinite(splashOptions.imageWidth) || splashOptions.imageWidth <= 0)
) {
  throw new Error('expo-splash-screen.imageWidth must be a positive number.');
}

if (expo.android?.package !== 'com.navienty.now') {
  throw new Error('Unexpected Android package identifier.');
}

if (expo.ios?.bundleIdentifier !== 'com.navienty.now') {
  throw new Error('Unexpected iOS bundle identifier.');
}

if (expo.ios?.supportsTablet !== false) {
  throw new Error(
    'The first App Store release must remain iPhone-only until iPad is tested.',
  );
}

if (
  expo.ios?.infoPlist?.ITSAppUsesNonExemptEncryption !== false
) {
  throw new Error(
    'iOS export-compliance encryption declaration must be explicit.',
  );
}

const locationPlugin = findPlugin('expo-location');
const locationOptions = Array.isArray(locationPlugin)
  ? locationPlugin[1]
  : null;

for (const option of [
  'locationAlwaysAndWhenInUsePermission',
  'locationAlwaysPermission',
  'motionUsagePermission',
  'isIosBackgroundLocationEnabled',
]) {
  if (locationOptions?.[option] !== false) {
    throw new Error(
      `expo-location.${option} must remain disabled for the release.`,
    );
  }
}

const notificationsPlugin = findPlugin(
  'expo-notifications',
);
const notificationOptions = Array.isArray(
  notificationsPlugin,
)
  ? notificationsPlugin[1]
  : null;

if (
  notificationOptions?.enableBackgroundRemoteNotifications !==
  false
) {
  throw new Error(
    'Background remote notifications must remain disabled.',
  );
}

const secureStorePlugin = findPlugin(
  'expo-secure-store',
);
const secureStoreOptions = Array.isArray(
  secureStorePlugin,
)
  ? secureStorePlugin[1]
  : null;

if (secureStoreOptions?.faceIDPermission !== false) {
  throw new Error(
    'Face ID permission must not be declared when the app does not use it.',
  );
}

if (
  !dynamicAppConfig.includes(
    'process.env.GOOGLE_SERVICES_JSON',
  ) ||
  !dynamicAppConfig.includes(
    'existsSync(localGoogleServicesFile)',
  ) ||
  !dynamicAppConfig.includes(
    "process.env.EAS_BUILD_PLATFORM === 'android'",
  )
) {
  throw new Error(
    'Android Firebase config must use the EAS file variable, a safe local fallback, and a remote-build gate.',
  );
}

console.log(`Release config validation passed (splash image: ${splashImage}).`);
