import { supabase } from "@/lib/supabase";
import { requireCompanyId } from "@/lib/companyScope";
import type { CompanyBusinessHour, CompanyBusinessHourDraft } from "@/lib/businessHours";
import { createDefaultBusinessWeek, normalizeTimeValue } from "@/lib/businessHours";

export const companyBusinessHoursService = {
  async listByCompany(companyId: string) {
    requireCompanyId(companyId);
    const { data, error } = await supabase
      .from("company_business_hours")
      .select("*")
      .eq("company_id", companyId)
      .order("day_of_week");

    if (error) return { data: [] as CompanyBusinessHour[], error };

    const rows = (data ?? []) as CompanyBusinessHour[];
    if (rows.length === 7) {
      return { data: rows, error: null };
    }

    return { data: createDefaultBusinessWeek(companyId), error: null };
  },

  async saveWeek(
    companyId: string,
    drafts: CompanyBusinessHourDraft[],
    bookingSlotIntervalMinutes: number
  ) {
    requireCompanyId(companyId);

    const payload = drafts.map((d) => ({
      company_id: companyId,
      day_of_week: d.day_of_week,
      is_closed: d.is_closed,
      opens_at: d.is_closed ? null : `${normalizeTimeValue(d.opens_at)}:00`,
      closes_at: d.is_closed ? null : `${normalizeTimeValue(d.closes_at)}:00`,
    }));

    const { error: upsertError } = await supabase
      .from("company_business_hours")
      .upsert(payload, { onConflict: "company_id,day_of_week" });

    if (upsertError) return { data: null, error: upsertError };

    const firstOpen = drafts.find((d) => !d.is_closed);
    const legacyPatch = firstOpen
      ? {
          opening_time: `${normalizeTimeValue(firstOpen.opens_at)}:00`,
          closing_time: `${normalizeTimeValue(firstOpen.closes_at)}:00`,
          booking_slot_interval_minutes: bookingSlotIntervalMinutes,
        }
      : { booking_slot_interval_minutes: bookingSlotIntervalMinutes };

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .update(legacyPatch)
      .eq("id", companyId)
      .select("*")
      .single();

    return { data: company, error: companyError };
  },
};
