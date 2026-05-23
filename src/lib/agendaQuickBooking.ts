import { addDays, format, parseISO } from "date-fns";
import { bookingService } from "@/services/booking.service";
import { calculateBookingDurationMinutes } from "@/lib/bookingDuration";
import type { ProfessionalWithServices, Service } from "@/types/database.types";

export interface QuickBookingSuggestion {
  date: string;
  startTime: string;
  professionalId: string;
  professionalName: string;
  serviceIds: string[];
}

/**
 * Primeiro horário livre: dia preferido → próximos dias → profissionais com serviço.
 */
export async function suggestQuickBookingSlot(params: {
  companyId: string;
  professionals: ProfessionalWithServices[];
  services: Service[];
  preferredDate: string;
  maxDaysAhead?: number;
}): Promise<QuickBookingSuggestion | null> {
  const { companyId, professionals, services, preferredDate } = params;
  const maxDays = params.maxDaysAhead ?? 14;

  const profsWithServices = professionals.filter(
    (p) => (p.professional_services?.length ?? 0) > 0
  );
  if (!profsWithServices.length || !services.length) return null;

  const serviceDurations = Object.fromEntries(
    services.map((s) => [s.id, s.duration_minutes])
  ) as Record<string, number>;

  const baseDate = parseISO(preferredDate);

  for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
    const date = format(addDays(baseDate, dayOffset), "yyyy-MM-dd");

    for (const prof of profsWithServices) {
      const linkedIds =
        prof.professional_services?.map((ps) => ps.service_id) ?? [];
      const serviceId = linkedIds.find((id) => services.some((s) => s.id === id));
      if (!serviceId) continue;

      const duration = calculateBookingDurationMinutes(services, [serviceId]);
      if (duration <= 0) continue;

      const { data: slots } = await bookingService.getAvailableSlots(
        companyId,
        prof.id,
        date,
        [serviceId],
        serviceDurations,
        duration
      );

      const firstFree = slots?.find((s) => s.available !== false);
      if (firstFree) {
        return {
          date,
          startTime: firstFree.startTime,
          professionalId: prof.id,
          professionalName: prof.name,
          serviceIds: [serviceId],
        };
      }
    }
  }

  return null;
}
