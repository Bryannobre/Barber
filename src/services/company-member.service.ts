import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getSafeClientMessage } from "@/lib/supabaseErrors";
import type { CompanyMemberWithProfile } from "@/types/database.types";

/** Mensagem da RPC (RAISE EXCEPTION) — PostgREST devolve 400 com texto em message/details. */
export function getCompanyMemberRpcErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const pg = error as PostgrestError;
    const raw = (pg.details ?? pg.message ?? "").trim();
    if (raw && raw.length < 200 && !raw.toLowerCase().includes("bad request")) {
      return raw;
    }
  }
  return getSafeClientMessage(error);
}

export interface AddCompanyMemberParams {
  company_id: string;
  full_name: string;
  email: string;
  phone?: string;
  password: string;
  allowed_pages?: string[] | null;
}

export interface UpdateCompanyMemberParams {
  company_id: string;
  user_id: string;
  full_name: string;
  phone?: string;
  allowed_pages?: string[] | null;
  password?: string;
}

export const companyMemberService = {
  async listByCompany(companyId: string) {
    const { data, error } = await supabase.rpc("list_company_members", {
      p_company_id: companyId,
    });

    return { data: (data ?? []) as CompanyMemberWithProfile[], error };
  },

  async addToCompany(params: AddCompanyMemberParams) {
    const { data, error } = await supabase.rpc("upsert_company_member", {
      p_company_id: params.company_id,
      p_full_name: params.full_name,
      p_email: params.email,
      p_phone: params.phone ?? null,
      p_password: params.password,
      p_allowed_pages: params.allowed_pages ?? null,
    });

    return { data: (data as string | null) ?? null, error };
  },

  async updateProfileAndAccess(params: UpdateCompanyMemberParams) {
    const { data, error } = await supabase.rpc("update_company_member_profile_and_access", {
      p_company_id: params.company_id,
      p_user_id: params.user_id,
      p_full_name: params.full_name,
      p_phone: params.phone ?? null,
      p_allowed_pages: params.allowed_pages ?? null,
      p_password: params.password?.trim() ? params.password : null,
    });

    return { data: Boolean(data), error };
  },

  async removeFromCompany(companyId: string, userId: string) {
    const { data, error } = await supabase.rpc("remove_company_member", {
      p_company_id: companyId,
      p_user_id: userId,
    });

    return { data: Boolean(data), error };
  },
};
