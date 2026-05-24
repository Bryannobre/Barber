import type {
  FiscalCancelContext,
  FiscalCancelProviderResult,
  FiscalCompanySettingsInput,
  FiscalIssueContext,
  FiscalIssueProviderResult,
  FiscalSettingsValidation,
} from "./types";

/**
 * Contrato para provedores fiscais (NFS-e).
 * Implementações reais rodam na Edge Function; esta interface orienta validação no app.
 */
export interface FiscalProvider {
  readonly key: string;
  issueInvoice(context: FiscalIssueContext): Promise<FiscalIssueProviderResult>;
  cancelInvoice(context: FiscalCancelContext): Promise<FiscalCancelProviderResult>;
  validateCompanySettings(settings: FiscalCompanySettingsInput): FiscalSettingsValidation;
}
