begin;

create index if not exists printing_services_category_store_idx
  on now.printing_services (catalog_category_id, store_id);

create index if not exists printing_rates_color_service_idx
  on now.printing_rates (color_option_id, printing_service_id);

create index if not exists printing_rates_side_service_idx
  on now.printing_rates (side_option_id, printing_service_id);

commit;
