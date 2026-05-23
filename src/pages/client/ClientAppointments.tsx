import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import {
  bookingService,
  type AvailableSlot,
} from "@/services/booking.service";
import { serviceService } from "@/services/service.service";
import { professionalService } from "@/services/professional.service";
import { format, parse, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { Appointment } from "@/types/database.types";
import { calculateBookingDurationMinutes } from "@/lib/bookingDuration";
import { Calendar, Clock, XCircle, CalendarClock } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  blocked: "Bloqueado",
  no_show: "Não compareceu",
};

function AppointmentCard({
  apt,
  onCancel,
  onReschedule,
  canCancel,
  canReschedule,
}: {
  apt: Appointment;
  onCancel: () => void;
  onReschedule: () => void;
  canCancel: boolean;
  canReschedule: boolean;
}) {
  const isPast = ["cancelled", "completed"].includes(apt.status ?? "");
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isPast ? "border-border bg-muted/30 opacity-80" : "border-border bg-card hover:border-primary/20"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-sm sm:text-base">
              {format(parseISO(apt.date), "d MMM yyyy", { locale: ptBR })} ·{" "}
              {(apt.start_time ?? "").slice(0, 5)}
            </span>
            <Badge
              variant={
                apt.status === "confirmed"
                  ? "default"
                  : apt.status === "completed"
                    ? "secondary"
                    : apt.status === "cancelled"
                      ? "destructive"
                      : "outline"
              }
              className="shrink-0"
            >
              {STATUS_LABELS[apt.status ?? ""] ?? apt.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{apt.duration_minutes} min</p>
        </div>
        {!isPast && (canCancel || canReschedule) && (
          <div className="flex gap-2 shrink-0">
            {canReschedule && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReschedule}
                className="gap-1"
              >
                <CalendarClock size={14} />
                Reagendar
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="gap-1 text-destructive hover:text-destructive"
              >
                <XCircle size={14} />
                Cancelar
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const ClientAppointments = () => {
  const { user } = useAuth();
  const { currentCompany } = useTenant();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [toCancel, setToCancel] = useState<Appointment | null>(null);
  const [rescheduleApt, setRescheduleApt] = useState<Appointment | null>(null);

  const { data, error } = useQuery({
    queryKey: ["appointments-client", user?.id],
    queryFn: () => bookingService.listMyAppointments(user!.id),
    enabled: !!user?.id,
  });

  const { upcoming = [], history = [] } = data ?? {};

  const cancelMutation = useMutation({
    mutationFn: (id: string) => bookingService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments-client"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setToCancel(null);
      toast({ title: "Agendamento cancelado." });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({
      id,
      date,
      start_time,
    }: {
      id: string;
      date: string;
      start_time: string;
    }) =>
      bookingService.update(id, {
        date,
        start_time,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments-client"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setRescheduleApt(null);
      toast({ title: "Agendamento reagendado!" });
    },
    onError: (e: Error) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: e.message.includes("unique") ? "Horário indisponível." : e.message,
      });
    },
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="text-2xl md:text-3xl font-bold">Meus Agendamentos</h1>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          Erro ao carregar agendamentos. Tente novamente.
        </div>
      )}

      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold mb-4">
          <Calendar size={20} className="text-primary" />
          Agendamentos
        </h2>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
            <p className="text-muted-foreground">Nenhum agendamento pendente</p>
            {currentCompany?.slug && (
              <Button
                variant="link"
                className="mt-2"
                asChild
              >
                <a href={`/client/booking?company=${currentCompany.slug}`}>Fazer um agendamento</a>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((apt) => (
              <AppointmentCard
                key={apt.id}
                apt={apt}
                canCancel={bookingService.canCancel(apt)}
                canReschedule={bookingService.canReschedule(apt)}
                onCancel={() => setToCancel(apt)}
                onReschedule={() => setRescheduleApt(apt)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold mb-4">
          <Clock size={20} className="text-muted-foreground" />
          Histórico (finalizados)
        </h2>
        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <p className="text-muted-foreground text-sm">Nenhum agendamento finalizado</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((apt) => (
              <AppointmentCard
                key={apt.id}
                apt={apt}
                canCancel={false}
                canReschedule={false}
                onCancel={() => {}}
                onReschedule={() => {}}
              />
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={!!toCancel} onOpenChange={(o) => !o && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O horário ficará disponível para outros clientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toCancel && cancelMutation.mutate(toCancel.id)}
              disabled={cancelMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? "Cancelando..." : "Sim, cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {rescheduleApt && (
        <RescheduleModal
          appointment={rescheduleApt}
          companyId={currentCompany?.id ?? ""}
          onClose={() => setRescheduleApt(null)}
          onConfirm={(date, startTime) => {
            rescheduleMutation.mutate({
              id: rescheduleApt.id,
              date: format(date, "yyyy-MM-dd"),
              start_time: startTime,
            });
          }}
          isPending={rescheduleMutation.isPending}
        />
      )}
    </div>
  );
};

function RescheduleModal({
  appointment,
  companyId,
  onClose,
  onConfirm,
  isPending,
}: {
  appointment: Appointment;
  companyId: string;
  onClose: () => void;
  onConfirm: (date: Date, startTime: string) => void;
  isPending: boolean;
}) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const { data: aptDetails } = useQuery({
    queryKey: ["appointment-detail", appointment.id],
    queryFn: () => bookingService.getById(appointment.id),
    enabled: !!appointment.id,
  });

  const serviceIds =
    (aptDetails?.data as { service_ids?: string[] } | null)?.service_ids ?? [];
  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";

  const { data: slotsData } = useQuery({
    queryKey: [
      "slots-reschedule",
      companyId,
      appointment.professional_id,
      dateStr,
      serviceIds,
    ],
    queryFn: async () => {
      const { data: services } = await serviceService.listByCompany(companyId);
      const list = services ?? [];
      const durations = list.reduce(
        (acc, s) => ({ ...acc, [s.id]: s.duration_minutes }),
        {} as Record<string, number>
      );
      const ids = serviceIds.length > 0 ? serviceIds : [];
      const totalDuration =
        ids.length > 0
          ? calculateBookingDurationMinutes(list, ids)
          : (appointment.duration_minutes ?? 30);
      const idsToUse = ids.length > 0 ? ids : ["__fallback__"];
      const durMap =
        ids.length > 0
          ? durations
          : ({ __fallback__: totalDuration } as Record<string, number>);
      return bookingService.getAvailableSlots(
        companyId,
        appointment.professional_id,
        dateStr,
        idsToUse,
        durMap,
        totalDuration
      );
    },
    enabled: !!companyId && !!dateStr,
  });

  const allSlots = slotsData?.data ?? [];
  const slots = allSlots.filter((s) => s.available !== false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
        <h3 className="text-lg font-semibold mb-4">Reagendar</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Atual: {format(parseISO(appointment.date), "d MMM yyyy", { locale: ptBR })} ·{" "}
          {(appointment.start_time ?? "").slice(0, 5)}
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nova data</label>
            <input
              type="date"
              min={format(new Date(), "yyyy-MM-dd")}
              value={selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""}
              onChange={(e) => {
                const d = e.target.value ? parse(e.target.value, "yyyy-MM-dd", new Date()) : null;
                setSelectedDate(d);
                setSelectedTime(null);
              }}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {dateStr && (
            <div>
              <label className="text-sm font-medium">Novo horário</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum horário disponível neste dia</p>
                ) : (
                  slots.map((slot) => (
                    <Button
                      key={slot.startTime}
                      variant={selectedTime === slot.startTime ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTime(slot.startTime)}
                    >
                      {slot.startTime.slice(0, 5)}
                    </Button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Voltar
          </Button>
          <Button
            onClick={() =>
              selectedDate && selectedTime && onConfirm(selectedDate, selectedTime)
            }
            disabled={!selectedDate || !selectedTime || isPending}
            className="flex-1"
          >
            {isPending ? "Salvando..." : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ClientAppointments;
