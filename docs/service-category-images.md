# Top-level category artwork in Navienty Now

The app reads category imagery from now.service_category_images. A category
can have unlimited image variants, with separate images for each screen.

Supported canonical category_key values:
- restaurants
- supermarket
- bookstore
- personal-care
- request-anything

placement is the page context (home, login, default, category/supermarket,
or another stable screen identifier). slot is the artwork position on that
page (primary, hero, icon, etc.). sort_order determines the display order.

The Home cards in src/app/index.tsx use placement = home and slot = primary.
The lowest sort_order active URL is displayed. If no home image exists,
the app tries the default placement and then the current legacy/tile artwork.
Other screens can opt in through the useServiceCategoryImages hook and the
getServiceCategoryImageUrl(s) helpers with their own placement/slot.
They are not automatically modified by the Home integration.

Admin-only examples for the Supabase SQL Editor:

-- A restaurant image only for Home
INSERT INTO now.service_category_images
  (category_key, placement, slot, image_url, sort_order)
VALUES
  ('restaurants', 'home', 'primary', 'https://YOUR-IMAGE-URL', 0);

-- An independently managed restaurant image for another page
INSERT INTO now.service_category_images
  (category_key, placement, slot, image_url, sort_order)
VALUES
  ('restaurants', 'login', 'primary', 'https://YOUR-OTHER-IMAGE-URL', 0);

-- For multiple images on one placement, insert more rows with sort_order 1, 2, etc.
-- To change a specific image use its row id, not a broad category update:
UPDATE now.service_category_images
SET image_url = 'https://YOUR-NEW-IMAGE-URL', updated_at = now()
WHERE id = 'THE-IMAGE-UUID';

-- Hide an image without deleting it:
UPDATE now.service_category_images
SET is_active = false, updated_at = now()
WHERE id = 'THE-IMAGE-UUID';

-- Verify what the customer can see:
SELECT category_key, placement, slot, image_url, sort_order
FROM now.service_category_images
WHERE is_active
ORDER BY category_key, placement, slot, sort_order, id;

Images may live in the existing public now-media Supabase Storage bucket.
Only trusted admins/service_role can write table records; anon and
authenticated clients can SELECT active entries via RLS.
