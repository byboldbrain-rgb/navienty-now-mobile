# Navienty Now App Store Connect metadata

This is the prepared Arabic (`ar`) metadata and submission checklist for the
first iPhone release. Values marked **BLOCKED** need production or legal input
before they can be entered in App Store Connect.

## Product page copy

| Field | Prepared value | Limit check |
| --- | --- | --- |
| Name | `Navienty Now` | 12 / 30 characters |
| Subtitle | `كل احتياجاتك أقرب` | 17 / 30 characters |
| Promotional text | `اطلب احتياجاتك اليومية بسهولة، وتابع حالة طلبك من التأكيد حتى التوصيل. تصفح المتاجر المتاحة في منطقتك واحفظ عناوينك لطلب أسرع.` | 126 / 170 characters |
| Keywords | `توصيل,طلبات,مطاعم,سوبرماركت,متاجر,خدمات` | 73 / 100 UTF-8 bytes |
| Primary category | Food & Drink | Confirm at submission |
| Secondary category | Lifestyle | Confirm at submission |

### Description

```text
Navienty Now يجمع احتياجاتك اليومية في تجربة عربية سهلة وسريعة.

تصفح المطاعم والسوبرماركت والمتاجر والخدمات المتاحة في منطقتك، أضف المنتجات إلى السلة، حدّد عنوان التوصيل، ثم أكّد الطلب من داخل التطبيق. يمكنك متابعة حالة الطلب أو الحجز وتلقي إشعارات بالتحديثات المهمة.

أهم المزايا:
• تصفح المتاجر والمنتجات حسب الفئة
• سلة منفصلة لكل متجر
• تحديد عنوان التوصيل يدويًا أو باستخدام موقعك بعد موافقتك
• تأكيد الطلب أو حجز الخدمة من داخل التطبيق
• متابعة الحالة والإشعارات
• إدارة الحساب والعناوين وطلب حذف الحساب والبيانات
• تسجيل الدخول برقم الهاتف أو Apple أو Google أو Facebook، مع إمكانية التصفح كضيف

تعتمد المتاجر والخدمات والتغطية وطرق الدفع على المنطقة والتوافر. قد يتواصل فريق Navienty Now معك لتأكيد التفاصيل. واتساب قناة دعم اختيارية وليس مطلوبًا لإكمال الطلب داخل التطبيق.
```

Do not mention pharmacy in the metadata unless the Organization/legal-service
path is approved and pharmacy remains genuinely available in the submitted
binary and production backend. If the Individual first-release path is chosen,
the pharmacy, prescription, and regulated-product flows must be removed from
the real public release before using this description.

### First-version release text

```text
أول إصدار من Navienty Now لطلب احتياجاتك ومتابعة حالة الطلبات والخدمات من مكان واحد.
```

App Store Connect may not request “What's New” for version 1.0. Keep this copy
for the first update if that field is unavailable.

## URLs and ownership

These fields are **BLOCKED** until the final publisher identity and live HTTPS
pages are supplied:

| Field | Required production value |
| --- | --- |
| Privacy Policy URL | Public page identifying the real data controller, collected data, purposes, processors, retention, deletion, and contact method |
| Support URL | Public support page with a working email or phone number |
| Marketing URL | Optional public Navienty product page |
| Terms URL | Not a product-page field, but required by the app's Account screen |
| Copyright | Year plus the actual person or legal entity that owns the app/content |
| Seller | Individual Account Holder's legal name, or verified Organization legal name after conversion |

The Privacy Policy and Terms URLs also need to be saved in the production
Supabase `app_settings` row returned by `get_app_bootstrap`.

## App Privacy answers to verify

This is a conservative inventory from the current source. Verify it against
the deployed backend and every enabled SDK before submitting.

| Apple data type | Current use | Linked to identity | Tracking |
| --- | --- | --- | --- |
| Name | Checkout, bookings, account/provider profile | Yes | No |
| Phone number | OTP, checkout, support/operations | Yes | No |
| Email address | Social login/provider relay email | Yes | No |
| Physical address | Delivery and service fulfillment | Yes | No |
| Precise location | Optional foreground address selection/delivery coordinates | Yes when saved with an order/address | No |
| Purchase history | Orders, bookings, payment status | Yes | No |
| User ID | Supabase Auth ownership and account operations | Yes | No |
| Device ID | Push token/subscription | Yes | No |
| Photos or videos / other user content | Prescription and payment-proof uploads | Yes | No |
| Health | Prescription content when pharmacy is included | Yes | No |
| Other financial info | Payment-proof content when uploaded | Yes | No |
| Other diagnostic data | Backend diagnostic/error details, if enabled in production | Verify | No |

Do not declare that data is collected if the corresponding production feature
is removed, and do not omit a type merely because it is encrypted or stored in
a private bucket. The app currently contains no advertising or cross-app
tracking SDK in `package.json`; re-check the final lockfile and binary.

## Content rights

The current product model can display merchant names, menus/catalogs, logos,
product images, and payment-method branding. App Store Connect's Content
Rights confirmation must be truthful.

Before submission, either:

1. retain written permission/licenses covering every protected third-party
   asset and be able to provide them to Apple; or
2. publish only Navienty-owned, generic, or otherwise lawfully licensed
   content that does not imply an unauthorized merchant partnership.

Buying from a merchant as an ordinary customer does not by itself provide
publication, trademark, menu, logo, or image rights.

## Age rating and regulated content

Complete the current App Store Connect age-rating questionnaire from the final
production scope. Do not guess the rating in advance. Pharmacy, prescriptions,
medicines, health information, age-restricted products, or medical claims must
be disclosed exactly as shipped.

The app must follow one real release path:

- Organization/legal entity with the required pharmacy/business authority and
  the regulated flow disclosed to review; or
- Individual release with pharmacy/prescription functionality genuinely
  removed from the binary, backend exposure, metadata, screenshots, and public
  customer experience.

## Screenshots

Create screenshots from the exact production TestFlight build with fictional
customer data. Do not use real names, phone numbers, addresses, prescriptions,
payment proofs, or order tokens.

Minimum prepared story:

1. Home and available categories.
2. Store/catalog browsing.
3. Cart and address selection.
4. In-app order confirmation.
5. Order status tracking.
6. Account, privacy links, and deletion control.

Upload only the iPhone device sizes App Store Connect requests for this build.
Tablet support is disabled for version 1.0, so do not upload iPad screenshots.
Screenshots must not show unlicensed merchant/payment branding.

## App Review contact and notes

The following are **BLOCKED** until production access is available:

- review contact name, email, and phone;
- a stable reviewer account if linked login is required;
- a review service area/address;
- a test merchant/item and non-operational payment/fulfillment path;
- final pharmacy scope and any license/documentation;
- support availability during the review window.

Prepared review notes:

```text
Navienty Now is an Arabic iPhone app. Browsing does not require a permanent account; the app creates an anonymous customer session so cart, order ownership, and account deletion remain private.

Review path:
1. [SELECT THE PROVIDED REVIEW AREA/ADDRESS].
2. Open [TEST CATEGORY] and [TEST MERCHANT].
3. Add [TEST ITEM] to the cart.
4. Use [NON-OPERATIONAL REVIEW PAYMENT METHOD] and confirm the order inside the app.
5. Open Orders to view its status. This review order will not trigger real fulfillment or charge the reviewer.

WhatsApp is an optional support channel. It is not required to submit an order or service booking.

Location permission is foreground-only and optional. It is used to help select a delivery address; the reviewer can enter an address manually instead.

Account deletion is available from Account > Delete account and data for both anonymous and linked accounts. The screen shows the request status and target completion date.

Native Sign in with Apple is available on iOS. Google and Facebook are also offered. [ADD LINKED TEST ACCOUNT INSTRUCTIONS IF REQUIRED.]

[IF PHARMACY IS INCLUDED: explain prescription review, licensed operator, regulated-product controls, geographic availability, and provide requested authorization. Otherwise remove this paragraph and ensure pharmacy is genuinely absent from the public release.]
```

Replace every bracketed placeholder before submission. Keep the review backend,
legal pages, and support contact live until the version is approved.

## Final App Store Connect sequence

1. Accept all current Apple agreements and complete required tax/banking data.
2. Create the `com.navienty.now` app record and copy its numeric Apple ID.
3. Add that ID to `submit.production.ios.ascAppId` in `eas.json`.
4. Fill the Arabic metadata and live URLs.
5. Answer Content Rights, Age Rating, App Privacy, encryption, and export
   compliance truthfully.
6. Upload the production build and wait for processing.
7. Test that exact build through TestFlight on a physical iPhone.
8. Upload accurate screenshots and add review contact/notes.
9. Select the tested build, verify every warning, and submit for review.
