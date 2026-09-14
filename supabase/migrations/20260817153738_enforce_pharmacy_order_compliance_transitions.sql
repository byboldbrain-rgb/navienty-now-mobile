create or replace function now.transition_order_status(
  p_order_id uuid,
  p_new_status text,
  p_note text default null,
  p_cancellation_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_context jsonb;
  v_order now.orders%rowtype;
  v_old_status text;
  v_normalized_note text;
  v_normalized_cancellation_reason text;
  v_transition_allowed boolean := false;
begin
  v_admin_context :=
    now.assert_admin_permission(
      'manage_orders'
    );

  if p_new_status is null
     or p_new_status not in (
       'confirmed',
       'preparing',
       'out_for_delivery',
       'delivered',
       'cancelled'
     )
  then
    raise exception using
      errcode = '22023',
      message = 'invalid_admin_order_status';
  end if;

  v_normalized_note :=
    nullif(
      btrim(
        coalesce(p_note, '')
      ),
      ''
    );

  v_normalized_cancellation_reason :=
    nullif(
      btrim(
        coalesce(
          p_cancellation_reason,
          ''
        )
      ),
      ''
    );

  select order_row.*
  into v_order
  from now.orders as order_row
  where order_row.id = p_order_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'order_not_found';
  end if;

  v_old_status := v_order.status;

  if v_old_status = p_new_status then
    return now.get_admin_order(
      v_order.id
    );
  end if;

  v_transition_allowed :=
    case
      when
        v_old_status =
          'waiting_confirmation'
        and p_new_status =
          'confirmed'
      then true

      when
        v_old_status =
          'confirmed'
        and p_new_status =
          'preparing'
      then true

      when
        v_old_status =
          'preparing'
        and p_new_status =
          'out_for_delivery'
      then true

      when
        v_old_status =
          'out_for_delivery'
        and p_new_status =
          'delivered'
      then true

      when
        p_new_status = 'cancelled'
        and v_old_status in (
          'awaiting_whatsapp_send',
          'waiting_confirmation',
          'confirmed',
          'preparing',
          'out_for_delivery'
        )
      then true

      else false
    end;

  if not v_transition_allowed then
    raise exception using
      errcode = 'P0001',
      message = 'invalid_order_status_transition',
      detail = jsonb_build_object(
        'old_status', v_old_status,
        'requested_status',
          p_new_status
      )::text;
  end if;

  if p_new_status = 'confirmed'
     and v_order.prescription_required
  then
    if v_order.prescription_submission_id
       is null
    then
      raise exception using
        errcode = 'P0001',
        message = 'prescription_submission_not_attached';
    end if;

    if not exists (
      select 1
      from now.prescription_submissions as submission
      where
        submission.id =
          v_order.prescription_submission_id
        and submission.order_id =
          v_order.id
        and submission.status =
          'approved'
    )
    then
      raise exception using
        errcode = 'P0001',
        message = 'prescription_not_approved';
    end if;
  end if;

  if p_new_status = 'delivered'
     and v_order.age_verification_required
     and v_order.age_verified_at is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'age_verification_required';
  end if;

  if p_new_status = 'cancelled'
     and v_normalized_cancellation_reason
       is null
  then
    raise exception using
      errcode = '22023',
      message = 'cancellation_reason_required';
  end if;

  update now.orders
  set
    status = p_new_status,

    confirmed_at =
      case
        when p_new_status =
          'confirmed'
        then coalesce(
          confirmed_at,
          now()
        )
        else confirmed_at
      end,

    preparing_at =
      case
        when p_new_status =
          'preparing'
        then coalesce(
          preparing_at,
          now()
        )
        else preparing_at
      end,

    out_for_delivery_at =
      case
        when p_new_status =
          'out_for_delivery'
        then coalesce(
          out_for_delivery_at,
          now()
        )
        else out_for_delivery_at
      end,

    delivered_at =
      case
        when p_new_status =
          'delivered'
        then coalesce(
          delivered_at,
          now()
        )
        else delivered_at
      end,

    cancelled_at =
      case
        when p_new_status =
          'cancelled'
        then coalesce(
          cancelled_at,
          now()
        )
        else cancelled_at
      end,

    cancellation_reason =
      case
        when p_new_status =
          'cancelled'
        then
          v_normalized_cancellation_reason
        else cancellation_reason
      end

  where id = v_order.id
  returning *
  into v_order;

  insert into now.order_status_history (
    order_id,
    old_status,
    new_status,
    note,
    changed_by_type,
    changed_by_user_id,
    actor_reference
  )
  values (
    v_order.id,
    v_old_status,
    p_new_status,

    coalesce(
      v_normalized_note,

      case p_new_status
        when 'confirmed'
          then 'Order confirmed by Navienty Now operations.'
        when 'preparing'
          then 'Order preparation started.'
        when 'out_for_delivery'
          then 'Order handed to delivery.'
        when 'delivered'
          then 'Order marked as delivered.'
        when 'cancelled'
          then v_normalized_cancellation_reason
        else null
      end
    ),

    'admin',
    auth.uid(),

    concat_ws(
      ':',
      v_admin_context ->>
        'platform_role',
      v_admin_context ->>
        'now_role'
    )
  );

  return now.get_admin_order(
    v_order.id
  );
end;
$$;
