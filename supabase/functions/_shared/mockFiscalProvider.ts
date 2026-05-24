/**
 * Mock fiscal provider (Edge Functions / Deno).
 * Espelha src/services/providers/mockFiscalProvider.ts — manter lógica alinhada.
 * TODO Fase 2: provedor real + certificado via Secrets.
 */

export interface MockIssueInput {
  company_id: string;
  invoice_id: string;
  service_description?: string | null;
  final_amount: number;
}

export interface MockIssueResult {
  provider: string;
  invoice_number: string;
  verification_code: string;
  pdf_url: string;
  xml_url: string;
  tax_amount: number;
  raw_response: Record<string, unknown>;
}

const MOCK_DELAY_MS = 800;

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

export async function mockIssueInvoice(input: MockIssueInput): Promise<MockIssueResult> {
  await new Promise((r) => setTimeout(r, MOCK_DELAY_MS));

  const year = new Date().getFullYear();
  const invoiceNumber = `${year}${randomDigits(8)}`;
  const verificationCode = randomDigits(4) + "-" + randomDigits(4) + "-" + randomDigits(4);
  const taxAmount = Math.round(input.final_amount * 0.05 * 100) / 100;

  return {
    provider: "mock",
    invoice_number: invoiceNumber,
    verification_code: verificationCode,
    pdf_url: `https://example.invalid/fiscal/mock/${input.invoice_id}.pdf`,
    xml_url: `https://example.invalid/fiscal/mock/${input.invoice_id}.xml`,
    tax_amount: taxAmount,
    raw_response: {
      mock: true,
      issued_at: new Date().toISOString(),
      invoice_number: invoiceNumber,
      verification_code: verificationCode,
    },
  };
}
