import { format } from "date-fns";
import type { Appointment, Professional } from "@/types/database.types";
import { ProfessionalColumn } from "./ProfessionalColumn";
import {
  CALENDAR_HEADER_HEIGHT_PX,
  CALENDAR_TIMELINE_PAD_Y,
  formatMinutesLabel,
  getMinutesFromMidnight,
  isSameLocalDate,
  parseAppointmentStart,
  resolveTimelinePixelsPerMinute,
  timeToMinutes,
} from "./calendarUtils";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
  date: Date;
  professionals: Professional[];
  appointments: (Appointment & { starts_at?: string | null; ends_at?: string | null })[];
  openingTime: string;
  closingTime: string;
  /** Passo da grade e do clique (5, 10, 15 ou 30 min) */
  slotIntervalMinutes: number;
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
  slotIntervalMinutes,
  pixelsPerMinute: pixelsPerMinuteProp,
  onEmptySlotClick,
  onEventClick,
}: CalendarViewProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayStartMinutes = timeToMinutes(openingTime);
  const dayEndMinutes = timeToMinutes(closingTime);
  const slotStep = Math.max(1, slotIntervalMinutes);
  const pixelsPerMinute =
    pixelsPerMinuteProp ?? resolveTimelinePixelsPerMinute(slotStep);
  const totalMinutes = Math.max(dayEndMinutes - dayStartMinutes, 0);
  const timelineHeight = totalMinutes * pixelsPerMinute;
  const bodyHeight = timelineHeight + CALENDAR_TIMELINE_PAD_Y * 2;
  const timeColumnWidth = slotStep <= 5 ? "5.75rem" : slotStep <= 10 ? "5.25rem" : "4.5rem";

  const slotMarks = Array.from(
    { length: Math.floor(totalMinutes / slotStep) + 1 },
    (_, i) => dayStartMinutes + i * slotStep
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
          <div
            className="sticky left-0 z-30 shrink-0 border-r border-border bg-card"
            style={{ width: timeColumnWidth }}
          >
            <div
              className="sticky top-0 z-40 shrink-0 border-b border-border bg-muted/95 backdrop-blur-sm"
              style={{ height: CALENDAR_HEADER_HEIGHT_PX }}
            />
            <div className="relative bg-card" style={{ height: bodyHeight }}>
              {slotMarks.map((minutes) => {
                const isFullHour = minutes % 60 === 0;
                return (
                  <div
                    key={`label-${minutes}`}
                    className={cn(
                      "absolute left-0 right-0 pr-1.5 text-right tabular-nums leading-none",
                      isFullHour
                        ? "text-xs font-semibold text-foreground"
                        : "text-[10px] font-medium text-muted-foreground",
                      hourLabelPositionClass(minutes, dayStartMinutes, dayEndMinutes)
                    )}
                    style={{
                      top:
                        CALENDAR_TIMELINE_PAD_Y +
                        (minutes - dayStartMinutes) * pixelsPerMinute,
                    }}
                  >
                    {formatMinutesLabel(minutes)}
                  </div>
                );
              })}
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
              {slotMarks.map((minutes) => (
                <div
                  key={`line-${minutes}`}
                  className={cn(
                    "absolute left-0 right-0 border-t",
                    minutes % 60 === 0
                      ? "border-dashed border-border/80"
                      : "border-border/35"
                  )}
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
                  clickRoundingMinutes={slotIntervalMinutes}
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
