import { readFileSync } from 'node:fs';

const login = readFileSync(
  'src/app/login.tsx',
  'utf8',
);
const appConfig = readFileSync(
  'app.json',
  'utf8',
);
const packageJson = JSON.parse(
  readFileSync(
    'package.json',
    'utf8',
  ),
);

const failures = [];

for (const provider of [
  "'google'",
  "'facebook'",
  "'apple'",
]) {
  if (!login.includes(provider)) {
    failures.push(
      `login screen is missing OAuth provider: ${provider}`,
    );
  }
}

for (const requiredText of [
  'signInWithOAuth',
  'linkIdentity',
  'signInWithIdToken',
  'openAuthSessionAsync',
  '.signInAsync',
  'CryptoDigestAlgorithm',
  'getRandomBytesAsync',
  "'navientynow'",
  "'auth/callback'",
  'إستمرار عبر Apple',
]) {
  if (!login.includes(requiredText)) {
    failures.push(
      `social authentication is missing required behavior: ${requiredText}`,
    );
  }
}

if (!appConfig.includes('"scheme": "navientynow"')) {
  failures.push(
    'app config is missing the production OAuth scheme.',
  );
}

const expoConfig =
  JSON.parse(appConfig).expo;

if (
  expoConfig.ios
    ?.usesAppleSignIn !==
  true
) {
  failures.push(
    'iOS config must enable the native Sign in with Apple capability.',
  );
}

const configuredPlugins =
  (expoConfig.plugins ?? []).map(
    (plugin) =>
      Array.isArray(plugin)
        ? plugin[0]
        : plugin,
  );

if (
  !configuredPlugins.includes(
    'expo-apple-authentication',
  )
) {
  failures.push(
    'app config is missing the expo-apple-authentication plugin.',
  );
}

for (const dependency of [
  'expo-apple-authentication',
  'expo-crypto',
]) {
  if (
    !packageJson.dependencies?.[
      dependency
    ]
  ) {
    failures.push(
      `package.json is missing ${dependency}.`,
    );
  }
}

if (failures.length > 0) {
  console.error(
    'Social authentication parity validation failed:',
  );

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log(
  'Social authentication parity validation passed.',
);
