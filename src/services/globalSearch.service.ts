import { format, addDays } from "date-fns";
import { requireCompanyId } from "@/lib/companyScope";
import { bookingService } from "@/services/booking.service";
import { clientService } from "@/services/client.service";
import { professionalService } from "@/services/professional.service";
import { serviceService } from "@/services/service.service";
import type { Appointment, Service } from "@/types/database.types";
import type { CompanyClientWithVisitCount } from "@/services/client.service";

export interface GlobalSearchAppointmentHit {
  id: string;
  client_name: string | null;
  client_phone: string | null;
  date: string;
  start_time: string;
  status: string;
  professional_name: string;
}

export interface GlobalSearchResult {
  clients: CompanyClientWithVisitCount[];
  appointments: GlobalSearchAppointmentHit[];
  services: Service[];
}

const MIN_QUERY_LEN = 2;
const MAX_PER_GROUP = 8;

function normalizeQuery(q: string) {
  return q.trim().toLowerCase();
}

function digitsOnly(q: string) {
  return q.replace(/\D/g, "");
}

function matchesText(haystack: string | null | undefined, needle: string) {
  if (!needle) return false;
  return (haystack ?? "").toLowerCase().includes(needle);
}

export const globalSearchService = {
  async search(companyId: string, query: string): Promise<GlobalSearchResult> {
    requireCompanyId(companyId);
    const q = normalizeQuery(query);
    if (q.length < MIN_QUERY_LEN) {
      return { clients: [], appointments: [], services: [] };
    }

    const qDigits = digitsOnly(q);
    const today = format(new Date(), "yyyy-MM-dd");
    const rangeEnd = format(addDays(new Date(), 14), "yyyy-MM-dd");

    const [clientsRes, appointmentsRes, servicesRes, professionalsRes] =
      await Promise.all([
        clientService.listByCompany(companyId),
        bookingService.listByCompany(companyId, today, rangeEnd),
        serviceService.listByCompany(companyId),
        professionalService.listByCompany(companyId),
      ]);

    const profById = new Map(
      (professionalsRes.data ?? []).map((p) => [p.id, p.name])
    );

    const clients = (clientsRes.data ?? [])
      .filter((c) => {
        if (matchesText(c.full_name, q)) return true;
        if (qDigits.length >= 3 && digitsOnly(c.phone ?? "").includes(qDigits)) return true;
        if (matchesText(c.email, q)) return true;
        return false;
      })
      .slice(0, MAX_PER_GROUP);

    const appointments = (appointmentsRes.data ?? [])
      .filter((a: Appointment) => {
        if (["cancelled", "no_show"].includes(a.status ?? "")) return false;
        if (matchesText(a.client_name, q)) return true;
        if (qDigits.length >= 3 && digitsOnly(a.client_phone ?? "").includes(qDigits)) return true;
        if (matchesText(a.date, q)) return true;
        if (matchesText(String(a.start_time).slice(0, 5), q)) return true;
        const profName = profById.get(a.professional_id);
        if (matchesText(profName, q)) return true;
        return false;
      })
      .slice(0, MAX_PER_GROUP)
      .map((a) => ({
        id: a.id,
        client_name: a.client_name,
        client_phone: a.client_phone,
        date: a.date,
        start_time: String(a.start_time).slice(0, 5),
        status: a.status ?? "pending",
        professional_name: profById.get(a.professional_id) ?? "—",
      }));

    const services = (servicesRes.data ?? [])
      .filter((s) => matchesText(s.name, q) || matchesText(s.category, q))
      .slice(0, MAX_PER_GROUP);

    return { clients, appointments, services };
  },
};
