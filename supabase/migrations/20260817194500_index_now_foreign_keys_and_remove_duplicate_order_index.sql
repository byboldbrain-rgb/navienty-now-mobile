-- Applied to production on 2026-08-17 via migration
-- `index_now_foreign_keys_and_remove_duplicate_order_index_p1`.

create index if not exists account_deletion_requests_processing_started_by_idx
  on now.account_deletion_requests (processing_started_by_user_id);
create index if not exists admin_members_created_by_idx
  on now.admin_members (created_by);
create index if not exists app_settings_default_city_idx
  on now.app_settings (default_city_id);
create index if not exists app_settings_default_service_area_idx
  on now.app_settings (default_service_area_id);
create index if not exists catalog_categories_parent_store_idx
  on now.catalog_categories (parent_id, store_id);
create index if not exists customer_notification_outbox_user_idx
  on now.customer_notification_outbox (user_id);
create index if not exists customer_notification_tickets_outbox_idx
  on now.customer_notification_tickets (outbox_id);
create index if not exists customer_notification_tickets_push_subscription_idx
  on now.customer_notification_tickets (push_subscription_id);
create index if not exists home_banner_images_banner_idx
  on now.home_banner_images (banner_id);
create index if not exists order_items_product_idx
  on now.order_items (product_id);
create index if not exists order_items_product_variant_idx
  on now.order_items (product_variant_id);
create index if not exists order_payment_proofs_payment_method_idx
  on now.order_payment_proofs (payment_method_id);
create index if not exists order_payment_proofs_reviewed_by_idx
  on now.order_payment_proofs (reviewed_by_user_id);
create index if not exists order_status_history_changed_by_idx
  on now.order_status_history (changed_by_user_id);
create index if not exists orders_age_verified_by_idx
  on now.orders (age_verified_by_user_id);
create index if not exists orders_payment_method_idx
  on now.orders (payment_method_id);
create index if not exists orders_payment_proof_idx
  on now.orders (payment_proof_id);
create index if not exists orders_prescription_submission_idx
  on now.orders (prescription_submission_id);
create index if not exists orders_service_area_idx
  on now.orders (service_area_id);
create index if not exists payment_method_accounts_payment_method_idx
  on now.payment_method_accounts (payment_method_id);
create index if not exists prescription_submissions_reviewed_by_idx
  on now.prescription_submissions (reviewed_by_user_id);
create index if not exists prescription_submissions_store_idx
  on now.prescription_submissions (store_id);
create index if not exists products_catalog_category_store_idx
  on now.products (catalog_category_id, store_id);
create index if not exists service_booking_payment_proofs_payment_method_idx
  on now.service_booking_payment_proofs (payment_method_id);
create index if not exists service_booking_payment_proofs_reviewed_by_idx
  on now.service_booking_payment_proofs (reviewed_by_user_id);

drop index if exists now.now_orders_user_created_idx;
