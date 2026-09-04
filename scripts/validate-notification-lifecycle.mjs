import { readFileSync } from 'node:fs';

const rootLayout = readFileSync(
  'src/app/_layout.tsx',
  'utf8',
);
const orderRealtimeBridge = readFileSync(
  'src/components/order-realtime-bridge.tsx',
  'utf8',
);
const appJson = JSON.parse(
  readFileSync('app.json', 'utf8'),
);

const failures = [];

const rootMountCount =
  rootLayout.match(/<PushNotificationsBridge\b/g)
    ?.length ?? 0;

if (rootMountCount !== 1) {
  failures.push(
    `root layout must mount PushNotificationsBridge exactly once (found ${rootMountCount})`,
  );
}

if (
  orderRealtimeBridge.includes(
    'PushNotificationsBridge',
  )
) {
  failures.push(
    'order realtime bridge must not mount the notification bridge',
  );
}

const notificationPlugin =
  appJson.expo.plugins.find(
    (plugin) =>
      Array.isArray(plugin) &&
      plugin[0] === 'expo-notifications',
  );

if (!notificationPlugin) {
  failures.push(
    'expo-notifications config plugin is required',
  );
} else if (
  notificationPlugin[1]
    ?.enableBackgroundRemoteNotifications !== false
) {
  failures.push(
    'background remote notifications must remain disabled unless the app implements a background handler',
  );
}

if (failures.length > 0) {
  console.error(
    'Notification lifecycle validation failed:',
  );

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log(
  'Notification lifecycle validation passed.',
);
