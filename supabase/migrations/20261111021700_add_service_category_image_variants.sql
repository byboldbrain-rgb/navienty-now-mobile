-- Per-screen, per-slot images for top-level Navienty Now categories.
-- Images are administered from the Supabase dashboard (or a trusted backend).
-- The mobile app only has read access to active image variants.
CREATE TABLE IF NOT EXISTS now.service_category_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key text NOT NULL
    CHECK (category_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  placement text NOT NULL DEFAULT 'default'
    CHECK (placement ~ '^[a-z0-9]+([/_-][a-z0-9]+)*$'),
  slot text NOT NULL DEFAULT 'primary'
    CHECK (slot ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  image_url text NOT NULL
    CHECK (image_url ~* '^https?://[^[:space:]]+$'),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE now.service_category_images IS
  'Multiple editable images per top-level category, screen placement and slot.';

CREATE INDEX IF NOT EXISTS service_category_images_active_lookup_idx
  ON now.service_category_images
  (placement, category_key, slot, sort_order, id)
  WHERE is_active = true;

ALTER TABLE now.service_category_images ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE now.service_category_images
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE now.service_category_images
  TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE now.service_category_images
  TO service_role;

CREATE POLICY service_category_images_read_active
  ON now.service_category_images
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Preserve the configured Home artwork already used in production.
-- New per-screen rows override storefront_category_tiles.image_url in the app,
-- while the existing tile URL remains a backwards-compatible fallback.
WITH source AS (
  SELECT
    id,
    lower(replace(coalesce(key, ''), '_', '-')) AS tile_key,
    lower(replace(coalesce(route_slug, ''), '_', '-')) AS route_key,
    image_url,
    sort_order
  FROM now.storefront_category_tiles
  WHERE surface = 'home'
    AND is_active = true
    AND image_url ~* '^https?://[^[:space:]]+$'
), categorized AS (
  SELECT
    id,
    image_url,
    sort_order,
    CASE
      WHEN tile_key IN ('restaurants', 'restaurant', 'food')
        OR route_key IN ('restaurants', 'restaurant', 'food')
      THEN 'restaurants'
      WHEN tile_key IN ('supermarket', 'supermarkets', 'market', 'grocery')
        OR route_key IN ('supermarket', 'supermarkets', 'market', 'grocery')
      THEN 'supermarket'
      WHEN tile_key IN ('bookstore', 'bookstores', 'book-store', 'library', 'books', 'stationery')
        OR route_key IN ('bookstore', 'bookstores', 'book-store', 'library', 'books', 'stationery')
      THEN 'bookstore'
      WHEN tile_key IN ('personal-care', 'personalcare', 'beauty', 'beauty-care', 'health-beauty', 'care')
        OR route_key IN ('personal-care', 'personalcare', 'beauty', 'beauty-care', 'health-beauty', 'care')
      THEN 'personal-care'
      WHEN tile_key IN ('request-anything', 'anything', 'special-request', 'other')
        OR route_key IN ('request-anything', 'anything', 'special-request', 'other')
      THEN 'request-anything'
      ELSE NULL
    END AS category_key
  FROM source
), preferred AS (
  SELECT DISTINCT ON (category_key)
    category_key,
    image_url
  FROM categorized
  WHERE category_key IS NOT NULL
  ORDER BY category_key, sort_order ASC NULLS LAST, id ASC
)
INSERT INTO now.service_category_images (
  category_key, placement, slot, image_url, sort_order, is_active
)
SELECT category_key, 'home', 'primary', image_url, 0, true
FROM preferred
WHERE NOT EXISTS (
  SELECT 1
  FROM now.service_category_images existing
  WHERE existing.category_key = preferred.category_key
    AND existing.placement = 'home'
    AND existing.slot = 'primary'
    AND existing.image_url = preferred.image_url
);
