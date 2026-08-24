import { readFileSync } from 'node:fs';

const appConfig = readFileSync('app.config.js', 'utf8');
const locationPicker = readFileSync(
  'src/components/location-picker-screen.native.tsx',
  'utf8',
);

const failures = [];

if (!appConfig.includes('GOOGLE_MAPS_ANDROID_API_KEY')) {
  failures.push('app.config.js must read GOOGLE_MAPS_ANDROID_API_KEY');
}

if (!appConfig.includes('GOOGLE_MAPS_IOS_API_KEY')) {
  failures.push('app.config.js must read GOOGLE_MAPS_IOS_API_KEY');
}

if (!appConfig.includes("'react-native-maps'")) {
  failures.push('app.config.js must configure the react-native-maps plugin');
}

if (!appConfig.includes('androidGoogleMapsApiKey')) {
  failures.push('react-native-maps must receive androidGoogleMapsApiKey');
}

if (!appConfig.includes('iosGoogleMapsApiKey')) {
  failures.push('react-native-maps must receive iosGoogleMapsApiKey');
}

if (!appConfig.includes('googleMaps')) {
  failures.push('Expo android.config.googleMaps must be populated when the key exists');
}

if (!locationPicker.includes('PROVIDER_GOOGLE')) {
  failures.push('native location picker is expected to use the Google Maps provider');
}

if (failures.length > 0) {
  console.error('Native Maps configuration validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Native Maps configuration validation passed.');
