import type { Appointment } from "@/types/database.types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  CALENDAR_TIMELINE_PAD_Y,
  getEventLayout,
  getMinutesFromMidnight,
  parseAppointmentEnd,
  parseAppointmentStart,
} from "./calendarUtils";

interface EventBlockProps {
  appointment: Appointment & { starts_at?: string | null; ends_at?: string | null };
  professionalName: string;
  pixelsPerMinute: number;
  dayStartMinutes: number;
  timelinePadY?: number;
  onClick: (appointmentId: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-blue-600 text-white border-blue-600",
  pending: "bg-yellow-600 text-white border-yellow-600",
  completed: "bg-green-600 text-white border-green-600",
  cancelled: "bg-red-600 text-white border-red-600",
  blocked: "bg-orange-600 text-white border-orange-600",
  no_show: "bg-amber-800 text-white border-amber-800",
};

export function EventBlock({
  appointment,
  professionalName,
  pixelsPerMinute,
  dayStartMinutes,
  timelinePadY = CALENDAR_TIMELINE_PAD_Y,
  onClick,
}: EventBlockProps) {
  const start = parseAppointmentStart(appointment);
  const end = parseAppointmentEnd(appointment);
  const startMinutes = getMinutesFromMidnight(start);
  const endMinutes = getMinutesFromMidnight(end);
  const { top, height } = getEventLayout(
    startMinutes,
    endMinutes,
    pixelsPerMinute,
    dayStartMinutes,
    timelinePadY
  );
  const timeLabel = `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`;
  const statusClass = STATUS_STYLES[appointment.status] ?? "bg-muted text-foreground border-border";

  return (
    <button
      type="button"
      className={cn(
        "absolute left-1 right-1 rounded-md border px-2 py-1 text-left shadow-sm transition-opacity hover:opacity-90",
        statusClass
      )}
      style={{ top, height }}
      title={`${appointment.client_name ?? "Cliente"} · ${professionalName} · ${timeLabel}`}
      onClick={() => onClick(appointment.id)}
    >
      <p className="truncate text-xs font-semibold">{appointment.client_name ?? "Cliente"}</p>
      <p className="truncate text-[11px] opacity-90">{timeLabel}</p>
      <p className="truncate text-[11px] opacity-90">{professionalName}</p>
    </button>
  );
}
