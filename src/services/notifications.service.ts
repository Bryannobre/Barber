import { supabase } from "@/lib/supabase";
import { requireCompanyId, requireUuid } from "@/lib/companyScope";
import type { AppNotification, CreateNotificationInput } from "@/types/database.types";

export interface ListNotificationsOptions {
  limit?: number;
  offset?: number;
}

/** Mapeia linha da API (is_read; legado "read" se migration 054 ainda não aplicada) */
function mapNotificationRow(row: Record<string, unknown>): AppNotification {
  const isRead = row.is_read ?? row.read;
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    company_id: String(row.company_id),
    type: row.type as AppNotification["type"],
    title: String(row.title ?? ""),
    message: String(row.message ?? ""),
    is_read: Boolean(isRead),
    created_at: String(row.created_at ?? ""),
    recado_id: (row.recado_id as string | null) ?? null,
    comment_id: (row.comment_id as string | null) ?? null,
    appointment_id: (row.appointment_id as string | null) ?? null,
  };
}

export const notificationsService = {
  async getNotifications(companyId: string, options: ListNotificationsOptions = {}) {
    requireCompanyId(companyId);
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return { data: [] as AppNotification[], error };

    const rows = (data ?? []) as Record<string, unknown>[];
    return {
      data: rows.map(mapNotificationRow),
      error: null,
    };
  },

  async getUnreadCount(companyId: string) {
    requireCompanyId(companyId);
    const base = () =>
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);

    let res = await base().eq("is_read", false);
    if (res.error) {
      res = await base().eq("read", false);
    }

    if (res.error) return { count: 0, error: res.error };
    return { count: res.count ?? 0, error: null };
  },

  async markAsRead(id: string) {
    requireUuid(id);
    const { error } = await supabase.rpc("mark_notification_read", { p_id: id });
    return { error };
  },

  /**
   * Inserção explícita (ex.: notificação de comentário no futuro).
   * Menções e @todos no mural são geradas por triggers no Supabase.
   */
  async createNotification(input: CreateNotificationInput) {
    requireCompanyId(input.company_id);
    requireUuid(input.user_id);
    if (input.recado_id) requireUuid(input.recado_id);
    if (input.comment_id) requireUuid(input.comment_id);
    const { data, error } = await supabase.rpc("create_notification", {
      p_user_id: input.user_id,
      p_company_id: input.company_id,
      p_type: input.type,
      p_title: input.title,
      p_message: input.message,
      p_recado_id: input.recado_id ?? null,
      p_comment_id: input.comment_id ?? null,
    });
    return { id: data as string | null, error };
  },
};
