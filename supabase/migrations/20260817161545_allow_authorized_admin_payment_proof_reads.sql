create or replace function now.can_admin_read_order_payment_proof_object(
  p_object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin_context jsonb;
  v_proof_id uuid;
  v_proof now.order_payment_proofs%rowtype;
  v_expected_path text;
begin
  begin
    v_admin_context := now.assert_admin_permission('view_orders');
  exception
    when others then
      return false;
  end;

  if v_admin_context is null then
    return false;
  end if;

  begin
    v_proof_id := split_part(coalesce(p_object_name, ''), '/', 2)::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  select proof.*
    into v_proof
    from now.order_payment_proofs proof
   where proof.id = v_proof_id;

  if not found then
    return false;
  end if;

  v_expected_path :=
    v_proof.user_id::text || '/' || v_proof.id::text || '/payment-proof';

  return p_object_name = v_expected_path;
end;
$$;

revoke all on function now.can_admin_read_order_payment_proof_object(text) from public, anon;
grant execute on function now.can_admin_read_order_payment_proof_object(text) to authenticated;

drop policy if exists authorized_admin_select_order_payment_proof on storage.objects;
create policy authorized_admin_select_order_payment_proof
on storage.objects
for select
to authenticated
using (
  bucket_id = 'now-payment-proofs'
  and now.can_admin_read_order_payment_proof_object(name)
);
