import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const appConfig = JSON.parse(await readFile('app.json', 'utf8'));
const expo = appConfig?.expo;

if (!expo || typeof expo !== 'object') {
  throw new Error('app.json is missing the expo configuration object.');
}

const plugins = Array.isArray(expo.plugins) ? expo.plugins : [];
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

console.log(`Release config validation passed (splash image: ${splashImage}).`);
