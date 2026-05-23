import { format } from "date-fns";
import type { Appointment, Professional } from "@/types/database.types";
import { ProfessionalColumn } from "./ProfessionalColumn";
import {
  CALENDAR_HEADER_HEIGHT_PX,
  CALENDAR_TIMELINE_PAD_Y,
  PIXELS_PER_MINUTE,
  getMinutesFromMidnight,
  isSameLocalDate,
  parseAppointmentStart,
  timeToMinutes,
} from "./calendarUtils";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
  date: Date;
  professionals: Professional[];
  appointments: (Appointment & { starts_at?: string | null; ends_at?: string | null })[];
  openingTime: string;
  closingTime: string;
  pixelsPerMinute?: number;
  onEmptySlotClick: (payload: { professionalId: string; date: string; startTime: string }) => void;
  onEventClick: (appointmentId: string) => void;
}

function hourLabelPositionClass(
  minutes: number,
  dayStartMinutes: number,
  dayEndMinutes: number
) {
  if (minutes === dayStartMinutes) return "translate-y-0";
  if (minutes === dayEndMinutes) return "-translate-y-full";
  return "-translate-y-1/2";
}

export function CalendarView({
  date,
  professionals,
  appointments,
  openingTime,
  closingTime,
  pixelsPerMinute = PIXELS_PER_MINUTE,
  onEmptySlotClick,
  onEventClick,
}: CalendarViewProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayStartMinutes = timeToMinutes(openingTime);
  const dayEndMinutes = timeToMinutes(closingTime);
  const totalMinutes = Math.max(dayEndMinutes - dayStartMinutes, 0);
  const timelineHeight = totalMinutes * pixelsPerMinute;
  const bodyHeight = timelineHeight + CALENDAR_TIMELINE_PAD_Y * 2;
  const hourMarks = Array.from(
    { length: Math.ceil(totalMinutes / 60) + 1 },
    (_, i) => dayStartMinutes + i * 60
  ).filter((m) => m <= dayEndMinutes);

  const appointmentsByProfessional = professionals.reduce<
    Record<string, (Appointment & { starts_at?: string | null; ends_at?: string | null })[]>
  >((acc, professional) => {
    acc[professional.id] = appointments
      .filter((appointment) => {
        if (appointment.professional_id !== professional.id) return false;
        const start = parseAppointmentStart(appointment);
        return isSameLocalDate(start, dateStr);
      })
      .sort(
        (a, b) =>
          getMinutesFromMidnight(parseAppointmentStart(a)) -
          getMinutesFromMidnight(parseAppointmentStart(b))
      );
    return acc;
  }, {});

  const minTableWidth = Math.max(320, 80 + professionals.length * 220);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div
        className="scrollbar-theme overflow-x-auto overflow-y-auto overscroll-contain"
        style={{ maxHeight: "min(720px, calc(100vh - 220px))" }}
      >
        <div
          className="inline-flex min-h-full w-full align-top"
          style={{ minWidth: minTableWidth }}
        >
          {/* Coluna de horários */}
          <div className="sticky left-0 z-30 w-[4.5rem] shrink-0 border-r border-border bg-card">
            <div
              className="sticky top-0 z-40 shrink-0 border-b border-border bg-muted/95 backdrop-blur-sm"
              style={{ height: CALENDAR_HEADER_HEIGHT_PX }}
            />
            <div className="relative bg-card" style={{ height: bodyHeight }}>
              {hourMarks.map((minutes) => (
                <div
                  key={minutes}
                  className={cn(
                    "absolute left-0 right-0 pr-2 text-right text-xs font-medium tabular-nums text-muted-foreground",
                    hourLabelPositionClass(minutes, dayStartMinutes, dayEndMinutes)
                  )}
                  style={{
                    top:
                      CALENDAR_TIMELINE_PAD_Y +
                      (minutes - dayStartMinutes) * pixelsPerMinute,
                  }}
                >
                  {String(Math.floor(minutes / 60)).padStart(2, "0")}:
                  {String(minutes % 60).padStart(2, "0")}
                </div>
              ))}
            </div>
          </div>

          {/* Grade por profissional */}
          <div
            className="relative flex min-w-0 flex-1"
            style={{ minHeight: bodyHeight + CALENDAR_HEADER_HEIGHT_PX }}
          >
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0"
              style={{
                top: CALENDAR_HEADER_HEIGHT_PX,
                height: bodyHeight,
              }}
            >
              {hourMarks.map((minutes) => (
                <div
                  key={`line-${minutes}`}
                  className="absolute left-0 right-0 border-t border-dashed border-border/80"
                  style={{
                    top:
                      CALENDAR_TIMELINE_PAD_Y +
                      (minutes - dayStartMinutes) * pixelsPerMinute,
                  }}
                />
              ))}
            </div>

            {professionals.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                Nenhum profissional cadastrado
              </div>
            ) : (
              professionals.map((professional) => (
                <ProfessionalColumn
                  key={professional.id}
                  professional={professional}
                  appointments={appointmentsByProfessional[professional.id] ?? []}
                  pixelsPerMinute={pixelsPerMinute}
                  dayStartMinutes={dayStartMinutes}
                  dayEndMinutes={dayEndMinutes}
                  timelinePadY={CALENDAR_TIMELINE_PAD_Y}
                  bodyHeight={bodyHeight}
                  onEmptyClick={(professionalId, startTime) =>
                    onEmptySlotClick({ professionalId, date: dateStr, startTime })
                  }
                  onEventClick={onEventClick}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
