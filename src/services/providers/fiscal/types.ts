/** Tipos compartilhados dos provedores fiscais (frontend / validação UX). */

export type FiscalProviderKey = "mock" | "tecnospeed" | "nuvem_fiscal" | "integra_notas";

export interface FiscalCompanySettingsInput {
  legal_name?: string | null;
  document?: string | null;
  municipal_registration?: string | null;
  tax_regime?: string | null;
  provider?: string | null;
  default_service_description?: string | null;
}

export interface FiscalIssueContext {
  company_id: string;
  invoice_id: string;
  service_description?: string | null;
  client_name?: string | null;
  professional_name?: string | null;
  final_amount: number;
  service_amount: number;
}

export interface FiscalIssueProviderResult {
  provider: string;
  invoice_number: string;
  verification_code: string;
  tax_amount: number;
  raw_response: Record<string, unknown>;
}

export interface FiscalCancelContext {
  company_id: string;
  invoice_id: string;
  invoice_number?: string | null;
}

export interface FiscalCancelProviderResult {
  cancelled: boolean;
  raw_response: Record<string, unknown>;
}

export interface FiscalSettingsValidation {
  valid: boolean;
  errors: string[];
}
