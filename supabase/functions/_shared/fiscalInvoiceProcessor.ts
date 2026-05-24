import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { FiscalProviderFactory } from "./fiscalProviders/FiscalProviderFactory.ts";
import type { FiscalIssueContext } from "./fiscalProviders/types.ts";
import { insertInvoiceLog } from "./fiscalLogs.ts";
import { generateFiscalMockPdf, fiscalPdfStoragePath } from "./fiscalPdfGenerator.ts";

const BUCKET = "fiscal-documents";

async function updateInvoiceRow(
  admin: SupabaseClient,
  invoiceId: string,
  row: Record<string, unknown>
): Promise<void> {
  const { error } = await admin.from("invoices").update(row).eq("id", invoiceId);
  if (!error) return;
  const msg = error.message ?? "";
  if (msg.includes("retry_count") && "retry_count" in row) {
    const { retry_count: _r, ...withoutRetry } = row;
    const { error: err2 } = await admin.from("invoices").update(withoutRetry).eq("id", invoiceId);
    if (err2) throw err2;
    console.warn("[fiscal] retry_count ausente — aplique migration 067_fiscal_phase2.sql");
    return;
  }
  throw error;
}

export interface ProcessInvoiceOptions {
  mode: "issue" | "retry";
  actorId: string;
  incrementRetry?: boolean;
}

export interface ProcessInvoiceResult {
  success: boolean;
  invoice?: Record<string, unknown>;
  error?: string;
}

async function loadInvoiceContext(
  admin: SupabaseClient,
  invoice: Record<string, unknown>
): Promise<FiscalIssueContext & { settings: Record<string, unknown> | null }> {
  const companyId = invoice.company_id as string;
  const invoiceId = invoice.id as string;

  const { data: settings } = await admin
    .from("company_fiscal_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  const { data: company } = await admin
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();

  let clientName: string | null = null;
  let professionalName: string | null = null;
  let serviceDescription = settings?.default_service_description ?? null;

  if (invoice.financial_record_id) {
    const { data: fr } = await admin
      .from("financial_records")
      .select("client_name_snapshot, professional_name_snapshot, service_name_snapshot")
      .eq("id", invoice.financial_record_id)
      .maybeSingle();
    clientName = fr?.client_name_snapshot ?? null;
    professionalName = fr?.professional_name_snapshot ?? null;
    serviceDescription =
      fr?.service_name_snapshot ?? serviceDescription;
  }

  return {
    company_id: companyId,
    invoice_id: invoiceId,
    service_description: serviceDescription,
    client_name: clientName,
    professional_name: professionalName,
    company_legal_name: settings?.legal_name ?? company?.name ?? null,
    company_document: settings?.document ?? null,
    final_amount: Number(invoice.final_amount) || Number(invoice.service_amount) || 0,
    service_amount: Number(invoice.service_amount) || 0,
    settings: settings as Record<string, unknown> | null,
  };
}

async function ensureFiscalBucket(admin: SupabaseClient): Promise<void> {
  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets?.some((b) => b.id === BUCKET)) return;

  const { error } = await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 5_242_880,
    allowedMimeTypes: ["application/pdf"],
  });
  if (error && !String(error.message).toLowerCase().includes("already exists")) {
    console.error("fiscal bucket create:", error);
    throw new Error(
      "Bucket fiscal-documents indisponivel. Execute as migrations 067/068 (pnpm db:push)."
    );
  }
}

async function uploadPdf(
  admin: SupabaseClient,
  companyId: string,
  invoiceId: string,
  pdfBytes: Uint8Array
): Promise<string | null> {
  try {
    await ensureFiscalBucket(admin);
    const path = fiscalPdfStoragePath(companyId, invoiceId);
    const { error } = await admin.storage.from(BUCKET).upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) {
      console.error("fiscal PDF upload:", error);
      return null;
    }
    return path;
  } catch (e) {
    console.error("fiscal PDF storage:", e);
    return null;
  }
}

export async function processInvoiceEmission(
  admin: SupabaseClient,
  invoice: Record<string, unknown>,
  options: ProcessInvoiceOptions
): Promise<ProcessInvoiceResult> {
  const invoiceId = invoice.id as string;
  const companyId = invoice.company_id as string;
  const currentRetry = Number(invoice.retry_count ?? 0);

  if (options.mode === "retry") {
    if (invoice.status !== "FAILED") {
      return { success: false, error: "Somente notas com erro podem ser reenviadas." };
    }
    if (currentRetry >= 3) {
      return { success: false, error: "Limite de 3 tentativas de reemissão atingido." };
    }
  }

  const nextRetryCount =
    options.mode === "retry" ? currentRetry + 1 : currentRetry;

  await updateInvoiceRow(admin, invoiceId, {
    status: "PROCESSING",
    error_message: null,
    retry_count: options.mode === "retry" ? nextRetryCount : currentRetryCount,
  });

  await insertInvoiceLog(admin, {
    invoice_id: invoiceId,
    company_id: companyId,
    event: options.mode === "retry" ? "retry_started" : "issue_started",
    status: "PROCESSING",
    message:
      options.mode === "retry"
        ? `Reemissão iniciada (tentativa ${nextRetryCount}/3).`
        : "Início da emissão.",
    actor_id: options.actorId,
    retry_count: nextRetryCount,
    metadata: { mode: options.mode },
  });

  try {
    const ctx = await loadInvoiceContext(admin, invoice);
    const providerKey = (ctx.settings?.provider as string) ?? "mock";
    const provider = FiscalProviderFactory.create(providerKey);

    const validation = provider.validateCompanySettings({
      legal_name: ctx.company_legal_name,
      document: ctx.company_document,
      municipal_registration: ctx.settings?.municipal_registration as string,
      tax_regime: ctx.settings?.tax_regime as string,
      provider: providerKey,
    });

    if (!validation.valid) {
      console.warn("[fiscal] settings validation:", validation.errors);
    }

    const issueResult = await provider.issueInvoice(ctx);
    const issuedAt = new Date().toISOString();

    const pdfBytes = await generateFiscalMockPdf({
      company_name: ctx.company_legal_name ?? "Empresa",
      company_document: ctx.company_document ?? "—",
      client_name: ctx.client_name ?? "—",
      service_description: ctx.service_description ?? "Serviço",
      professional_name: ctx.professional_name ?? "—",
      invoice_number: issueResult.invoice_number,
      verification_code: issueResult.verification_code,
      final_amount: ctx.final_amount,
      tax_amount: issueResult.tax_amount,
      issued_at: new Date(issuedAt).toLocaleString("pt-BR"),
      status_label: "EMITIDA (MOCK)",
    });

    const storagePath = await uploadPdf(admin, companyId, invoiceId, pdfBytes);

    await updateInvoiceRow(admin, invoiceId, {
      status: "ISSUED",
      provider: providerKey,
      invoice_number: issueResult.invoice_number,
      verification_code: issueResult.verification_code,
      tax_amount: issueResult.tax_amount,
      pdf_url: storagePath,
      xml_url: null,
      raw_request: ctx,
      raw_response: issueResult.raw_response,
      issued_at: issuedAt,
      error_message: null,
      retry_count: nextRetryCount,
    });

    const { data: updated, error: fetchError } = await admin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (fetchError || !updated) throw fetchError ?? new Error("Nota nao encontrada apos emissao.");

    await insertInvoiceLog(admin, {
      invoice_id: invoiceId,
      company_id: companyId,
      event: options.mode === "retry" ? "retry_success" : "issue_success",
      status: "ISSUED",
      message: `Nota ${issueResult.invoice_number} emitida.`,
      actor_id: options.actorId,
      retry_count: nextRetryCount,
      payload: issueResult.raw_response,
      metadata: {
        storage_path: storagePath,
        provider: providerKey,
        pdf_upload_skipped: storagePath == null,
      },
    });

    return { success: true, invoice: updated as Record<string, unknown> };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Falha na emissao.";
    console.error("[fiscal] emission error:", err);

    await updateInvoiceRow(admin, invoiceId, {
      status: "FAILED",
      error_message: msg,
      retry_count: nextRetryCount,
    }).catch(() => undefined);

    await insertInvoiceLog(admin, {
      invoice_id: invoiceId,
      company_id: companyId,
      event: options.mode === "retry" ? "retry_failed" : "issue_failed",
      status: "FAILED",
      message: msg,
      actor_id: options.actorId,
      retry_count: nextRetryCount,
    });

    return { success: false, error: msg };
  }
}

export async function processInvoiceInternalCancel(
  admin: SupabaseClient,
  invoice: Record<string, unknown>,
  actorId: string
): Promise<ProcessInvoiceResult> {
  const invoiceId = invoice.id as string;
  const companyId = invoice.company_id as string;
  const status = invoice.status as string;

  if (status === "CANCELLED") {
    return { success: true, invoice };
  }

  if (status === "PROCESSING") {
    return { success: false, error: "Aguarde o fim do processamento para cancelar." };
  }

  const provider = FiscalProviderFactory.create(invoice.provider as string);
  await provider.cancelInvoice({
    company_id: companyId,
    invoice_id: invoiceId,
    invoice_number: invoice.invoice_number as string,
  });

  const cancelledAt = new Date().toISOString();

  const { data: updated, error } = await admin
    .from("invoices")
    .update({
      status: "CANCELLED",
      cancelled_at: cancelledAt,
      error_message: null,
    })
    .eq("id", invoiceId)
    .select("*")
    .single();

  if (error) {
    return { success: false, error: "Não foi possível cancelar a nota." };
  }

  await insertInvoiceLog(admin, {
    invoice_id: invoiceId,
    company_id: companyId,
    event: "cancelled_internal",
    status: "CANCELLED",
    message: "Cancelamento interno (sem comunicação com prefeitura).",
    actor_id: actorId,
    metadata: { internal_only: true },
  });

  return { success: true, invoice: updated as Record<string, unknown> };
}
