import { format } from "date-fns";

export const PIXELS_PER_MINUTE = 2;
/** Espaço mínimo entre rótulos na coluna lateral (px) */
export const MIN_TIME_LABEL_GAP_PX = 18;
export const MIN_EVENT_HEIGHT = 24;
/** Espaço vertical para rótulos de hora não serem cortados no scroll */
export const CALENDAR_TIMELINE_PAD_Y = 16;
export const CALENDAR_HEADER_HEIGHT_PX = 48;

export interface CalendarAppointmentTime {
  date: string;
  start_time: string;
  duration_minutes: number;
  starts_at?: string | null;
  ends_at?: string | null;
}

export function parseAppointmentStart(appointment: CalendarAppointmentTime): Date {
  if (appointment.starts_at) return new Date(appointment.starts_at);
  return new Date(`${appointment.date}T${String(appointment.start_time).slice(0, 5)}:00`);
}

export function parseAppointmentEnd(appointment: CalendarAppointmentTime): Date {
  if (appointment.ends_at) return new Date(appointment.ends_at);
  const start = parseAppointmentStart(appointment);
  return new Date(start.getTime() + appointment.duration_minutes * 60 * 1000);
}

export function timeToMinutes(value: string): number {
  const [h, m] = String(value ?? "00:00").slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

/** Escala vertical da agenda conforme o intervalo (evita rótulos sobrepostos). */
export function resolveTimelinePixelsPerMinute(slotIntervalMinutes: number): number {
  const step = Math.max(1, slotIntervalMinutes);
  return Math.max(PIXELS_PER_MINUTE, MIN_TIME_LABEL_GAP_PX / step);
}

export function formatMinutesLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function getMinutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function getEventLayout(
  startMinutes: number,
  endMinutes: number,
  pixelsPerMinute: number,
  dayStartMinutes: number,
  timelinePadY: number = CALENDAR_TIMELINE_PAD_Y
) {
  const duration = Math.max(0, endMinutes - startMinutes);
  return {
    top: timelinePadY + (startMinutes - dayStartMinutes) * pixelsPerMinute,
    height: Math.max(duration * pixelsPerMinute, MIN_EVENT_HEIGHT),
    durationMinutes: duration,
  };
}

export function roundMinutes(minutes: number, step: number): number {
  return Math.round(minutes / step) * step;
}

export function isSameLocalDate(date: Date, ymd: string): boolean {
  return format(date, "yyyy-MM-dd") === ymd;
}
