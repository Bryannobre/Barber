/**
 * Gera PDF mock estilo comprovante NFS-e (não é documento fiscal válido).
 */
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

export interface FiscalPdfInput {
  company_name: string;
  company_document: string;
  client_name: string;
  service_description: string;
  professional_name: string;
  invoice_number: string;
  verification_code: string;
  final_amount: number;
  tax_amount: number;
  issued_at: string;
  status_label: string;
}

function formatBrl(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

/** Helvetica (pdf-lib) so aceita WinAnsi — acentos quebram a emissao. */
export function pdfSafeText(value: string | null | undefined, maxLen = 120): string {
  const base = (value ?? "").normalize("NFD").replace(/\p{M}/gu, "");
  const ascii = base.replace(/[^\x20-\x7E]/g, "?");
  return ascii.slice(0, maxLen) || "-";
}

export async function generateFiscalMockPdf(input: FiscalPdfInput): Promise<Uint8Array> {
  const safe: FiscalPdfInput = {
    ...input,
    company_name: pdfSafeText(input.company_name),
    company_document: pdfSafeText(input.company_document, 24),
    client_name: pdfSafeText(input.client_name),
    service_description: pdfSafeText(input.service_description, 80),
    professional_name: pdfSafeText(input.professional_name),
    invoice_number: pdfSafeText(input.invoice_number, 32),
    verification_code: pdfSafeText(input.verification_code, 32),
    issued_at: pdfSafeText(input.issued_at, 40),
    status_label: pdfSafeText(input.status_label, 40),
  };

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  const margin = 48;
  let y = height - margin;

  const draw = (text: string, size: number, bold = false, color = rgb(0.12, 0.12, 0.14)) => {
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: bold ? fontBold : font,
      color,
    });
    y -= size + 10;
  };

  const drawLine = () => {
    y -= 4;
    page.drawLine({
      start: { x: margin, y },
      end: { x: 595 - margin, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.88),
    });
    y -= 16;
  };

  page.drawRectangle({
    x: margin,
    y: y - 52,
    width: 595 - margin * 2,
    height: 56,
    color: rgb(0.16, 0.55, 0.38),
  });
  page.drawText("NFS-e - Nota Fiscal de Servico", {
    x: margin + 12,
    y: y - 28,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("COMPROVANTE MOCK - SEM VALIDADE FISCAL", {
    x: margin + 12,
    y: y - 44,
    size: 8,
    font,
    color: rgb(0.9, 1, 0.95),
  });
  y -= 72;

  draw(`No ${safe.invoice_number}`, 16, true);
  draw(`Codigo verificador: ${safe.verification_code}`, 10);
  draw(`Status: ${safe.status_label}`, 10);
  draw(`Emitido em: ${safe.issued_at}`, 10);
  drawLine();

  draw("PRESTADOR DE SERVICOS", 11, true);
  draw(safe.company_name || "Empresa", 10);
  draw(`CNPJ: ${safe.company_document || "-"}`, 10);
  drawLine();

  draw("TOMADOR", 11, true);
  draw(safe.client_name || "Consumidor", 10);
  drawLine();

  draw("SERVICO", 11, true);
  draw(safe.service_description || "Servico prestado", 10);
  draw(`Profissional: ${safe.professional_name || "-"}`, 10);
  drawLine();

  draw(`Valor dos servicos: ${formatBrl(safe.final_amount)}`, 11);
  draw(`ISS estimado (mock 5%): ${formatBrl(safe.tax_amount)}`, 10);
  draw(`Valor liquido: ${formatBrl(safe.final_amount - safe.tax_amount)}`, 11, true);
  drawLine();

  draw("Documento gerado pelo Auren (modulo fiscal mock).", 8, false, rgb(0.45, 0.45, 0.5));
  draw("Fase 3: substituir por DANFSE oficial do provedor homologado.", 8, false, rgb(0.45, 0.45, 0.5));

  return doc.save();
}

export function fiscalPdfStoragePath(companyId: string, invoiceId: string): string {
  return `${companyId}/invoices/${invoiceId}.pdf`;
}
