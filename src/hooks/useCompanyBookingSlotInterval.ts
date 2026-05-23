import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { resolveBookingSlotIntervalMinutes } from "@/lib/bookingDuration";

/**
 * Intervalo de agendamento da empresa (fonte: banco), com fallback do tenant em cache.
 */
export function useCompanyBookingSlotInterval(
  companyId: string,
  tenantInterval?: number | null
) {
  const { data } = useQuery({
    queryKey: ["company-booking-settings", companyId],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from("companies")
        .select("booking_slot_interval_minutes, opening_time, closing_time")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return row;
    },
    enabled: !!companyId,
    staleTime: 0,
  });

  const slotIntervalMinutes = resolveBookingSlotIntervalMinutes(
    data?.booking_slot_interval_minutes ?? tenantInterval
  );

  return {
    slotIntervalMinutes,
    openingTime: data?.opening_time,
    closingTime: data?.closing_time,
  };
}
