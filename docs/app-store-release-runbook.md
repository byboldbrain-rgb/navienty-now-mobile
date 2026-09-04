# Navienty Now App Store release runbook

This runbook covers the remaining operational work after the mobile release
branch is merged. It deliberately keeps App Review behavior identical to the
real customer experience. Never commit credentials or create review-only
behavior that changes the public product after approval.

## 0. Access prerequisites

Use invitations, connected sessions, or the secret stores provided by the
service. Do not send passwords, two-factor codes, `.p8` files, service-role
keys, certificates, or Expo tokens in chat, issues, commits, or pull requests.

The release operator needs:

- access to the Expo account `navientynows-team` and EAS project
  `32043d31-505f-44c7-8496-9bf8c32ba1e1`;
- access to the production Navienty Supabase project containing the `now`
  schema;
- the Apple Account Holder present for agreements, two-factor prompts, and
  first-time signing setup;
- App Store Connect access to create and edit the app record, upload builds,
  manage TestFlight, and submit the version;
- access to the Google Cloud project that owns the iOS Maps key if the key is
  not already stored in the EAS production environment;
- access to the public website or hosting project for Privacy Policy, Terms,
  and Support pages.

Before changing anything, confirm the Expo project, Supabase project ref,
Apple Team ID, App Store Connect app ID, and bundle identifier all belong to
the same production release. The bundle identifier is `com.navienty.now`.

## 1. Release gates

Run from the repository root with Node 22.13 or newer:

```bash
npm ci
node scripts/validate-image-assets.mjs
npm run validate:v1-scope
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

Version 1 has no pharmacy or prescription customer flow. In the production
project, confirm the related store category and stores are inactive, related
banners are inactive, the prescription gate is disabled, and customer roles
cannot execute prescription RPCs. Historical tables may remain dormant for a
future legally approved release; do not destructively drop them or rewrite
already-applied migration history. The mobile release gate must pass even when
the backend still contains dormant historical schema.

## 3. Account deletion operations

The app supports deletion requests for linked and anonymous accounts and shows
the target completion date. Operations must process each request by that date.

For every request:

1. Start processing with the existing admin RPC.
2. Review the deletion preflight and Navienty Now scrub plan.
3. Resolve active orders or bookings before removing customer ownership.
4. Delete private payment-proof objects and any historical prescription
   objects left from pre-v1 testing that are not subject to an approved legal
   hold.
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
- payment proof uploads;
- account identifiers and push tokens;
- diagnostic error details sent to the backend.

Do not claim tracking or advertising if neither is present, and do not omit
sensitive uploads merely because their Storage buckets are private.

Use [`app-store-connect-metadata.md`](app-store-connect-metadata.md) to fill
the version record. Do not submit placeholder URLs or screenshots. The Support
URL must show real contact information, and the Privacy Policy must identify
the actual publisher/data controller and explain deletion and retention.

The app contains merchant/catalog and payment-method content. Before answering
App Store Connect's Content Rights question, keep written authorization for
every protected third-party name, logo, image, menu, catalog, and other asset,
or replace it with content Navienty owns and can lawfully publish. Ordering
from a merchant as an ordinary customer is not itself authorization to display
their protected material or imply a partnership.

## 5. Individual Apple Developer account scope

The current Apple membership is Individual. The approved version 1 product
scope permanently excludes pharmacy, prescription, medicine-ordering, and
medical-service functionality from the real public release. This is enforced
in client routes, catalog and banner filtering, cart hydration, checkout, CI,
and production-backend configuration; it is not an App Review-only switch.

Do not re-enable that scope through Supabase content, a remote banner, deep
link, or over-the-air update. A future regulated release requires a separate
legal review, the necessary business authorization, and an appropriate Apple
membership decision before implementation or submission.

An Individual membership also publishes the Account Holder's personal legal
name as the App Store seller. The Navienty legal-entity name can appear as the
seller only after Apple verifies an Organization membership.

## 6. Sign in with Apple production setup

The iOS app uses Apple's native button and native Authentication Services flow.
The generated entitlement must include `com.apple.developer.applesignin`, and
the Apple App ID for `com.navienty.now` must enable Sign in with Apple.

The current app still offers Apple OAuth on non-iOS platforms. In the Supabase
Apple provider Client IDs field, put the Services ID first and include
`com.navienty.now` as another accepted client ID. Configure the Services ID
callback as:

```text
https://<production-project-ref>.supabase.co/auth/v1/callback
```

Also allow `navientynow://auth/callback` in Supabase Auth redirect URLs. Store
the Apple signing key only in the relevant secret manager. The Apple OAuth
client secret used by web/non-iOS login expires every six months, so assign an
owner and a rotation reminder.

On a physical iPhone, test first authorization, returning authorization,
Hide My Email, cancellation, anonymous-account linking, sign-out/sign-in, and
account deletion. Apple's full name is returned only on first authorization;
confirm that it is saved then. If the deletion backend does not retain a valid
Apple token for programmatic revocation, the approved deletion procedure must
also direct the user to revoke Navienty Now under Apple Account settings.

## 7. Build, TestFlight, and submission

Confirm the production EAS environment contains the Supabase publishable
configuration, restricted Google Maps iOS key, and notification credentials.
For later Android builds, store the gitignored `google-services.json` as the
EAS secret file variable `GOOGLE_SERVICES_JSON`; do not commit the file.
Create the App Store Connect app record first, copy its numeric Apple ID, and
set `submit.production.ios.ascAppId` in `eas.json` before unattended submit.

Create a production build, then upload that exact build to App Store Connect:

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

Complete export compliance, wait for App Store Connect processing, enable the
build in TestFlight, and install it on a physical iPhone. Verify launch,
foreground location, maps, all login providers, checkout, order/service
status, push, legal links, and deletion against the production backend.

Only after the TestFlight candidate passes, select that exact build on the App
Store version page and submit the version for App Review. Review notes must
explain anonymous access, how to create a non-operational review order, the
optional nature of WhatsApp, account deletion, location usage, the v1 public
scope, and any credentials needed for linked sign-in providers. State
explicitly that version 1 has no pharmacy or medical ordering flow.
Keep the backend, legal URLs, support contact, and reviewer path live throughout
review.
