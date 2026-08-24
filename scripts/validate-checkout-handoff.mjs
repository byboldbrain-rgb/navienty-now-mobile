import { readFileSync } from 'node:fs';

const checkout = readFileSync('src/app/checkout.tsx', 'utf8');
const confirmation = readFileSync('src/app/order-confirmation.tsx', 'utf8');
const serviceCheckout = readFileSync(
  'src/components/service/service-package-checkout.tsx',
  'utf8',
);
const inAppSubmissionMigration = readFileSync(
  'supabase/migrations/20260824194255_add_in_app_order_submission.sql',
  'utf8',
);

const failures = [];

if (checkout.includes('openOrderInWhatsApp(')) {
  failures.push('checkout must not open WhatsApp directly');
}

if (checkout.includes('Linking.openURL(')) {
  failures.push('checkout must not call Linking.openURL directly');
}

if (!checkout.includes('submitOrderForConfirmation(')) {
  failures.push('checkout must submit the saved order inside the app');
}

if (!checkout.includes("pathname: '/order-success'")) {
  failures.push('checkout must route to /order-success after in-app submission');
}

if (!confirmation.includes('submitOrderForConfirmation(')) {
  failures.push('order-confirmation must expose an in-app retry action');
}

if (!confirmation.includes('تأكيد الطلب داخل التطبيق')) {
  failures.push('order-confirmation must label the in-app confirmation action');
}

if (confirmation.includes('AppState')) {
  failures.push('order-confirmation must not infer delivery from app foreground state');
}

if (!confirmation.includes('متابعة عبر واتساب (اختياري)')) {
  failures.push('WhatsApp must be visibly optional when offered');
}

if (serviceCheckout.includes('Linking.openURL(')) {
  failures.push('service checkout must not open another app to complete a booking');
}

if (!serviceCheckout.includes('submitServiceBookingForConfirmation(')) {
  failures.push('service checkout must submit the booking inside the app');
}

if (!inAppSubmissionMigration.includes('submit_order_for_confirmation')) {
  failures.push('database migration must provide in-app order submission');
}

if (!inAppSubmissionMigration.includes('submit_service_booking_for_confirmation')) {
  failures.push('database migration must provide in-app service booking submission');
}

if (failures.length > 0) {
  console.error('Checkout handoff validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Checkout handoff validation passed.');
