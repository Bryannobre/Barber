import type { Appointment, Professional } from "@/types/database.types";
import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { EventBlock } from "./EventBlock";
import {
  CALENDAR_HEADER_HEIGHT_PX,
  minutesToTime,
  roundMinutes,
} from "./calendarUtils";

interface ProfessionalColumnProps {
  professional: Professional;
  appointments: (Appointment & { starts_at?: string | null; ends_at?: string | null })[];
  pixelsPerMinute: number;
  dayStartMinutes: number;
  dayEndMinutes: number;
  timelinePadY: number;
  bodyHeight: number;
  /** Alinha clique na grade ao intervalo configurado na empresa */
  clickRoundingMinutes: number;
  allowNewBookings?: boolean;
  onEmptyClick: (professionalId: string, startTime: string) => void;
  onEventClick: (appointmentId: string) => void;
}

export function ProfessionalColumn({
  professional,
  appointments,
  pixelsPerMinute,
  dayStartMinutes,
  dayEndMinutes,
  timelinePadY,
  bodyHeight,
  clickRoundingMinutes,
  allowNewBookings = true,
  onEmptyClick,
  onEventClick,
}: ProfessionalColumnProps) {
  const handleEmptyClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!allowNewBookings) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = event.clientY - rect.top - timelinePadY;
    const clickedMinutesFromStart = Math.max(0, Math.floor(relativeY / pixelsPerMinute));
    const absoluteMinutes = roundMinutes(
      dayStartMinutes + clickedMinutesFromStart,
      clickRoundingMinutes
    );
    if (absoluteMinutes >= dayEndMinutes) return;
    onEmptyClick(professional.id, minutesToTime(absoluteMinutes));
  };

  return (
    <div className="flex min-w-[220px] flex-1 flex-col border-l border-border">
      <div
        className="sticky top-0 z-20 flex shrink-0 items-center justify-center border-b border-border bg-muted/95 px-3 text-center text-sm font-semibold backdrop-blur-sm"
        style={{ height: CALENDAR_HEADER_HEIGHT_PX }}
      >
        <span className="truncate">{professional.name}</span>
      </div>
      <div
        className={cn(
          "relative bg-background/40",
          allowNewBookings ? "cursor-pointer" : "cursor-default opacity-90"
        )}
        style={{ height: bodyHeight }}
        onClick={handleEmptyClick}
      >
        {appointments.map((appointment) => (
          <div key={appointment.id} onClick={(e) => e.stopPropagation()}>
            <EventBlock
              appointment={appointment}
              professionalName={professional.name}
              pixelsPerMinute={pixelsPerMinute}
              dayStartMinutes={dayStartMinutes}
              timelinePadY={timelinePadY}
              onClick={onEventClick}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
