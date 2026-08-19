const androidGoogleMapsApiKey =
  process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

const iosGoogleMapsApiKey =
  process.env.GOOGLE_MAPS_IOS_API_KEY?.trim();

module.exports = ({ config }) => {
  const android = {
    ...config.android,
  };

  const ios = {
    ...config.ios,
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

  if (iosGoogleMapsApiKey) {
    ios.config = {
      ...(config.ios?.config ?? {}),
      googleMapsApiKey: iosGoogleMapsApiKey,
    };
  }

  return {
    ...config,
    android,
    ios,
  };
};