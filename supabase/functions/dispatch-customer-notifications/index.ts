import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.0";

type OutboxRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  attempt_count: number;
};

type PushSubscription = {
  id: string;
  expo_push_token: string;
};

type ExpoTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: {
    error?: string;
    [key: string]: unknown;
  };
};

type ExpoReceipt = {
  status?: string;
  message?: string;
  details?: {
    error?: string;
    [key: string]: unknown;
  };
};

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const BATCH_SIZE = 25;
const RECEIPT_BATCH_SIZE = 500;

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase Edge Function environment configuration.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function expoHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function completeOutbox(
  supabase: ReturnType<typeof getAdminClient>,
  outboxId: string,
  success: boolean,
  errorMessage?: string,
) {
  const { error } = await supabase
    .schema("now")
    .rpc("complete_customer_notification", {
      p_outbox_id: outboxId,
      p_success: success,
      p_error: errorMessage ?? null,
    });

  if (error) {
    throw error;
  }
}

async function disableSubscription(
  supabase: ReturnType<typeof getAdminClient>,
  subscriptionId: string,
) {
  const { error } = await supabase
    .schema("now")
    .from("customer_push_subscriptions")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) {
    throw error;
  }
}

async function dispatchOutboxRow(
  supabase: ReturnType<typeof getAdminClient>,
  row: OutboxRow,
) {
  const { data: subscriptions, error: subscriptionsError } = await supabase
    .schema("now")
    .from("customer_push_subscriptions")
    .select("id, expo_push_token")
    .eq("user_id", row.user_id)
    .eq("is_active", true);

  if (subscriptionsError) {
    await completeOutbox(
      supabase,
      row.id,
      false,
      `push_subscription_lookup_failed: ${subscriptionsError.message}`,
    );
    return { sent: 0, disabled: 0, retry: true };
  }

  const activeSubscriptions = (subscriptions ?? []) as PushSubscription[];

  if (activeSubscriptions.length === 0) {
    await completeOutbox(supabase, row.id, true);
    return { sent: 0, disabled: 0, retry: false };
  }

  const { data: priorTickets, error: priorTicketsError } = await supabase
    .schema("now")
    .from("customer_notification_tickets")
    .select("push_subscription_id")
    .eq("outbox_id", row.id);

  if (priorTicketsError) {
    await completeOutbox(
      supabase,
      row.id,
      false,
      `ticket_lookup_failed: ${priorTicketsError.message}`,
    );
    return { sent: 0, disabled: 0, retry: true };
  }

  const alreadyTicketed = new Set(
    (priorTickets ?? []).map((ticket) => ticket.push_subscription_id as string),
  );

  const targets = activeSubscriptions.filter(
    (subscription) => !alreadyTicketed.has(subscription.id),
  );

  if (targets.length === 0) {
    await completeOutbox(supabase, row.id, true);
    return { sent: 0, disabled: 0, retry: false };
  }

  const messages = targets.map((subscription) => ({
    to: subscription.expo_push_token,
    sound: "default",
    priority: "high",
    channelId: "orders",
    title: row.title,
    body: row.body,
    data: row.data ?? {},
  }));

  let response: Response;
  try {
    response = await fetch(EXPO_SEND_URL, {
      method: "POST",
      headers: expoHeaders(),
      body: JSON.stringify(messages),
    });
  } catch (error) {
    await completeOutbox(
      supabase,
      row.id,
      false,
      `expo_network_error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { sent: 0, disabled: 0, retry: true };
  }

  const rawBody = await response.text();

  if (!response.ok) {
    await completeOutbox(
      supabase,
      row.id,
      false,
      `expo_http_${response.status}: ${rawBody.slice(0, 700)}`,
    );
    return { sent: 0, disabled: 0, retry: true };
  }

  let payload: { data?: ExpoTicket | ExpoTicket[]; errors?: unknown };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await completeOutbox(
      supabase,
      row.id,
      false,
      "expo_invalid_json_response",
    );
    return { sent: 0, disabled: 0, retry: true };
  }

  const ticketList = Array.isArray(payload.data)
    ? payload.data
    : payload.data
      ? [payload.data]
      : [];

  if (ticketList.length !== targets.length) {
    await completeOutbox(
      supabase,
      row.id,
      false,
      `expo_ticket_count_mismatch:${ticketList.length}:${targets.length}`,
    );
    return { sent: 0, disabled: 0, retry: true };
  }

  let sent = 0;
  let disabled = 0;
  let hasTransientFailure = false;

  for (let index = 0; index < ticketList.length; index += 1) {
    const ticket = ticketList[index];
    const subscription = targets[index];

    if (ticket.status === "ok" && ticket.id) {
      const { error: ticketInsertError } = await supabase
        .schema("now")
        .from("customer_notification_tickets")
        .insert({
          outbox_id: row.id,
          push_subscription_id: subscription.id,
          expo_ticket_id: ticket.id,
        });

      if (ticketInsertError && ticketInsertError.code !== "23505") {
        hasTransientFailure = true;
      } else {
        sent += 1;
      }
      continue;
    }

    const errorCode = ticket.details?.error;

    if (errorCode === "DeviceNotRegistered") {
      await disableSubscription(supabase, subscription.id);
      disabled += 1;
      continue;
    }

    hasTransientFailure = true;
  }

  if (hasTransientFailure) {
    await completeOutbox(
      supabase,
      row.id,
      false,
      "one_or_more_push_tickets_failed",
    );
    return { sent, disabled, retry: true };
  }

  await completeOutbox(supabase, row.id, true);
  return { sent, disabled, retry: false };
}

async function checkReceipts(
  supabase: ReturnType<typeof getAdminClient>,
) {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: pendingTickets, error } = await supabase
    .schema("now")
    .from("customer_notification_tickets")
    .select("id, expo_ticket_id, push_subscription_id, created_at")
    .eq("status", "pending")
    .lte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(RECEIPT_BATCH_SIZE);

  if (error || !pendingTickets?.length) {
    return { checked: 0, disabled: 0 };
  }

  let response: Response;
  try {
    response = await fetch(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: expoHeaders(),
      body: JSON.stringify({
        ids: pendingTickets.map((ticket) => ticket.expo_ticket_id),
      }),
    });
  } catch {
    return { checked: 0, disabled: 0 };
  }

  if (!response.ok) {
    return { checked: 0, disabled: 0 };
  }

  let payload: { data?: Record<string, ExpoReceipt> };
  try {
    payload = await response.json();
  } catch {
    return { checked: 0, disabled: 0 };
  }

  const receipts = payload.data ?? {};
  let checked = 0;
  let disabled = 0;

  for (const ticket of pendingTickets) {
    const receipt = receipts[ticket.expo_ticket_id];
    if (!receipt) {
      continue;
    }

    const errorCode = receipt.details?.error ?? null;
    const receiptStatus = receipt.status === "ok" ? "ok" : "error";

    const { error: updateError } = await supabase
      .schema("now")
      .from("customer_notification_tickets")
      .update({
        status: receiptStatus,
        error_code: errorCode,
        error_message: receipt.message ?? null,
        checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id)
      .eq("status", "pending");

    if (updateError) {
      continue;
    }

    checked += 1;

    if (errorCode === "DeviceNotRegistered") {
      await disableSubscription(supabase, ticket.push_subscription_id);
      disabled += 1;
    }
  }

  return { checked, disabled };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  const supabase = getAdminClient();

  const { data: claimed, error: claimError } = await supabase
    .schema("now")
    .rpc("claim_customer_notification_batch", {
      p_limit: BATCH_SIZE,
    });

  if (claimError) {
    console.error("Unable to claim notification outbox batch", claimError);
    return Response.json({ error: "claim_failed" }, { status: 500 });
  }

  let eventsProcessed = 0;
  let messagesTicketed = 0;
  let subscriptionsDisabled = 0;
  let eventsQueuedForRetry = 0;

  for (const row of (claimed ?? []) as OutboxRow[]) {
    try {
      const result = await dispatchOutboxRow(supabase, row);
      eventsProcessed += 1;
      messagesTicketed += result.sent;
      subscriptionsDisabled += result.disabled;
      if (result.retry) {
        eventsQueuedForRetry += 1;
      }
    } catch (error) {
      console.error("Notification dispatch failed", row.id, error);
      try {
        await completeOutbox(
          supabase,
          row.id,
          false,
          error instanceof Error ? error.message : String(error),
        );
      } catch (completionError) {
        console.error("Unable to release failed outbox row", row.id, completionError);
      }
      eventsQueuedForRetry += 1;
    }
  }

  const receiptResult = await checkReceipts(supabase);
  subscriptionsDisabled += receiptResult.disabled;

  return Response.json({
    ok: true,
    eventsProcessed,
    messagesTicketed,
    eventsQueuedForRetry,
    receiptsChecked: receiptResult.checked,
    subscriptionsDisabled,
  });
});
