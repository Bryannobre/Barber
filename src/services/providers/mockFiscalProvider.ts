/**
 * @deprecated Import from `@/services/providers/fiscal`
 */
import { MockFiscalProvider } from "./fiscal/MockFiscalProvider";
import type { FiscalIssueContext } from "./fiscal/types";

const instance = new MockFiscalProvider();

/** @deprecated Use MockFiscalProvider.issueInvoice */
export async function mockIssueInvoice(input: {
  company_id: string;
  invoice_id: string;
  service_description?: string | null;
  final_amount: number;
}) {
  const result = await instance.issueInvoice(input as FiscalIssueContext);
  return {
    provider: result.provider,
    invoice_number: result.invoice_number,
    verification_code: result.verification_code,
    pdf_url: "",
    xml_url: "",
    tax_amount: result.tax_amount,
    raw_response: result.raw_response,
  };
}
