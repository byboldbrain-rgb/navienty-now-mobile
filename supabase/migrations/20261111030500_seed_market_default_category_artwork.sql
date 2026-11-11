-- Use Navienty Now's delivery bag illustration outside the main Home category rail.
-- The existing placement='home' image stays untouched.
INSERT INTO now.service_category_images (
  category_key, placement, slot, image_url, sort_order, is_active
)
SELECT
  'supermarket', 'default', 'primary',
  'https://thordzscvetvuqofbbei.supabase.co/storage/v1/object/public/rebranding/dd/Navienty%20Now%20Delivery%20Bag%20Design.png',
  0, true
WHERE NOT EXISTS (
  SELECT 1 FROM now.service_category_images
  WHERE category_key = 'supermarket'
    AND placement = 'default'
    AND slot = 'primary'
);
