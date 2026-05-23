import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageContainer from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { bookingService } from "@/services/booking.service";
import { financialService } from "@/services/financial.service";
import { canMarkAppointmentCompleted } from "@/lib/appointmentFinancial";
import { getAgendaSetupStatus } from "@/lib/agendaSetup";
import { AgendaSetupBanner } from "@/components/app/agenda/AgendaSetupBanner";
import { AgendaWeekOverview } from "@/components/app/agenda/AgendaWeekOverview";
import { clientService } from "@/services/client.service";
import { professionalService } from "@/services/professional.service";
import { serviceService } from "@/services/service.service";
import {
  format,
  addWeeks,
  subWeeks,
  startOfWeek,
  setHours,
  setMinutes,
  parseISO,
  differenceInCalendarDays,
} from "date-fns";
import { suggestQuickBookingSlot } from "@/lib/agendaQuickBooking";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { Appointment, ProfessionalWithServices } from "@/types/database.types";
import { AppointmentFormModal, type FormValues } from "@/components/app/AppointmentFormModal";
import { CalendarView } from "@/components/app/calendar/CalendarView";
import { useCompanyBookingSlotInterval } from "@/hooks/useCompanyBookingSlotInterval";

const DEFAULT_OPENING_TIME = "09:00";
const DEFAULT_CLOSING_TIME = "19:00";

function parseTime(t: string): Date {
  const [h, m] = (typeof t === "string" ? t.slice(0, 5) : "00:00").split(":").map(Number);
  return setMinutes(setHours(new Date(2000, 0, 1), h), m);
}

const STATUS_LEGEND = [
  { status: "confirmed", label: "Confirmado", className: "bg-blue-600 border-blue-600 text-white" },
  { status: "pending", label: "Pendente", className: "bg-yellow-600 border-yellow-600 text-white" },
  { status: "completed", label: "Concluído", className: "bg-green-600 border-green-600 text-white" },
  { status: "cancelled", label: "Cancelado", className: "bg-red-600 border-red-600 text-white" },
  { status: "blocked", label: "Bloqueado", className: "bg-orange-600 border-orange-600 text-white" },
  { status: "no_show", label: "Não compareceu", className: "bg-amber-800 border-amber-800 text-white" },
] as const;

const AppAgenda = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { currentCompany } = useTenant();
  const { user } = useAuth();
  const companyId = currentCompany?.id ?? "";
  const { slotIntervalMinutes, openingTime: dbOpening, closingTime: dbClosing } =
    useCompanyBookingSlotInterval(
      companyId,
      currentCompany?.booking_slot_interval_minutes
    );
  const openingTime = (
    dbOpening ?? currentCompany?.opening_time ?? DEFAULT_OPENING_TIME
  )
    .toString()
    .slice(0, 5);
  const closingTime = (
    dbClosing ?? currentCompany?.closing_time ?? DEFAULT_CLOSING_TIME
  )
    .toString()
    .slice(0, 5);
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);
  const [newSlot, setNewSlot] = useState<{
    date: string;
    startTime: string;
    professionalId: string;
    professionalName: string;
    serviceIds?: string[];
  } | null>(null);
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);
  const quickNewFromUrlHandled = useRef(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [agendaView, setAgendaView] = useState<"day" | "week">("day");

  const startDate = format(weekStart, "yyyy-MM-dd");
  const endDate = format(addWeeks(weekStart, 1), "yyyy-MM-dd");

  const { data: professionalsData } = useQuery({
    queryKey: ["professionals", companyId],
    queryFn: () => professionalService.listByCompanyWithServices(companyId),
    enabled: !!companyId,
  });

  const { data: servicesData } = useQuery({
    queryKey: ["services", companyId],
    queryFn: () => serviceService.listByCompany(companyId),
    enabled: !!companyId,
  });

  const { data: clientsData } = useQuery({
    queryKey: ["clients", companyId],
    queryFn: () => clientService.listByCompany(companyId),
    enabled: !!companyId,
  });

  const { data: appointmentsData } = useQuery({
    queryKey: ["appointments", companyId, startDate, endDate],
    queryFn: () => bookingService.listByCompany(companyId, startDate, endDate),
    enabled: !!companyId,
  });

  const { data: editingAppointment } = useQuery({
    queryKey: ["appointment", editingId],
    queryFn: () => (editingId ? bookingService.getById(editingId) : Promise.resolve({ data: null })),
    enabled: !!editingId,
  });

  const professionals: ProfessionalWithServices[] = professionalsData?.data ?? [];
  const services = servicesData?.data ?? [];
  const clients = clientsData?.data ?? [];
  const appointments = appointmentsData?.data ?? [];

  const recurringClientIds = new Set(
    clients.filter((c) => c.visit_count >= 2).map((c) => c.id)
  );
  const recurringPhones = new Set(
    clients
      .filter((c) => c.visit_count >= 2 && c.phone)
      .map((c) => (c.phone ?? "").replace(/\D/g, ""))
  );
  const isRecurringClient = (apt: Appointment) =>
    (apt.company_client_id && recurringClientIds.has(apt.company_client_id)) ||
    (apt.client_phone &&
      recurringPhones.has((apt.client_phone ?? "").replace(/\D/g, "")));
  const appointment = editingAppointment?.data ?? null;

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const existing = appointments.filter(
        (a) =>
          a.professional_id === values.professional_id &&
          a.date === values.date &&
          a.status !== "cancelled" &&
          a.status !== "no_show"
      );
      const start = parseTime(values.start_time).getTime();
      const end = start + values.duration_minutes * 60 * 1000;
      const overlaps = existing.some((a) => {
        const aStart = parseTime(String(a.start_time).slice(0, 5)).getTime();
        const aEnd = aStart + a.duration_minutes * 60 * 1000;
        return start < aEnd && end > aStart;
      });
      if (overlaps) {
        throw new Error("Este horário conflita com outro agendamento.");
      }
      return bookingService.createAdmin({
        company_id: companyId,
        client_name: values.client_name,
        client_phone: values.client_phone,
        professional_id: values.professional_id,
        date: values.date,
        start_time: values.start_time,
        duration_minutes: values.duration_minutes,
        service_ids: values.service_ids ?? [],
        status: values.status,
        notes: values.notes || null,
        created_by: user!.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      setNewSlot(null);
      toast.success("Agendamento criado!");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Erro ao criar agendamento.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!editingId) return Promise.reject(new Error("Nenhum agendamento selecionado"));
      const others = appointments.filter(
        (a) =>
          a.id !== editingId &&
          a.professional_id === values.professional_id &&
          a.date === values.date &&
          a.status !== "cancelled" &&
          a.status !== "no_show"
      );
      const start = parseTime(values.start_time).getTime();
      const end = start + values.duration_minutes * 60 * 1000;
      const overlaps = others.some((a) => {
        const aStart = parseTime(String(a.start_time).slice(0, 5)).getTime();
        const aEnd = aStart + a.duration_minutes * 60 * 1000;
        return start < aEnd && end > aStart;
      });
      if (overlaps) {
        throw new Error("Este horário conflita com outro agendamento.");
      }
      return bookingService.update(editingId, {
        client_name: values.client_name,
        client_phone: values.client_phone,
        professional_id: values.professional_id,
        date: values.date,
        start_time: values.start_time,
        duration_minutes: values.duration_minutes,
        status: values.status,
        notes: values.notes || null,
        service_ids: values.service_ids ?? [],
        updated_by: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      setEditingId(null);
      toast.success("Agendamento atualizado!");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Erro ao atualizar.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await bookingService.delete(id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      setEditingId(null);
      toast.success("Agendamento removido.");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Erro ao remover agendamento.");
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({
      id,
      paymentMethod,
    }: {
      id: string;
      paymentMethod: string;
    }) => {
      const apt = appointments.find((a) => a.id === id);
      if (apt && !canMarkAppointmentCompleted(apt)) {
        throw new Error(
          "Só é possível concluir após o horário do atendimento terminar."
        );
      }
      const result = await bookingService.update(id, {
        status: "completed",
        payment_method: paymentMethod,
        updated_by: user?.id,
      });
      if (result.error) throw result.error;
      let finAction: "created" | "updated" | "invalidated" | "none" = "none";
      if (companyId) {
        const fin = await financialService.reconcileAppointmentFinancial(id, user?.id);
        finAction = fin.action;
        await financialService.syncAppointmentRevenue(companyId, user?.id);
      }
      return { result, finAction };
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-revenue"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-activity"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-performance"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-services"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-payments"] });
      setEditingId(null);
      const finAction = payload?.finAction;
      if (finAction === "created" || finAction === "updated") {
        toast.success("Atendimento concluído e receita registrada no financeiro.");
      } else {
        toast.success(
          "Atendimento concluído! A receita entra no financeiro quando o horário do atendimento terminar."
        );
      }
    },
    onError: (e: Error) => {
      toast.error(e.message || "Erro ao concluir atendimento.");
    },
  });

  const WEEK_DAYS = 7;
  const dayLabelsShort = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const dayLabelsFull = [
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
    "Domingo",
  ];
  const weekDays = Array.from({ length: WEEK_DAYS }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return {
      offset: i,
      dateObj: d,
      dateStr: format(d, "yyyy-MM-dd"),
      labelShort: dayLabelsShort[i],
      labelFull: dayLabelsFull[i],
    };
  });
  const selectedDay = weekDays[Math.min(Math.max(selectedDayOffset, 0), WEEK_DAYS - 1)];
  const selectedDate = selectedDay.dateObj;

  const todayStr = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    const todayIndex = weekDays.findIndex((d) => d.dateStr === todayStr);
    setSelectedDayOffset(todayIndex >= 0 ? todayIndex : 0);
  }, [weekStart, todayStr]);

  const editFromUrl = searchParams.get("edit");
  useEffect(() => {
    if (editFromUrl) {
      setEditingId(editFromUrl);
      setAgendaView("day");
      setSearchParams({}, { replace: true });
    }
  }, [editFromUrl, setSearchParams]);

  const setupStatus = useMemo(
    () => getAgendaSetupStatus(services, professionals),
    [services, professionals]
  );

  const openQuickNewAppointment = useCallback(async () => {
    if (!companyId) return;
    if (!setupStatus.ready) {
      toast.error("Cadastre serviços, profissionais e horários de trabalho antes de agendar.");
      return;
    }
    if (!professionals.length) {
      toast.error("Nenhum profissional cadastrado.");
      return;
    }

    const preferredDate =
      selectedDay.dateStr >= todayStr ? selectedDay.dateStr : todayStr;

    setQuickCreateLoading(true);
    try {
      const suggestion = await suggestQuickBookingSlot({
        companyId,
        professionals,
        services,
        preferredDate,
      });

      if (!suggestion) {
        toast.error(
          "Nenhum horário livre nos próximos dias. Verifique horários de trabalho e agendamentos existentes."
        );
        return;
      }

      const suggestionDate = parseISO(suggestion.date);
      const week = startOfWeek(suggestionDate, { weekStartsOn: 1 });
      setWeekStart(week);
      setSelectedDayOffset(
        Math.min(6, Math.max(0, differenceInCalendarDays(suggestionDate, week)))
      );
      setAgendaView("day");
      setNewSlot({
        date: suggestion.date,
        startTime: suggestion.startTime,
        professionalId: suggestion.professionalId,
        professionalName: suggestion.professionalName,
        serviceIds: suggestion.serviceIds,
      });
      toast.success(
        `Horário sugerido: ${format(suggestionDate, "dd/MM", { locale: ptBR })} às ${suggestion.startTime}`
      );
    } finally {
      setQuickCreateLoading(false);
    }
  }, [
    companyId,
    setupStatus.ready,
    professionals,
    services,
    selectedDay.dateStr,
    todayStr,
  ]);

  const newFromUrl = searchParams.get("new");
  useEffect(() => {
    if (newFromUrl !== "1") {
      quickNewFromUrlHandled.current = false;
      return;
    }
    if (quickNewFromUrlHandled.current) return;
    if (!companyId || !professionalsData || !servicesData) return;
    quickNewFromUrlHandled.current = true;
    setSearchParams({}, { replace: true });
    void openQuickNewAppointment();
  }, [
    newFromUrl,
    companyId,
    professionalsData,
    servicesData,
    openQuickNewAppointment,
    setSearchParams,
  ]);

  const activeStatuses = new Set(["pending", "confirmed", "blocked", "completed"]);
  const appointmentCountByDay = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(
      weekDays.map((d) => [d.dateStr, 0])
    );
    for (const apt of appointments) {
      if (!apt.date || !activeStatuses.has(apt.status ?? "")) continue;
      if (counts[apt.date] !== undefined) counts[apt.date]++;
    }
    return counts;
  }, [appointments, weekDays]);

  const handleEmptySlotClick = (payload: {
    professionalId: string;
    date: string;
    startTime: string;
  }) => {
    const slotDt = new Date(`${payload.date}T${payload.startTime}:00`);
    if (slotDt < new Date()) {
      toast.error("Não é possível agendar em horário passado.");
      return;
    }
    const professional = professionals.find((p) => p.id === payload.professionalId);
    setNewSlot({
      date: payload.date,
      startTime: payload.startTime,
      professionalId: payload.professionalId,
      professionalName: professional?.name ?? "",
    });
  };

  return (
    <PageContainer>
      {/* Legenda + navegação: no desktop ficam na mesma linha (lateral); no mobile a navegação fica embaixo */}
      <div className="w-full flex flex-col gap-4 mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-wrap gap-2 items-center min-w-0">
            {STATUS_LEGEND.map((item) => (
              <span
                key={item.status}
                className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${item.className}`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-current opacity-70 shrink-0" />
                {item.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 rounded border border-amber-400/50 px-2 py-1 text-xs bg-amber-500/20 text-amber-800 dark:text-amber-200">
              <span>★</span>
              Cliente recorrente
            </span>
          </div>
          <div className="flex items-center justify-center md:justify-end gap-2 shrink-0 flex-wrap">
            <Button
              size="sm"
              className="gap-1.5 shadow-sm"
              onClick={() => void openQuickNewAppointment()}
              disabled={quickCreateLoading || !setupStatus.ready}
            >
              <Plus size={16} />
              {quickCreateLoading ? "Buscando horário…" : "Novo agendamento"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekStart(subWeeks(weekStart, 1))}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-medium px-3 min-w-[180px] text-center">
              {format(weekStart, "d MMM", { locale: ptBR })} –{" "}
              {format(addWeeks(weekStart, 1), "d MMM yyyy", { locale: ptBR })}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      <AgendaSetupBanner ready={setupStatus.ready} issues={setupStatus.issues} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          variant={agendaView === "day" ? "default" : "outline"}
          size="sm"
          onClick={() => setAgendaView("day")}
        >
          Visão do dia
        </Button>
        <Button
          variant={agendaView === "week" ? "default" : "outline"}
          size="sm"
          onClick={() => setAgendaView("week")}
        >
          Resumo da semana
        </Button>
      </div>

      {agendaView === "week" && (
        <AgendaWeekOverview
          weekDays={weekDays}
          appointments={appointments}
          selectedDayOffset={selectedDayOffset}
          todayStr={todayStr}
          onSelectDay={(offset) => {
            setSelectedDayOffset(offset);
            setAgendaView("day");
          }}
        />
      )}

      {/* Seletor estratégico da semana — visível em todas as telas */}
      <section
        className="mb-4 rounded-xl border border-border bg-card p-3 shadow-sm md:p-4"
        aria-label="Selecionar dia da semana"
      >
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Dias da semana</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Agenda de{" "}
              <span className="font-medium text-foreground">
                {selectedDay.labelFull}, {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
              </span>
              {selectedDay.dateStr === todayStr ? " · Hoje" : ""}
              {" · "}
              Intervalos de {slotIntervalMinutes} min
            </p>
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {appointmentCountByDay[selectedDay.dateStr] ?? 0} agendamento
            {(appointmentCountByDay[selectedDay.dateStr] ?? 0) === 1 ? "" : "s"} neste dia
          </p>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {weekDays.map((d) => {
            const isSelected = d.offset === selectedDayOffset;
            const isToday = d.dateStr === todayStr;
            const count = appointmentCountByDay[d.dateStr] ?? 0;
            return (
              <Button
                key={d.dateStr}
                type="button"
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className={`
                  flex h-auto min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 sm:min-h-[5.25rem] sm:px-2
                  ${isToday && !isSelected ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background" : ""}
                `}
                onClick={() => setSelectedDayOffset(d.offset)}
              >
                <span className="text-[10px] font-medium uppercase tracking-wide opacity-90 sm:hidden">
                  {d.labelShort}
                </span>
                <span className="hidden text-[11px] font-semibold leading-tight sm:block md:text-xs">
                  {d.labelFull}
                </span>
                <span className="text-lg font-bold tabular-nums leading-none sm:text-xl">
                  {format(d.dateObj, "d")}
                </span>
                <span className="hidden text-[10px] text-muted-foreground md:block">
                  {format(d.dateObj, "MMM", { locale: ptBR })}
                </span>
                {isToday && (
                  <span
                    className={`text-[9px] font-semibold uppercase sm:text-[10px] ${
                      isSelected ? "text-primary-foreground/90" : "text-primary"
                    }`}
                  >
                    Hoje
                  </span>
                )}
                <span
                  className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium tabular-nums sm:text-[10px] ${
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : count > 0
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count === 0 ? "—" : count}
                </span>
              </Button>
            );
          })}
        </div>
      </section>

      {agendaView === "day" && (
        <CalendarView
          date={selectedDate}
          professionals={professionals}
          appointments={
            appointments as (Appointment & {
              starts_at?: string | null;
              ends_at?: string | null;
            })[]
          }
          openingTime={openingTime}
          closingTime={closingTime}
          slotIntervalMinutes={slotIntervalMinutes}
          onEmptySlotClick={handleEmptySlotClick}
          onEventClick={(appointmentId) => setEditingId(appointmentId)}
        />
      )}

      <AppointmentFormModal
        open={!!newSlot}
        onOpenChange={(o) => !o && setNewSlot(null)}
        mode="create"
        initialSlot={
          newSlot
            ? {
                professionalId: newSlot.professionalId,
                professionalName: newSlot.professionalName,
                date: newSlot.date,
                startTime: newSlot.startTime,
                serviceIds: newSlot.serviceIds,
              }
            : undefined
        }
        services={services}
        professionals={professionals}
        clients={clients}
        appointments={appointments}
        companyId={companyId}
        createdBy={user?.id ?? ""}
        onSubmit={(v) => createMutation.mutateAsync(v)}
        isLoading={createMutation.isPending}
        slotIntervalMinutes={slotIntervalMinutes}
      />

      <AppointmentFormModal
        open={!!editingId && !!appointment}
        onOpenChange={(o) => !o && setEditingId(null)}
        mode="edit"
        appointment={appointment}
        services={services}
        professionals={professionals}
        clients={clients}
        appointments={appointments}
        companyId={companyId}
        createdBy={user?.id ?? ""}
        onSubmit={(v) => updateMutation.mutateAsync(v)}
        onDelete={(id) => deleteMutation.mutateAsync(id)}
        onComplete={(id, paymentMethod) =>
          completeMutation.mutateAsync({ id, paymentMethod })
        }
        isLoading={updateMutation.isPending}
        isDeleting={deleteMutation.isPending}
        isCompleting={completeMutation.isPending}
        slotIntervalMinutes={slotIntervalMinutes}
      />
    </PageContainer>
  );
};

export default AppAgenda;
