-- Dedicated top-level category artwork for order tracking/status.
-- Seed from each category's active Orders image without changing existing
-- Home, Orders, or repeat-order artwork. Future status edits stay isolated.
WITH preferred_orders_image AS (
  SELECT DISTINCT ON (category_key)
    category_key, image_url
  FROM now.service_category_images
  WHERE placement = 'orders'
    AND slot = 'primary'
    AND is_active = true
    AND category_key IN (
      'restaurants', 'supermarket', 'bookstore',
      'personal-care', 'request-anything'
    )
  ORDER BY category_key, sort_order, id
)
INSERT INTO now.service_category_images (
  category_key, placement, slot, image_url, sort_order, is_active
)
SELECT src.category_key, 'order-status', 'primary', src.image_url, 0, true
FROM preferred_orders_image AS src
WHERE NOT EXISTS (
  SELECT 1 FROM now.service_category_images AS dst
  WHERE dst.category_key = src.category_key
    AND dst.placement = 'order-status'
    AND dst.slot = 'primary'
);
