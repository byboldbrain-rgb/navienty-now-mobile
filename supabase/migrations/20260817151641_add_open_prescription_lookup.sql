create or replace function now.get_my_open_prescription_submission(
  p_store_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission now.prescription_submissions%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select s.*
    into v_submission
    from now.prescription_submissions s
   where s.user_id = v_user_id
     and s.store_id = p_store_id
     and s.order_id is null
     and s.status in ('draft', 'submitted')
   order by s.submitted_at desc nulls last, s.created_at desc
   limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_submission.id,
    'store_id', v_submission.store_id,
    'order_id', v_submission.order_id,
    'status', v_submission.status,
    'bucket', v_submission.storage_bucket,
    'path', v_submission.storage_path,
    'review_note', v_submission.review_note,
    'created_at', v_submission.created_at,
    'submitted_at', v_submission.submitted_at,
    'attached_at', v_submission.attached_at,
    'reviewed_at', v_submission.reviewed_at
  );
end;
$$;

revoke all on function now.get_my_open_prescription_submission(uuid) from public, anon;
grant execute on function now.get_my_open_prescription_submission(uuid) to authenticated;
