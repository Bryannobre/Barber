import {
  differenceInCalendarDays,
  format,
  isToday,
  isTomorrow,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Appointment } from "@/types/database.types";

const ACTIVE_STATUSES = new Set(["pending", "confirmed"]);

export function getNextClientAppointment(
  upcoming: Appointment[]
): Appointment | null {
  const now = new Date();
  for (const apt of upcoming) {
    if (!ACTIVE_STATUSES.has(apt.status ?? "")) continue;
    const start = new Date(
      `${apt.date}T${String(apt.start_time ?? "00:00").slice(0, 5)}:00`
    );
    if (start.getTime() > now.getTime()) return apt;
  }
  return null;
}

export interface ClientReminderCopy {
  title: string;
  subtitle: string;
  urgency: "today" | "tomorrow" | "soon" | "later";
}

/** Textos para lembrete in-app (sem e-mail/WhatsApp). */
export function getClientReminderCopy(apt: Appointment): ClientReminderCopy {
  const dateObj = parseISO(apt.date);
  const time = String(apt.start_time ?? "").slice(0, 5);
  const dayLabel = format(dateObj, "EEEE, d 'de' MMMM", { locale: ptBR });

  if (isToday(dateObj)) {
    return {
      title: `Seu horário é hoje às ${time}`,
      subtitle: "Chegue com alguns minutos de antecedência.",
      urgency: "today",
    };
  }

  if (isTomorrow(dateObj)) {
    return {
      title: `Lembrete: amanhã às ${time}`,
      subtitle: dayLabel,
      urgency: "tomorrow",
    };
  }

  const days = differenceInCalendarDays(dateObj, new Date());
  if (days <= 3) {
    return {
      title: `Seu horário em ${days} dias — ${time}`,
      subtitle: dayLabel,
      urgency: "soon",
    };
  }

  return {
    title: `Próximo horário: ${format(dateObj, "dd/MM", { locale: ptBR })} às ${time}`,
    subtitle: dayLabel,
    urgency: "later",
  };
}

export function shouldShowClientReminder(apt: Appointment): boolean {
  const start = new Date(
    `${apt.date}T${String(apt.start_time ?? "00:00").slice(0, 5)}:00`
  );
  const daysUntil = differenceInCalendarDays(start, new Date());
  return daysUntil >= 0 && daysUntil <= 7;
}
