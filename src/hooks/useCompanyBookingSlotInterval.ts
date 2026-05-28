import { useQuery } from "@tanstack/react-query";
import { resolveBookingSlotIntervalMinutes } from "@/lib/bookingDuration";
import type { CompanyBusinessHour } from "@/lib/businessHours";
import { companyBusinessHoursService } from "@/services/companyBusinessHours.service";
import { companyService } from "@/services/company.service";

/**
 * Intervalo de agendamento e horários semanais da empresa (fonte: banco).
 */
export function useCompanyBookingSlotInterval(
  companyId: string,
  tenantInterval?: number | null
) {
  const { data } = useQuery({
    queryKey: ["company-booking-settings", companyId],
    queryFn: async () => {
      const [companyRes, hoursRes] = await Promise.all([
        companyService.getById(companyId),
        companyBusinessHoursService.listByCompany(companyId),
      ]);
      if (companyRes.error) throw companyRes.error;
      if (hoursRes.error) throw hoursRes.error;
      return {
        company: companyRes.data,
        businessHours: hoursRes.data as CompanyBusinessHour[],
      };
    },
    enabled: !!companyId,
    staleTime: 0,
  });

  const slotIntervalMinutes = resolveBookingSlotIntervalMinutes(
    data?.company?.booking_slot_interval_minutes ?? tenantInterval
  );

  return {
    slotIntervalMinutes,
    openingTime: data?.company?.opening_time,
    closingTime: data?.company?.closing_time,
    businessHours: data?.businessHours ?? [],
    company: data?.company,
  };
}
