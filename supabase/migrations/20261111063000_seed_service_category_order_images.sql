-- Seed independent artwork for each top-level service category on the
-- Orders screen and Home's "اطلب تاني" rail.
--
-- Preserve the market's already-configured delivery-bag images, and preserve
-- Home's existing tile imagery. Administrators can edit any placement's URLs
-- independently after this migration.
WITH home_image AS (
  SELECT DISTINCT ON (category_key)
    category_key,
    image_url
  FROM now.service_category_images
  WHERE placement = 'home'
    AND slot = 'primary'
    AND is_active = true
    AND category_key IN (
      'restaurants', 'supermarket', 'bookstore',
      'personal-care', 'request-anything'
    )
  ORDER BY category_key, sort_order ASC, id ASC
)
INSERT INTO now.service_category_images (
  category_key, placement, slot, image_url, sort_order, is_active
)
SELECT home_image.category_key, places.placement, 'primary',
       home_image.image_url, 0, true
FROM home_image
CROSS JOIN (VALUES ('orders'), ('home/reorder')) AS places(placement)
WHERE NOT EXISTS (
  SELECT 1
  FROM now.service_category_images AS existing
  WHERE existing.category_key = home_image.category_key
    AND existing.placement = places.placement
    AND existing.slot = 'primary'
);
