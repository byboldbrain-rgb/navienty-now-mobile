import fs from 'node:fs';

function replaceExactly({
  path,
  pattern,
  replacement,
  expectedCount,
}) {
  const source = fs.readFileSync(path, 'utf8');
  const matches = source.match(pattern) ?? [];

  if (matches.length !== expectedCount) {
    throw new Error(
      `${path}: expected ${expectedCount} compatibility replacement(s), found ${matches.length}.`,
    );
  }

  const next = source.replace(pattern, replacement);
  fs.writeFileSync(path, next);
}

const absoluteFillFiles = [
  ['src/app/_layout.tsx', 1],
  ['src/app/cart.tsx', 1],
  ['src/app/index.tsx', 2],
  ['src/app/store/[id].tsx', 1],
  ['src/components/address-details-screen.native.tsx', 1],
  ['src/components/location-picker-screen.native.tsx', 2],
];

for (const [path, expectedCount] of absoluteFillFiles) {
  replaceExactly({
    path,
    pattern: /\.\.\.StyleSheet\.absoluteFillObject,/g,
    replacement:
      "position: 'absolute',\n    bottom: 0,\n    left: 0,\n    right: 0,\n    top: 0,",
    expectedCount,
  });
}

replaceExactly({
  path: 'src/app/login.tsx',
  pattern:
    /\n\s*backgroundColor=\{\s*\n\s*AUTH_HERO_BACKGROUND\s*\n\s*\}/g,
  replacement: '',
  expectedCount: 1,
});

replaceExactly({
  path: 'src/services/push-notifications-service.ts',
  pattern:
    /permissionStatus !==\s*Notifications\.PermissionStatus\.GRANTED/g,
  replacement:
    "String(permissionStatus).toLowerCase() !== 'granted'",
  expectedCount: 2,
});

console.log('Applied React Native 0.86 / Expo SDK 57 compatibility updates.');
