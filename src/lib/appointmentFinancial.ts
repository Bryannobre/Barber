import { addMinutes, parse } from "date-fns";
import type { Appointment } from "@/types/database.types";

type AppointmentTiming = Pick<
  Appointment,
  "status" | "date" | "start_time" | "duration_minutes" | "ends_at" | "starts_at"
>;

/** Fim do atendimento (preferência: ends_at do banco). */
export function getAppointmentEndDate(apt: AppointmentTiming): Date {
  if (apt.ends_at) return new Date(apt.ends_at);
  const time = String(apt.start_time ?? "00:00").slice(0, 5);
  const base = parse(`${apt.date}T${time}:00`, "yyyy-MM-dd'T'HH:mm:ss", new Date());
  return addMinutes(base, apt.duration_minutes ?? 0);
}

/** Receita de agendamento só entra no financeiro após conclusão e fim do horário. */
export function isAppointmentEligibleForFinancial(apt: AppointmentTiming, now = new Date()): boolean {
  if (apt.status !== "completed") return false;
  return getAppointmentEndDate(apt).getTime() <= now.getTime();
}
