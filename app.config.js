const androidGoogleMapsApiKey =
  process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

const iosGoogleMapsApiKey =
  process.env.GOOGLE_MAPS_IOS_API_KEY?.trim();

module.exports = ({ config }) => {
  const existingPlugins = Array.isArray(config.plugins)
    ? config.plugins.filter((plugin) => {
        const name = Array.isArray(plugin) ? plugin[0] : plugin;
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

  const android = {
    ...config.android,
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
    android,
    plugins: [
      ...existingPlugins,
      mapsPlugin,
    ],
  };
};
