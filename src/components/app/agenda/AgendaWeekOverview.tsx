import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/types/database.types";

export interface WeekDayItem {
  offset: number;
  dateObj: Date;
  dateStr: string;
  labelShort: string;
  labelFull: string;
}

interface AgendaWeekOverviewProps {
  weekDays: WeekDayItem[];
  appointments: Appointment[];
  selectedDayOffset: number;
  todayStr: string;
  onSelectDay: (offset: number) => void;
}

const ACTIVE = new Set(["pending", "confirmed", "completed", "blocked"]);

export function AgendaWeekOverview({
  weekDays,
  appointments,
  selectedDayOffset,
  todayStr,
  onSelectDay,
}: AgendaWeekOverviewProps) {
  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold mb-3">Resumo da semana</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {weekDays.map((d) => {
          const dayApts = appointments.filter(
            (a) => a.date === d.dateStr && ACTIVE.has(a.status ?? "")
          );
          const confirmed = dayApts.filter((a) => a.status === "confirmed").length;
          const completed = dayApts.filter((a) => a.status === "completed").length;
          const pending = dayApts.filter((a) => a.status === "pending").length;
          const isSelected = d.offset === selectedDayOffset;
          const isToday = d.dateStr === todayStr;

          return (
            <button
              key={d.dateStr}
              type="button"
              onClick={() => onSelectDay(d.offset)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors hover:border-primary/40",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background/50",
                isToday && !isSelected && "ring-1 ring-primary/30"
              )}
            >
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                {d.labelShort}
              </p>
              <p className="text-lg font-bold tabular-nums">
                {format(d.dateObj, "d MMM", { locale: ptBR })}
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{dayApts.length}</p>
              <p className="text-[10px] text-muted-foreground">agendamentos</p>
              <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                {confirmed > 0 && (
                  <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-blue-700 dark:text-blue-300">
                    {confirmed} conf.
                  </span>
                )}
                {pending > 0 && (
                  <span className="rounded bg-yellow-500/15 px-1.5 py-0.5 text-yellow-800 dark:text-yellow-200">
                    {pending} pend.
                  </span>
                )}
                {completed > 0 && (
                  <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-green-700 dark:text-green-300">
                    {completed} concl.
                  </span>
                )}
                {dayApts.length === 0 && (
                  <span className="text-muted-foreground">Sem agendamentos</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Clique em um dia para abrir a grade horária detalhada abaixo.
      </p>
    </section>
  );
}
