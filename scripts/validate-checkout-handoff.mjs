import { readFileSync } from 'node:fs';

const checkout = readFileSync('src/app/checkout.tsx', 'utf8');
const confirmation = readFileSync('src/app/order-confirmation.tsx', 'utf8');

const failures = [];

if (checkout.includes('openOrderInWhatsApp(')) {
  failures.push('checkout must not open WhatsApp directly');
}

if (checkout.includes('Linking.openURL(')) {
  failures.push('checkout must not call Linking.openURL directly');
}

if (!checkout.includes("router.replace(\n        '/order-confirmation',\n      );")) {
  failures.push('checkout must route to /order-confirmation after creating the pending order');
}

if (!confirmation.includes('openOrderInWhatsApp(')) {
  failures.push('order-confirmation must own the explicit WhatsApp handoff');
}

if (!confirmation.includes('متابعة عبر واتساب')) {
  failures.push('order-confirmation must expose an explicit WhatsApp action');
}

if (failures.length > 0) {
  console.error('Checkout handoff validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Checkout handoff validation passed.');
