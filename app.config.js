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

  const android = {
    ...config.android,
    package: isDevelopment
      ? `${productionAndroidPackage}.dev`
      : productionAndroidPackage,
    googleServicesFile: isDevelopment
      ? './google-services.dev.json'
      : './google-services.json',
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
