import type { FiscalProvider } from "./FiscalProvider";
import type {
  FiscalCancelContext,
  FiscalCancelProviderResult,
  FiscalCompanySettingsInput,
  FiscalIssueContext,
  FiscalIssueProviderResult,
  FiscalSettingsValidation,
} from "./types";

const MOCK_DELAY_MS = 600;

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

/** Mock para desenvolvimento — espelha lógica em supabase/functions/_shared/fiscalProviders/MockFiscalProvider.ts */
export class MockFiscalProvider implements FiscalProvider {
  readonly key = "mock";

  async issueInvoice(context: FiscalIssueContext): Promise<FiscalIssueProviderResult> {
    await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));

    const year = new Date().getFullYear();
    const invoiceNumber = `${year}${randomDigits(8)}`;
    const verificationCode =
      randomDigits(4) + "-" + randomDigits(4) + "-" + randomDigits(4);
    const taxAmount = Math.round(context.final_amount * 0.05 * 100) / 100;

    return {
      provider: this.key,
      invoice_number: invoiceNumber,
      verification_code: verificationCode,
      tax_amount: taxAmount,
      raw_response: {
        mock: true,
        issued_at: new Date().toISOString(),
        invoice_number: invoiceNumber,
        verification_code: verificationCode,
      },
    };
  }

  async cancelInvoice(context: FiscalCancelContext): Promise<FiscalCancelProviderResult> {
    await new Promise((r) => setTimeout(r, 200));
    return {
      cancelled: true,
      raw_response: {
        mock: true,
        internal_cancel: true,
        invoice_id: context.invoice_id,
        at: new Date().toISOString(),
      },
    };
  }

  validateCompanySettings(settings: FiscalCompanySettingsInput): FiscalSettingsValidation {
    const errors: string[] = [];
    if (!settings.legal_name?.trim()) {
      errors.push("Razão social é recomendada para emissão.");
    }
    if (!settings.document?.trim()) {
      errors.push("CNPJ é recomendado para emissão.");
    }
    return { valid: errors.length === 0, errors };
  }
}
