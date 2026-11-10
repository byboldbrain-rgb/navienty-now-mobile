-- Admin-editable demonstration brand banners and spotlights.
-- References existing store catalogs and media; all inserts are idempotent.
WITH selections (store_id, brand_name,logo_url,bg,rank) AS (
VALUES
('67892e11-863b-4115-a56a-958a38ea61ce'::uuid,'أنكر','https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Anker_logo.svg/512px-Anker_logo.svg.png','#D9F4FB',0),
('67892e11-863b-4115-a56a-958a38ea61ce'::uuid,'Kingston','https://commons.wikimedia.org/wiki/Special:FilePath/Kingston_Technology_Corporation_logo.png','#F5E9E8',1),
('67892e11-863b-4115-a56a-958a38ea61ce'::uuid,'HP','https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/HP_logo_2012.svg/512px-HP_logo_2012.svg.png','#D8F2FF',2),
('a8f79db9-70cb-434f-a187-b66755725fc1'::uuid,'نيفيا','https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/NIVEA_logo_2021.svg/512px-NIVEA_logo_2021.svg.png','#E9F0FF',0),
('a8f79db9-70cb-434f-a187-b66755725fc1'::uuid,'دوف','https://commons.wikimedia.org/wiki/Special:FilePath/Dove_logo.png','#F7F0E1',1),
('a8f79db9-70cb-434f-a187-b66755725fc1'::uuid,'ميبلين','https://commons.wikimedia.org/wiki/Special:FilePath/Maybelline_logo.png','#FFE7EC',2)
), usable AS (
SELECT sel.*,br.id brand_id,
 (SELECT p2.image_url FROM now.products p2
  WHERE p2.store_id=sel.store_id AND p2.brand_id=br.id
    AND p2.is_active AND p2.is_available AND p2.image_url ~* '^https://'
  ORDER BY p2.sort_order,p2.id LIMIT 1) AS hero
FROM selections sel JOIN now.brands br ON br.name_ar=sel.brand_name AND br.is_active
)
INSERT INTO now.supermarket_brand_banners
(store_id,brand_id,title_ar,hero_image_url,logo_url,background_color,image_fit,sort_order,is_active,is_demo)
SELECT u.store_id,u.brand_id,u.brand_name,u.hero,u.logo_url,u.bg,'contain',u.rank,true,true
FROM usable u
WHERE u.hero IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM now.supermarket_brand_banners existing
 WHERE existing.store_id=u.store_id AND existing.brand_id=u.brand_id
);

WITH examples(store_id, banner_label, title_ar, eyebrow_ar, button_label_ar, category_key) AS (
 VALUES
 ('67892e11-863b-4115-a56a-958a38ea61ce'::uuid, 'Bookstore • Notebooks','كل اللي محتاجه للمذاكرة','مكتبة ناڤينتي','تسوق الكراسات','notebooks'),
 ('a8f79db9-70cb-434f-a187-b66755725fc1'::uuid, 'Personal Care • Face Care','روتين عناية يستاهل','عناية ناڤينتي','تسوق العناية بالوجه','face-care')
)
INSERT INTO now.supermarket_spotlight_cards
(store_id,media_type,media_url,poster_url,eyebrow_ar,title_ar,button_label_ar,category_key,is_active,is_demo)
SELECT x.store_id,'image',b.image_url,null,x.eyebrow_ar,x.title_ar,x.button_label_ar,x.category_key,true,true
FROM examples x JOIN now.home_banners b
 ON b.store_id=x.store_id AND b.admin_label=x.banner_label AND b.is_active
WHERE NOT EXISTS (SELECT 1 FROM now.supermarket_spotlight_cards existing
 WHERE existing.store_id=x.store_id AND existing.is_active);
