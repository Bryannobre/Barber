/** Tipos do módulo fiscal (NFS-e). Fase 2: sincronizar com database.types gerado. */

export type InvoiceStatus =
  | "PENDING"
  | "PROCESSING"
  | "ISSUED"
  | "FAILED"
  | "CANCELLED";

export interface Invoice {
  id: string;
  company_id: string;
  financial_record_id: string | null;
  appointment_id: string | null;
  professional_id: string | null;
  company_client_id: string | null;
  provider: string | null;
  invoice_number: string | null;
  verification_code: string | null;
  status: InvoiceStatus;
  error_message: string | null;
  service_amount: number;
  tax_amount: number;
  discount_amount: number;
  final_amount: number;
  pdf_url: string | null;
  xml_url: string | null;
  raw_request: Record<string, unknown> | null;
  raw_response: Record<string, unknown> | null;
  issued_at: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

/** Campos derivados do lançamento financeiro (join no service). */
export interface InvoiceListMeta {
  client_name_snapshot?: string | null;
  professional_name_snapshot?: string | null;
  service_name_snapshot?: string | null;
}

export type InvoiceWithMeta = Invoice & InvoiceListMeta;

export interface InvoiceLog {
  id: string;
  invoice_id: string;
  company_id: string;
  event: string;
  status: string | null;
  message: string | null;
  payload: Record<string, unknown> | null;
  actor_id: string | null;
  retry_count: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const FISCAL_MAX_RETRIES = 3;

export interface FiscalDashboardStats {
  issuedCount: number;
  pendingCount: number;
  failedCount: number;
  cancelledCount: number;
  revenue: number;
  taxes: number;
  dailyAverage: number;
  emissionsByDay: { date: string; count: number; total: number }[];
}

export interface FiscalSettings {
  id: string;
  company_id: string;
  legal_name: string | null;
  document: string | null;
  municipal_registration: string | null;
  tax_regime: string | null;
  provider: string | null;
  auto_issue_invoice: boolean;
  default_service_code: string | null;
  default_service_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoicePayload {
  company_id: string;
  financial_record_id: string;
  created_by?: string | null;
}

export interface UpdateFiscalSettingsPayload {
  legal_name?: string | null;
  document?: string | null;
  municipal_registration?: string | null;
  tax_regime?: string | null;
  provider?: string | null;
  auto_issue_invoice?: boolean;
  default_service_code?: string | null;
  default_service_description?: string | null;
}

export interface FiscalEdgeResponse {
  success: boolean;
  invoice?: Invoice;
  error?: string;
}

/** @deprecated Use FiscalEdgeResponse */
export type FiscalIssueEdgeResponse = FiscalEdgeResponse;
