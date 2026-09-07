import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(
  readFileSync(
    new URL('../package.json', import.meta.url),
    'utf8',
  ),
);

test('iOS does not link the unused Expo UI module that imports WidgetKit', () => {
  assert.equal(
    Object.hasOwn(
      packageJson.dependencies,
      '@expo/ui',
    ),
    false,
  );

  assert.equal(
    packageJson.expo?.autolinking?.ios?.exclude?.includes(
      '@expo/ui',
    ),
    true,
  );
});
