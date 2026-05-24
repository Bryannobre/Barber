import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse } from "./httpSecurity.ts";

export const MAX_INVOICE_RETRIES = 3;

export interface FiscalRequestBody {
  invoice_id: string;
  company_id: string;
}

export interface FiscalAuthContext {
  user: { id: string };
  admin: SupabaseClient;
  supabaseUrl: string;
}

export async function authenticateFiscalRequest(
  req: Request,
  body: FiscalRequestBody
): Promise<FiscalAuthContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ success: false, error: "Não autenticado." }, 401, req);
  }

  if (!body.invoice_id?.trim() || !body.company_id?.trim()) {
    return jsonResponse(
      { success: false, error: "Campos obrigatórios: invoice_id, company_id" },
      400,
      req
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Missing Supabase env vars");
    return jsonResponse({ success: false, error: "Configuração do servidor inválida" }, 500, req);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ success: false, error: "Sessão inválida." }, 401, req);
  }

  const { data: membership, error: memberError } = await userClient
    .from("company_members")
    .select("company_id")
    .eq("company_id", body.company_id.trim())
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError || !membership) {
    return jsonResponse({ success: false, error: "Sem permissão para esta empresa." }, 403, req);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { user: { id: user.id }, admin, supabaseUrl };
}
