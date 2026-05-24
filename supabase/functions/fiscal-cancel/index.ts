// Edge Function: fiscal-cancel — cancelamento interno (sem prefeitura)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  assertBrowserPostHeaders,
  corsHeadersForRequest,
  getClientIp,
  jsonResponse,
  mergeHeaders,
  rateLimitExceeded,
  securityHeaders,
  isOriginAllowed,
} from "../_shared/httpSecurity.ts";
import { authenticateFiscalRequest, type FiscalRequestBody } from "../_shared/fiscalAuth.ts";
import { processInvoiceInternalCancel } from "../_shared/fiscalInvoiceProcessor.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    if (origin && !isOriginAllowed(origin)) {
      return new Response("Forbidden", { status: 403, headers: new Headers(securityHeaders) });
    }
    return new Response("ok", {
      headers: mergeHeaders({ ...corsHeadersForRequest(req), ...securityHeaders }),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Método não permitido" }, 405, req);
  }

  if (rateLimitExceeded(getClientIp(req))) {
    return jsonResponse(
      { success: false, error: "Muitas tentativas. Aguarde um minuto." },
      429,
      req,
      { "Retry-After": "60" }
    );
  }

  const headerErr = assertBrowserPostHeaders(req);
  if (headerErr) {
    return jsonResponse({ success: false, error: "Requisição não autorizada." }, 403, req);
  }

  try {
    const body = (await req.json()) as FiscalRequestBody;
    const auth = await authenticateFiscalRequest(req, body);
    if (auth instanceof Response) return auth;

    const { data: invoice, error: invError } = await auth.admin
      .from("invoices")
      .select("*")
      .eq("id", body.invoice_id.trim())
      .eq("company_id", body.company_id.trim())
      .maybeSingle();

    if (invError || !invoice) {
      return jsonResponse({ success: false, error: "Nota não encontrada." }, 404, req);
    }

    const result = await processInvoiceInternalCancel(auth.admin, invoice, auth.user.id);

    if (!result.success) {
      return jsonResponse({ success: false, error: result.error }, 400, req);
    }

    return jsonResponse({ success: true, invoice: result.invoice }, 200, req);
  } catch (e) {
    console.error("fiscal-cancel error:", e);
    return jsonResponse(
      { success: false, error: "Não foi possível cancelar a nota." },
      500,
      req
    );
  }
});
