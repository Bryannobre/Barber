import type {
  FiscalCancelContext,
  FiscalCancelProviderResult,
  FiscalCompanySettingsInput,
  FiscalIssueContext,
  FiscalIssueProviderResult,
  FiscalSettingsValidation,
} from "./types.ts";

export interface FiscalProvider {
  readonly key: string;
  issueInvoice(context: FiscalIssueContext): Promise<FiscalIssueProviderResult>;
  cancelInvoice(context: FiscalCancelContext): Promise<FiscalCancelProviderResult>;
  validateCompanySettings(settings: FiscalCompanySettingsInput): FiscalSettingsValidation;
}
