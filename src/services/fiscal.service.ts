import { supabase } from "@/lib/supabase";
import { requireCompanyId, requireUuid } from "@/lib/companyScope";
import { getSafeClientMessage } from "@/lib/supabaseErrors";
import type { FinancialRecord } from "@/types/database.types";
import type {
  CreateInvoicePayload,
  FiscalEdgeResponse,
  FiscalSettings,
  Invoice,
  InvoiceLog,
  InvoiceWithMeta,
  UpdateFiscalSettingsPayload,
} from "@/types/fiscal.types";

const FISCAL_PDF_BUCKET = "fiscal-documents";

async function invokeFiscalFunction(
  functionName: "fiscal-issue" | "fiscal-retry" | "fiscal-cancel",
  companyId: string,
  invoiceId: string
): Promise<Invoice> {
  const { data, error } = await supabase.functions.invoke<FiscalEdgeResponse>(functionName, {
    body: { invoice_id: invoiceId, company_id: companyId },
    // Obrigatório para Edge Functions com assertBrowserPostHeaders (ver httpSecurity.ts)
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (data && data.success === false && data.error) {
    throw new Error(data.error);
  }
  if (error) {
    let bodyError: string | null = null;
    const ctx = error as {
      context?: { json?: () => Promise<{ error?: string }> };
    };
    if (typeof ctx.context?.json === "function") {
      const body = await ctx.context.json().catch(() => null);
      bodyError = body?.error ?? null;
    }
    throw new Error(bodyError ?? getSafeClientMessage(error));
  }
  if (!data?.success) throw new Error(data?.error ?? "Operação fiscal não concluída.");
  if (!data.invoice) throw new Error("Resposta inválida do servidor fiscal.");

  return data.invoice;
}

function mapInvoiceRow(row: Record<string, unknown>): InvoiceWithMeta {
  const fr = row.financial_record as
    | {
        client_name_snapshot?: string | null;
        professional_name_snapshot?: string | null;
        service_name_snapshot?: string | null;
      }
    | null
    | undefined;

  const { financial_record: _fr, ...rest } = row;
  const invoice = rest as unknown as Invoice;

  return {
    ...invoice,
    retry_count: Number(invoice.retry_count ?? 0),
    client_name_snapshot: fr?.client_name_snapshot ?? null,
    professional_name_snapshot: fr?.professional_name_snapshot ?? null,
    service_name_snapshot: fr?.service_name_snapshot ?? null,
  };
}

/** Lançamento elegível: receita válida com forma de pagamento informada. */
export function isFinancialRecordEligibleForInvoice(record: FinancialRecord): boolean {
  return (
    record.is_valid &&
    record.type === "income" &&
    !!record.payment_method?.trim()
  );
}

export const fiscalService = {
  async getInvoices(companyId: string, options?: { status?: string; limit?: number }) {
    const cid = requireCompanyId(companyId);
    let q = supabase
      .from("invoices")
      .select(
        `
        *,
        financial_record:financial_records(
          client_name_snapshot,
          professional_name_snapshot,
          service_name_snapshot
        )
      `
      )
      .eq("company_id", cid)
      .order("created_at", { ascending: false });

    if (options?.status) {
      q = q.eq("status", options.status);
    }
    if (options?.limit) {
      q = q.limit(options.limit);
    }

    const { data, error } = await q;
    if (error) throw new Error(getSafeClientMessage(error));
    return (data ?? []).map((row) => mapInvoiceRow(row as Record<string, unknown>));
  },

  async getInvoiceById(companyId: string, invoiceId: string) {
    const cid = requireCompanyId(companyId);
    const iid = requireUuid(invoiceId);

    const { data, error } = await supabase
      .from("invoices")
      .select(
        `
        *,
        financial_record:financial_records(
          client_name_snapshot,
          professional_name_snapshot,
          service_name_snapshot
        )
      `
      )
      .eq("company_id", cid)
      .eq("id", iid)
      .maybeSingle();

    if (error) throw new Error(getSafeClientMessage(error));
    if (!data) return null;
    return mapInvoiceRow(data as Record<string, unknown>);
  },

  async getInvoicesByFinancialRecordIds(
    companyId: string,
    financialRecordIds: string[]
  ): Promise<Map<string, Invoice>> {
    const cid = requireCompanyId(companyId);
    if (!financialRecordIds.length) return new Map();

    const { data, error } = await supabase
      .from("invoices")
      .select("id, financial_record_id, status, invoice_number")
      .eq("company_id", cid)
      .in("financial_record_id", financialRecordIds)
      .neq("status", "CANCELLED");

    if (error) throw new Error(getSafeClientMessage(error));

    const map = new Map<string, Invoice>();
    for (const row of data ?? []) {
      if (row.financial_record_id) {
        map.set(row.financial_record_id, row as Invoice);
      }
    }
    return map;
  },

  async createInvoiceFromFinancialRecord(
    params: CreateInvoicePayload,
    financialRecord: FinancialRecord,
    appointment?: {
      professional_id?: string | null;
      company_client_id?: string | null;
    } | null
  ) {
    const cid = requireCompanyId(params.company_id);
    const frId = requireUuid(params.financial_record_id);

    if (!isFinancialRecordEligibleForInvoice(financialRecord)) {
      throw new Error(
        "Somente receitas válidas com forma de pagamento podem gerar nota fiscal."
      );
    }

    if (financialRecord.company_id !== cid) {
      throw new Error("Empresa inválida.");
    }

    const amount = Number(financialRecord.amount) || 0;
    if (amount <= 0) {
      throw new Error("Valor do lançamento inválido para nota fiscal.");
    }

    const { data, error } = await supabase
      .from("invoices")
      .insert({
        company_id: cid,
        financial_record_id: frId,
        appointment_id: financialRecord.appointment_id,
        professional_id: appointment?.professional_id ?? null,
        company_client_id: appointment?.company_client_id ?? null,
        status: "PENDING",
        service_amount: amount,
        tax_amount: 0,
        discount_amount: 0,
        final_amount: amount,
        provider: "mock",
        created_by: params.created_by ?? null,
      })
      .select("*")
      .single();

    if (error) throw new Error(getSafeClientMessage(error));

    await supabase.from("invoice_logs").insert({
      invoice_id: data.id,
      company_id: cid,
      event: "invoice_created",
      status: "PENDING",
      message: "Nota criada a partir do financeiro.",
      actor_id: params.created_by ?? null,
      payload: { financial_record_id: frId },
      metadata: { source: "financial" },
    });

    return data as Invoice;
  },

  /**
   * Emissão via Edge Function — única via autorizada no MVP.
   * Segurança: validação real na API; frontend não emite diretamente.
   */
  async issueInvoice(companyId: string, invoiceId: string): Promise<Invoice> {
    const cid = requireCompanyId(companyId);
    const iid = requireUuid(invoiceId);
    return invokeFiscalFunction("fiscal-issue", cid, iid);
  },

  async retryInvoice(companyId: string, invoiceId: string): Promise<Invoice> {
    const cid = requireCompanyId(companyId);
    const iid = requireUuid(invoiceId);
    return invokeFiscalFunction("fiscal-retry", cid, iid);
  },

  async cancelInvoice(companyId: string, invoiceId: string): Promise<Invoice> {
    const cid = requireCompanyId(companyId);
    const iid = requireUuid(invoiceId);
    return invokeFiscalFunction("fiscal-cancel", cid, iid);
  },

  /** URL assinada para PDF no Storage (path salvo em pdf_url). */
  async getInvoicePdfSignedUrl(pdfPath: string | null | undefined): Promise<string | null> {
    if (!pdfPath?.trim() || pdfPath.includes("://")) return null;
    const { data, error } = await supabase.storage
      .from(FISCAL_PDF_BUCKET)
      .createSignedUrl(pdfPath.trim(), 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  },

  async getRecentActivity(companyId: string, limit = 8) {
    const cid = requireCompanyId(companyId);
    const { data, error } = await supabase
      .from("invoice_logs")
      .select("*")
      .eq("company_id", cid)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(getSafeClientMessage(error));
    return (data ?? []) as InvoiceLog[];
  },

  async getLogs(companyId: string, options?: { invoiceId?: string; limit?: number }) {
    const cid = requireCompanyId(companyId);
    let q = supabase
      .from("invoice_logs")
      .select("*")
      .eq("company_id", cid)
      .order("created_at", { ascending: false });

    if (options?.invoiceId) {
      q = q.eq("invoice_id", requireUuid(options.invoiceId));
    }
    if (options?.limit) {
      q = q.limit(options.limit);
    }

    const { data, error } = await q;
    if (error) throw new Error(getSafeClientMessage(error));
    return (data ?? []) as InvoiceLog[];
  },

  async getFiscalSettings(companyId: string) {
    const cid = requireCompanyId(companyId);
    const { data, error } = await supabase
      .from("company_fiscal_settings")
      .select("*")
      .eq("company_id", cid)
      .maybeSingle();

    if (error) throw new Error(getSafeClientMessage(error));
    return (data as FiscalSettings | null) ?? null;
  },

  async updateFiscalSettings(companyId: string, payload: UpdateFiscalSettingsPayload) {
    const cid = requireCompanyId(companyId);

    const row = {
      company_id: cid,
      legal_name: payload.legal_name?.trim() || null,
      document: payload.document?.trim() || null,
      municipal_registration: payload.municipal_registration?.trim() || null,
      tax_regime: payload.tax_regime?.trim() || null,
      provider: payload.provider?.trim() || null,
      auto_issue_invoice: payload.auto_issue_invoice ?? false,
      default_service_code: payload.default_service_code?.trim() || null,
      default_service_description: payload.default_service_description?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("company_fiscal_settings")
      .upsert(row, { onConflict: "company_id" })
      .select("*")
      .single();

    if (error) throw new Error(getSafeClientMessage(error));
    return data as FiscalSettings;
  },
};
