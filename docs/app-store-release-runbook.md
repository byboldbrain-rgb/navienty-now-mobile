# Navienty Now App Store release runbook

This runbook covers the remaining operational work after the mobile release
branch is merged. It deliberately keeps App Review behavior identical to the
real customer experience.

## 1. Release gates

Run from the repository root with Node 22.13 or newer:

```bash
npm ci
node scripts/validate-image-assets.mjs
node scripts/validate-release-config.mjs
node scripts/validate-checkout-handoff.mjs
node scripts/validate-native-maps-config.mjs
node scripts/validate-notification-lifecycle.mjs
node scripts/validate-app-store-account-controls.mjs
node scripts/validate-social-auth-parity.mjs
npm run audit:prod
npm test
npx tsc --noEmit
npm run lint
```

Do not create an App Store archive unless every command exits successfully.

## 2. Supabase rollout order

Deploy database migrations before distributing the matching mobile build. In
particular, the app requires these owner-scoped, idempotent RPCs:

- `now.submit_order_for_confirmation(uuid)`
- `now.submit_service_booking_for_confirmation(uuid)`

After migration deployment, run Supabase security and performance advisors,
then smoke-test one store order and one service booking with an authenticated
test user. Confirm both records enter `waiting_confirmation` without opening
WhatsApp and without populating WhatsApp-opened/sent timestamps.

## 3. Account deletion operations

The app supports deletion requests for linked and anonymous accounts and shows
the target completion date. Operations must process each request by that date.

For every request:

1. Start processing with the existing admin RPC.
2. Review the deletion preflight and Navienty Now scrub plan.
3. Resolve active orders or bookings before removing customer ownership.
4. Delete private prescription and payment-proof Storage objects that are not
   subject to an approved legal hold.
5. Remove or anonymize personal fields under the approved Egyptian legal and
   accounting retention schedule.
6. Remove push subscriptions and other device identifiers.
7. Delete the Supabase Auth user with a trusted server using the service-role
   Admin API. Never expose the service-role key in the mobile app.
8. If the user signed in with Apple, follow the approved provider-token
   revocation procedure when the required provider token is available.
9. Mark the deletion request complete only after its `user_id` has been
   detached by the Auth deletion.

The repository intentionally does not automate destructive scrubbing until a
written retention policy is approved. A manual request queue is acceptable
only if the team consistently completes it within the date shown to users.

## 4. Privacy and App Store Connect

Before submission, populate valid HTTPS values for `privacy_url` and
`terms_url` in the Supabase app settings returned by `get_app_bootstrap`.
Verify both links from Account on a physical iPhone.

Enable and test Google, Facebook, and Apple in the production Supabase Auth
project. Add `navientynow://auth/callback` to the allowed redirect URLs and
verify that the Apple provider returns to the production app. If App Review
needs a linked account, provide a working test account and clear instructions.

Complete App Privacy using the actual production data flow, including:

- name, phone number, and delivery address;
- precise delivery location;
- order and service-booking history;
- prescriptions and payment proof uploads;
- account identifiers and push tokens;
- diagnostic error details sent to the backend.

Do not claim tracking or advertising if neither is present, and do not omit
sensitive uploads merely because their Storage buckets are private.

## 5. Individual Apple Developer account decision

The current Apple membership is Individual. Navienty Now includes pharmacy and
prescription workflows, which are regulated and process sensitive information.
Apple can require this kind of service to be submitted by the legal entity that
provides it.

Choose and document one legitimate release path before review:

- convert the Apple Developer membership to an Organization/legal-entity
  account with the required pharmacy/business authorization; or
- remove the regulated pharmacy/prescription service from the public first
  release as a real product-scope decision.

Do not hide pharmacy only for App Review or remotely re-enable it after
approval.

## 6. Build and submission

Confirm the production EAS environment contains the Supabase publishable
configuration, restricted Google Maps iOS key, and notification credentials.
Then:

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

Use a physical-device smoke test or TestFlight before submission. Review notes
must explain anonymous access, how to create a test order, the optional nature
of WhatsApp, account deletion, location usage, prescription review, and any
test credentials needed for linked sign-in providers.
