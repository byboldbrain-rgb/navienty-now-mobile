alter function now.prevent_catalog_category_cycle() set search_path = '';
alter function now.validate_home_banner_product_store() set search_path = '';

revoke all on function now.prevent_catalog_category_cycle() from public;
revoke all on function now.prevent_catalog_category_cycle() from anon;
revoke all on function now.prevent_catalog_category_cycle() from authenticated;

revoke all on function now.validate_home_banner_product_store() from public;
revoke all on function now.validate_home_banner_product_store() from anon;
revoke all on function now.validate_home_banner_product_store() from authenticated;
