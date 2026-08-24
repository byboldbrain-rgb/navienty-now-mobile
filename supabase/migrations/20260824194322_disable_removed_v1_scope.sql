-- Production migration version: 20260824194322.
begin;

-- Version 1 is published from an Individual Apple Developer account and does
-- not expose the removed regulated ordering scope. Preserve historical rows
-- for retention/legal review, but make the customer-facing backend fail
-- closed until a future, separately approved migration intentionally restores
-- it.
update now.app_settings
   set prescription_gate_enabled = false;

update now.stores as store
   set is_active = false
 where store.category_id in (
   select category.id
     from now.store_categories as category
    where lower(trim(category.slug)) in (
      'pharmacy',
      'pharmacies',
      'drugstore',
      'drugstores',
      'medicine',
      'medicines',
      'صيدلية',
      'صيدليات'
    )
 );

update now.store_categories as category
   set is_active = false
 where lower(trim(category.slug)) in (
   'pharmacy',
   'pharmacies',
   'drugstore',
   'drugstores',
   'medicine',
   'medicines',
   'صيدلية',
   'صيدليات'
 );

update now.products as product
   set is_active = false
 where lower(product.product_type::text) in (
   'pharmacy',
   'medicine',
   'medicines'
 )
    or product.requires_prescription = true;

update now.home_banners as banner
   set is_active = false
 where banner.store_id in (
   select store.id
     from now.stores as store
     join now.store_categories as category
       on category.id = store.category_id
    where lower(trim(category.slug)) in (
      'pharmacy',
      'pharmacies',
      'drugstore',
      'drugstores',
      'medicine',
      'medicines',
      'صيدلية',
      'صيدليات'
    )
 )
    or lower(
      concat_ws(
        ' ',
        banner.placement::text,
        banner.admin_label,
        banner.image_url,
        banner.alt_text_ar,
        banner.alt_text_en,
        banner.link_url,
        banner.action_payload::text,
        banner.content::text
      )
    ) similar to '%(pharmacy|pharmacies|drugstore|drugstores|prescription|medicine|medicines)%'
    or concat_ws(
      ' ',
      banner.admin_label,
      banner.alt_text_ar,
      banner.content::text
    ) similar to '%(صيدلية|صيدليات|روشتة|روشتات|دواء|أدوية)%';

revoke execute on function now.create_prescription_submission(uuid)
  from authenticated;
revoke execute on function now.submit_prescription_submission(uuid)
  from authenticated;
revoke execute on function now.get_my_prescription_submission(uuid)
  from authenticated;
revoke execute on function now.get_my_open_prescription_submission(uuid)
  from authenticated;
revoke execute on function now.cancel_my_prescription_submission(uuid)
  from authenticated;
revoke execute on function now.attach_prescription_to_order(uuid, uuid)
  from authenticated;
revoke execute on function now.can_access_prescription_object(text, text)
  from authenticated;

drop policy if exists customer_insert_own_prescription on storage.objects;
drop policy if exists customer_select_own_prescription on storage.objects;
drop policy if exists customer_delete_own_prescription on storage.objects;

commit;
