export const PDF_REQUIRES_HTTPS_MESSAGE =
  "Visualização e download do PDF exigem HTTPS (ou localhost). Acesse o sistema por uma conexão segura.";

/** PDF via blob: só em contexto seguro (HTTPS, localhost). */
export function isPdfExportSecureContext(): boolean {
  if (typeof window === "undefined") return true;
  return window.isSecureContext;
}

export function createPdfObjectUrl(blob: Blob): string {
  if (!isPdfExportSecureContext()) {
    throw new Error(PDF_REQUIRES_HTTPS_MESSAGE);
  }
  return URL.createObjectURL(blob);
}

export function revokePdfObjectUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}
