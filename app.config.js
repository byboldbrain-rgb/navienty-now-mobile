const { existsSync } = require('node:fs');

const androidGoogleMapsApiKey =
  process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

const iosGoogleMapsApiKey =
  process.env.GOOGLE_MAPS_IOS_API_KEY?.trim();

const appVariant =
  process.env.APP_VARIANT?.trim().toLowerCase() ??
  'production';

const isDevelopment =
  appVariant === 'development';

const pushAutoRegister =
  process.env.PUSH_AUTO_REGISTER?.trim().toLowerCase() !==
  'false';

const allowAndroidBuildWithoutGoogleServices =
  process.env.ALLOW_ANDROID_BUILD_WITHOUT_GOOGLE_SERVICES?.trim().toLowerCase() ===
  'true';

module.exports = ({ config }) => {
  const existingPlugins = Array.isArray(config.plugins)
    ? config.plugins.filter((plugin) => {
        const name = Array.isArray(plugin)
          ? plugin[0]
          : plugin;

        return name !== 'react-native-maps';
      })
    : [];

  const mapsPluginOptions = {};

  if (androidGoogleMapsApiKey) {
    mapsPluginOptions.androidGoogleMapsApiKey =
      androidGoogleMapsApiKey;
  }

  if (iosGoogleMapsApiKey) {
    mapsPluginOptions.iosGoogleMapsApiKey =
      iosGoogleMapsApiKey;
  }

  const mapsPlugin =
    Object.keys(mapsPluginOptions).length > 0
      ? ['react-native-maps', mapsPluginOptions]
      : 'react-native-maps';

  const productionAndroidPackage =
    config.android?.package ?? 'com.navienty.now';

  const productionIosBundleIdentifier =
    config.ios?.bundleIdentifier ??
    'com.navienty.now';

  const productionScheme =
    typeof config.scheme === 'string'
      ? config.scheme
      : 'navientynow';

  const localGoogleServicesFile = isDevelopment
    ? './google-services.dev.json'
    : './google-services.json';

  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON?.trim() ||
    (existsSync(localGoogleServicesFile)
      ? localGoogleServicesFile
      : null);

  if (
    process.env.EAS_BUILD === 'true' &&
    process.env.EAS_BUILD_PLATFORM === 'android' &&
    !googleServicesFile &&
    !allowAndroidBuildWithoutGoogleServices
  ) {
    throw new Error(
      'GOOGLE_SERVICES_JSON must be configured as an EAS secret file for Android production builds.',
    );
  }

  const android = {
    ...config.android,
    package: isDevelopment
      ? `${productionAndroidPackage}.dev`
      : productionAndroidPackage,
    ...(googleServicesFile
      ? {
          googleServicesFile,
        }
      : {}),
  };

  const ios = {
    ...config.ios,
    bundleIdentifier: isDevelopment
      ? `${productionIosBundleIdentifier}.dev`
      : productionIosBundleIdentifier,
  };

  if (androidGoogleMapsApiKey) {
    android.config = {
      ...(config.android?.config ?? {}),
      googleMaps: {
        ...(config.android?.config?.googleMaps ?? {}),
        apiKey: androidGoogleMapsApiKey,
      },
    };
  }

  return {
    ...config,
    name: isDevelopment
      ? `${config.name ?? 'Navienty Now'} Dev`
      : config.name,
    scheme: isDevelopment
      ? `${productionScheme}-dev`
      : productionScheme,
    android,
    ios,
    plugins: [
      ...existingPlugins,
      mapsPlugin,
    ],
    extra: {
      ...(config.extra ?? {}),
      appVariant,
      pushAutoRegister,
    },
  };
};
