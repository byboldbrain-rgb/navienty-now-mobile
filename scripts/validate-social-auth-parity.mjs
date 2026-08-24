import { readFileSync } from 'node:fs';

const login = readFileSync(
  'src/app/login.tsx',
  'utf8',
);
const appConfig = readFileSync(
  'app.json',
  'utf8',
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
  'openAuthSessionAsync',
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
