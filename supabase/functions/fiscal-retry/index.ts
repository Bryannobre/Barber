// Edge Function: fiscal-retry — reemissão após FAILED (máx. 3 tentativas)

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
import { processInvoiceEmission } from "../_shared/fiscalInvoiceProcessor.ts";

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

    const result = await processInvoiceEmission(auth.admin, invoice, {
      mode: "retry",
      actorId: auth.user.id,
      incrementRetry: true,
    });

    if (!result.success) {
      const code = result.error?.includes("Limite") ? 400 : 500;
      return jsonResponse({ success: false, error: result.error }, code, req);
    }

    return jsonResponse({ success: true, invoice: result.invoice }, 200, req);
  } catch (e) {
    console.error("fiscal-retry error:", e);
    return jsonResponse(
      { success: false, error: "Não foi possível reprocessar a nota." },
      500,
      req
    );
  }
});
