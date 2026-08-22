const path = require('node:path');

const expoPackageDirectory = path.dirname(
  require.resolve('expo/package.json'),
);

const babelPresetExpo = require.resolve(
  'babel-preset-expo',
  {
    paths: [expoPackageDirectory],
  },
);

module.exports = function (api) {
  api.cache(true);

  return {
    presets: [babelPresetExpo],
    plugins: [
      './scripts/babel-plugin-navienty-cached-image.cjs',
    ],
  };
};
