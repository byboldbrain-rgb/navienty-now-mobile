-- Move our previously seeded default supermarket bag image to Orders.
-- Never modify the existing placement='home' tile image.
INSERT INTO now.service_category_images (
  category_key, placement, slot, image_url, sort_order, is_active
)
SELECT 'supermarket', 'orders', 'primary', source.image_url, 0, true
FROM now.service_category_images AS source
WHERE source.category_key = 'supermarket'
  AND source.placement = 'default'
  AND source.slot = 'primary'
  AND source.image_url = 'https://thordzscvetvuqofbbei.supabase.co/storage/v1/object/public/rebranding/dd/Navienty%20Now%20Delivery%20Bag%20Design.png'
  AND NOT EXISTS (
    SELECT 1 FROM now.service_category_images AS existing
    WHERE existing.category_key = 'supermarket'
      AND existing.placement = 'orders'
      AND existing.slot = 'primary'
  )
LIMIT 1;

DELETE FROM now.service_category_images
WHERE category_key = 'supermarket'
  AND placement = 'default'
  AND slot = 'primary'
  AND image_url = 'https://thordzscvetvuqofbbei.supabase.co/storage/v1/object/public/rebranding/dd/Navienty%20Now%20Delivery%20Bag%20Design.png';
