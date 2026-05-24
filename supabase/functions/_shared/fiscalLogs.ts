import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface InsertInvoiceLogParams {
  invoice_id: string;
  company_id: string;
  event: string;
  status: string;
  message: string;
  actor_id?: string | null;
  retry_count?: number | null;
  payload?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export async function insertInvoiceLog(
  supabase: SupabaseClient,
  params: InsertInvoiceLogParams
) {
  const fullRow = {
    invoice_id: params.invoice_id,
    company_id: params.company_id,
    event: params.event,
    status: params.status,
    message: params.message,
    actor_id: params.actor_id ?? null,
    retry_count: params.retry_count ?? null,
    payload: params.payload ?? null,
    metadata: params.metadata ?? null,
  };

  const { error } = await supabase.from("invoice_logs").insert(fullRow);

  if (!error) return;

  console.error("invoice_logs insert (full):", error);

  const legacyPayload = {
    ...(params.payload ?? {}),
    ...(params.actor_id ? { actor_id: params.actor_id } : {}),
    ...(params.retry_count != null ? { retry_count: params.retry_count } : {}),
    ...(params.metadata ?? {}),
  };

  const { error: legacyError } = await supabase.from("invoice_logs").insert({
    invoice_id: params.invoice_id,
    company_id: params.company_id,
    event: params.event,
    status: params.status,
    message: params.message,
    payload: Object.keys(legacyPayload).length ? legacyPayload : null,
  });

  if (legacyError) {
    console.error("invoice_logs insert (legacy):", legacyError);
  }
}
