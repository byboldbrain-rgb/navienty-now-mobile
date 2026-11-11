-- Artwork for the Navienty Market card inside Home > "اطلب تاني".
-- This is separate from the main Home category tile ('home') and Orders ('orders').
-- Seed from the active Orders image but allow future independent edits.
INSERT INTO now.service_category_images
  (category_key, placement, slot, image_url, sort_order, is_active)
SELECT
  'supermarket', 'home/reorder', 'primary',
  source.image_url, 0, true
FROM now.service_category_images AS source
WHERE source.category_key = 'supermarket'
  AND source.placement = 'orders'
  AND source.slot = 'primary'
  AND source.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM now.service_category_images AS existing
    WHERE existing.category_key = 'supermarket'
      AND existing.placement = 'home/reorder'
      AND existing.slot = 'primary'
  )
ORDER BY source.sort_order, source.id
LIMIT 1;
