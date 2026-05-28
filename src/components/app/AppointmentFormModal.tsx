import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMinutes, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { BookingTimeSlots } from "@/components/booking/BookingTimeSlots";
import { bookingService } from "@/services/booking.service";
import { calculateBookingDurationMinutes } from "@/lib/bookingDuration";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, CheckCircle } from "lucide-react";
import { maskPhone } from "@/lib/masks";
import { WhatsAppPhoneLink } from "@/components/ui/WhatsAppPhoneLink";
import { canOpenWhatsApp } from "@/lib/whatsapp";
import { setHours, setMinutes } from "date-fns";
import type { Appointment, ProfessionalWithServices, Service } from "@/types/database.types";
import type { CompanyClientWithVisitCount } from "@/services/client.service";
import type { AppointmentStatus } from "@/types/database.types";
import {
  canMarkAppointmentCompleted,
  getAppointmentEndDate,
  isAppointmentEligibleForFinancial,
} from "@/lib/appointmentFinancial";
import { format as formatDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DEFAULT_PAYMENT_METHOD,
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethod,
} from "@/lib/paymentMethods";

function parseTimeToDate(t: string): Date {
  const [h, m] = (typeof t === "string" ? t.slice(0, 5) : "00:00").split(":").map(Number);
  return setMinutes(setHours(new Date(2000, 0, 1), h), m);
}

function getProfessionalBusyUntil(
  profId: string,
  date: string,
  startTime: string,
  durationMin: number,
  appointments: Appointment[],
  excludeId?: string
): string | null {
  const start = parseTimeToDate(startTime).getTime();
  const end = start + durationMin * 60 * 1000;
  const active = appointments.filter(
    (a) =>
      a.professional_id === profId &&
      a.date === date &&
      a.status !== "cancelled" &&
      a.status !== "no_show" &&
      a.id !== excludeId
  );
  for (const a of active) {
    const aStart = parseTimeToDate(String(a.start_time).slice(0, 5)).getTime();
    const aEnd = aStart + a.duration_minutes * 60 * 1000;
    if (start < aEnd && end > aStart) {
      const endDate = addMinutes(parseTimeToDate(String(a.start_time).slice(0, 5)), a.duration_minutes);
      return format(endDate, "HH:mm");
    }
  }
  return null;
}

const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: "confirmed", label: "Confirmado" },
  { value: "pending", label: "Pendente" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
  { value: "blocked", label: "Bloqueado" },
  { value: "no_show", label: "Não compareceu" },
];

interface AppointmentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  /** Para create: slot clicado (professionalId opcional - usuário escolhe no form) */
  initialSlot?: {
    professionalId?: string;
    professionalName?: string;
    date: string;
    startTime: string;
    serviceIds?: string[];
  };
  /** Para edit */
  appointment?: Appointment & { service_ids?: string[] } | null;
  services: Service[];
  professionals: ProfessionalWithServices[];
  clients?: CompanyClientWithVisitCount[];
  appointments?: Appointment[];
  companyId: string;
  createdBy: string;
  onSubmit: (values: FormValues) => Promise<void>;
  onDelete?: (appointmentId: string) => Promise<void>;
  /** Concluir atendimento (status → completed): abre confirmação e cria registro financeiro */
  onComplete?: (appointmentId: string, paymentMethod: string) => Promise<void>;
  isLoading?: boolean;
  isDeleting?: boolean;
  isCompleting?: boolean;
  /** Intervalo da empresa (5, 10, 15 ou 30 min) — passo do campo de horário */
  slotIntervalMinutes?: number;
}

export interface FormValues {
  client_name: string;
  client_phone: string;
  service_ids: string[];
  professional_id: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string;
}

export function AppointmentFormModal({
  open,
  onOpenChange,
  mode,
  initialSlot,
  appointment,
  services,
  professionals,
  clients = [],
  appointments = [],
  companyId,
  createdBy,
  onSubmit,
  onDelete,
  onComplete,
  isLoading,
  isDeleting,
  isCompleting,
  slotIntervalMinutes = 15,
}: AppointmentFormModalProps) {
  const isCreate = mode === "create";
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [completePaymentMethod, setCompletePaymentMethod] = useState<PaymentMethod>(
    DEFAULT_PAYMENT_METHOD
  );

  const canComplete =
    mode === "edit" &&
    appointment &&
    canMarkAppointmentCompleted(appointment);
  const completeEndLabel =
    appointment && !canComplete
      ? formatDate(getAppointmentEndDate(appointment), "dd/MM/yyyy 'às' HH:mm", {
          locale: ptBR,
        })
      : null;

  const defaultService = services[0];
  const defaultDuration = defaultService?.duration_minutes ?? 30;

  const getDefaultValues = (): FormValues => {
    if (isCreate && initialSlot) {
      const svcIds =
        initialSlot.serviceIds?.length
          ? initialSlot.serviceIds
          : defaultService?.id
            ? [defaultService.id]
            : [];
      return {
        client_name: "",
        client_phone: "",
        service_ids: svcIds,
        professional_id: initialSlot.professionalId ?? professionals[0]?.id ?? "",
        date: initialSlot.date,
        start_time: initialSlot.startTime,
        duration_minutes: defaultDuration,
        status: "confirmed",
        notes: "",
      };
    }
    if (appointment) {
      const displayName = appointment.client_name ?? "—";
      const displayPhone = appointment.client_phone ?? "";
      const svcIds = (appointment as { service_ids?: string[] }).service_ids ?? (defaultService?.id ? [defaultService.id] : []);
      return {
        client_name: displayName,
        client_phone: displayPhone,
        service_ids: svcIds,
        professional_id: appointment.professional_id,
        date: appointment.date,
        start_time: String(appointment.start_time).slice(0, 5),
        duration_minutes: appointment.duration_minutes,
        status: appointment.status as AppointmentStatus,
        notes: appointment.notes ?? "",
      };
    }
    return {
      client_name: "",
      client_phone: "",
      service_ids: defaultService?.id ? [defaultService.id] : [],
      professional_id: professionals[0]?.id ?? "",
      date: "",
      start_time: "",
      duration_minutes: defaultDuration,
      status: "confirmed",
      notes: "",
    };
  };

  const [values, setValues] = useState<FormValues>(getDefaultValues);
  const selectedProfessional = useMemo(
    () => professionals.find((p) => p.id === values.professional_id),
    [professionals, values.professional_id]
  );
  const selectedProfessionalServiceIds = useMemo(
    () => new Set(selectedProfessional?.professional_services?.map((ps) => ps.service_id) ?? []),
    [selectedProfessional]
  );
  const filteredServices = useMemo(
    () => services.filter((service) => selectedProfessionalServiceIds.has(service.id)),
    [services, selectedProfessionalServiceIds]
  );

  const getInitialClientSelectValue = (): string => {
    const v = getDefaultValues();
    if (!v.client_name && !v.client_phone) return "";
    const match = clients.find(
      (c) =>
        (c.full_name || "").trim() === (v.client_name || "").trim() &&
        (c.phone || "").replace(/\D/g, "") === (v.client_phone || "").replace(/\D/g, "")
    );
    return match?.id ?? "__other__";
  };

  const [clientSelectValue, setClientSelectValue] = useState(getInitialClientSelectValue);

  useEffect(() => {
    if (open) {
      setValues(getDefaultValues());
      setClientSelectValue(getInitialClientSelectValue());
    }
  }, [open, isCreate, initialSlot?.date, initialSlot?.startTime, appointment?.id]);

  useEffect(() => {
    setValues((prev) => {
      const allowedServiceIds = new Set(filteredServices.map((s) => s.id));
      const nextServiceIds = prev.service_ids.filter((id) => allowedServiceIds.has(id));

      if (nextServiceIds.length === prev.service_ids.length) return prev;

      const nextDuration = calculateBookingDurationMinutes(services, nextServiceIds);

      return {
        ...prev,
        service_ids: nextServiceIds,
        duration_minutes: nextDuration || 30,
      };
    });
  }, [filteredServices, services]);

  const duration = useMemo(
    () => calculateBookingDurationMinutes(services, values.service_ids),
    [services, values.service_ids]
  );

  const serviceDurations = useMemo(
    () =>
      Object.fromEntries(services.map((s) => [s.id, s.duration_minutes])) as Record<
        string,
        number
      >,
    [services]
  );

  const canLoadSlots =
    !!companyId &&
    !!values.professional_id &&
    !!values.date &&
    values.service_ids.length > 0 &&
    duration > 0;

  const { data: slotsRaw = [], isLoading: slotsLoading } = useQuery({
    queryKey: [
      "agenda-form-slots",
      companyId,
      values.professional_id,
      values.date,
      values.service_ids,
      duration,
      slotIntervalMinutes,
      appointment?.id,
    ],
    queryFn: async () => {
      const { data, error } = await bookingService.getAvailableSlots(
        companyId,
        values.professional_id,
        values.date,
        values.service_ids,
        serviceDurations,
        duration,
        slotIntervalMinutes,
        mode === "edit" ? appointment?.id : undefined
      );
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && canLoadSlots,
    staleTime: 0,
  });

  const slots = useMemo(() => {
    if (!values.start_time) return slotsRaw;
    if (slotsRaw.some((s) => s.startTime === values.start_time)) return slotsRaw;
    const endTime = format(
      addMinutes(
        setMinutes(
          setHours(new Date(2000, 0, 1), Number(values.start_time.split(":")[0])),
          Number(values.start_time.split(":")[1] ?? 0)
        ),
        duration
      ),
      "HH:mm"
    );
    return [
      ...slotsRaw,
      {
        startTime: values.start_time,
        endTime,
        available: true as const,
      },
    ].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [slotsRaw, values.start_time, duration]);

  const selectedSlotAvailable =
    !values.start_time ||
    slots.some((s) => s.startTime === values.start_time && s.available !== false);

  const completedServicesForConfirm = useMemo(() => {
    if (!appointment?.service_ids?.length) return [];
    return appointment.service_ids
      .map((id) => services.find((s) => s.id === id))
      .filter((s): s is Service => !!s);
  }, [appointment?.service_ids, services]);

  const totalValueForConfirm = completedServicesForConfirm.reduce(
    (sum, s) => sum + (Number(s.price) ?? 0),
    0
  );

  const handleClientSelect = (value: string) => {
    setClientSelectValue(value);
    if (value === "__other__") {
      setValues((v) => ({ ...v, client_name: "", client_phone: "" }));
      return;
    }
    const c = clients.find((x) => x.id === value);
    if (c) {
      setValues((v) => ({
        ...v,
        client_name: c.full_name,
        client_phone: c.phone ?? "",
      }));
    }
  };

  const toggleService = (serviceId: string) => {
    if (!filteredServices.some((s) => s.id === serviceId)) return;
    setValues((v) => {
      const has = v.service_ids.includes(serviceId);
      const next = has
        ? v.service_ids.filter((id) => id !== serviceId)
        : [...v.service_ids, serviceId];
      const dur = calculateBookingDurationMinutes(services, next);
      return { ...v, service_ids: next, duration_minutes: dur || 30 };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (values.service_ids.length === 0) return;
    if (!values.client_name?.trim()) return;
    await onSubmit({ ...values, duration_minutes: duration });
    onOpenChange(false);
  };

  const isPast = () => {
    const d = values.date;
    const t = values.start_time;
    if (!d || !t) return false;
    const slot = new Date(`${d}T${t}`);
    return slot < new Date();
  };

  const resolvedClientPhone = useMemo(() => {
    if (values.client_phone?.trim()) return values.client_phone.trim();
    if (clientSelectValue && clientSelectValue !== "__other__") {
      const c = clients.find((x) => x.id === clientSelectValue);
      return c?.phone?.trim() ?? "";
    }
    return "";
  }, [values.client_phone, clientSelectValue, clients]);

  const isSelectedProfessionalBusy = () => {
    if (!values.professional_id || !values.date || !values.start_time) return false;
    return !!getProfessionalBusyUntil(
      values.professional_id,
      values.date,
      values.start_time,
      duration,
      appointments,
      appointment?.id
    );
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Novo Agendamento" : "Editar Agendamento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cliente */}
          <div className="space-y-2">
            <Label>Qual cliente será atendido? *</Label>
            <Select
              value={clientSelectValue}
              onValueChange={handleClientSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </SelectItem>
                ))}
                <SelectItem value="__other__">Outro (informar manualmente)</SelectItem>
              </SelectContent>
            </Select>
            {clientSelectValue === "__other__" && (
              <div className="grid grid-cols-[1fr_180px] gap-3 mt-2">
                <Input
                  id="client_name"
                  value={values.client_name}
                  onChange={(e) => setValues((v) => ({ ...v, client_name: e.target.value }))}
                  placeholder="Nome do cliente"
                  required={clientSelectValue === "__other__"}
                />
                <Input
                  id="client_phone"
                  value={values.client_phone}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, client_phone: maskPhone(e.target.value) }))
                  }
                  placeholder="(00) 00000-0000"
                  required={clientSelectValue === "__other__"}
                />
              </div>
            )}
            {clients.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum cliente cadastrado. Cadastre na aba Clientes ou use &quot;Outro&quot; para informar manualmente.
              </p>
            )}
            {canOpenWhatsApp(resolvedClientPhone) && (
              <WhatsAppPhoneLink
                phone={resolvedClientPhone}
                className="text-sm"
                message={
                  values.date && values.start_time
                    ? `Olá! Sobre seu agendamento em ${values.date} às ${String(values.start_time).slice(0, 5)}.`
                    : "Olá! Sobre seu agendamento conosco."
                }
              />
            )}
          </div>

          {/* Funcionário */}
          <div>
            <Label>Qual funcionário vai atender? *</Label>
            <Select
              value={values.professional_id}
              onValueChange={(id) => {
                const professional = professionals.find((p) => p.id === id);
                const allowedServiceIds = new Set(
                  professional?.professional_services?.map((ps) => ps.service_id) ?? []
                );
                setValues((v) => ({
                  ...v,
                  professional_id: id,
                  service_ids: v.service_ids.filter((sid) => allowedServiceIds.has(sid)),
                  duration_minutes:
                    calculateBookingDurationMinutes(
                      services,
                      v.service_ids.filter((sid) => allowedServiceIds.has(sid))
                    ) || 30,
                }));
              }}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o funcionário" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((p) => {
                  const busyUntil = getProfessionalBusyUntil(
                    p.id,
                    values.date,
                    values.start_time,
                    duration,
                    appointments,
                    appointment?.id
                  );
                  const isDisabled = !!busyUntil;
                  return (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      disabled={isDisabled}
                      className={isDisabled ? "opacity-60" : ""}
                    >
                      {isDisabled
                        ? `${p.name} — indisponível até ${busyUntil}`
                        : p.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {values.professional_id && (() => {
              const busyUntil = getProfessionalBusyUntil(
                values.professional_id,
                values.date,
                values.start_time,
                duration,
                appointments,
                appointment?.id
              );
              return busyUntil ? (
                <p className="mt-1.5 text-sm text-destructive">
                  Este funcionário está em atendimento até {busyUntil}. Selecione outro ou altere o horário.
                </p>
              ) : null;
            })()}
            {selectedProfessional?.phone && (
              <WhatsAppPhoneLink
                phone={selectedProfessional.phone}
                className="text-sm mt-1.5"
                message="Olá! Preciso falar sobre um agendamento."
              >
                WhatsApp de {selectedProfessional.name}
              </WhatsAppPhoneLink>
            )}
          </div>

          {/* Serviços (pode escolher mais de um) */}
          <div>
            <Label>Serviços * (ex: Corte + Barba)</Label>
            <div className="mt-2 flex flex-wrap gap-4 rounded-lg border border-input p-4">
              {filteredServices.map((s) => {
                const checked = values.service_ids.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleService(s.id)}
                    />
                    <span>
                      {s.name} · {s.duration_minutes}min · R$ {Number(s.price).toFixed(2)}
                    </span>
                  </label>
                );
              })}
            </div>
            {values.professional_id && filteredServices.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Este profissional não possui serviços vinculados na aba Profissionais.
              </p>
            )}
            {values.service_ids.length === 0 && (
              <p className="mt-1 text-xs text-destructive">
                Selecione ao menos um serviço
              </p>
            )}
          </div>

          {/* Status */}
          <div>
            <Label>Status</Label>
              <Select
                value={values.status}
                onValueChange={(v) =>
                  setValues((prev) => ({ ...prev, status: v as AppointmentStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={values.date}
                onChange={(e) =>
                  setValues((v) => ({ ...v, date: e.target.value, start_time: "" }))
                }
                required
              />
            </div>
            <div>
              <Label>Duração total</Label>
              <Input value={`${duration} min`} readOnly className="bg-muted" />
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <Label>Horário disponível</Label>
              <p className="text-xs text-muted-foreground">
                Intervalos de {slotIntervalMinutes} min · selecione um horário livre
              </p>
            </div>
            {!canLoadSlots ? (
              <p className="text-sm text-muted-foreground py-2">
                Selecione funcionário, data e ao menos um serviço para ver os horários.
              </p>
            ) : slotsLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Carregando horários…</p>
            ) : (
              <BookingTimeSlots
                slots={slots}
                selected={values.start_time || null}
                onSelect={(time) => setValues((v) => ({ ...v, start_time: time }))}
              />
            )}
            {values.start_time && !selectedSlotAvailable && (
              <p className="text-xs text-destructive">
                Este horário não está disponível. Escolha outro na lista.
              </p>
            )}
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Ajustar horário manualmente
              </summary>
              <Input
                id="start_time"
                type="time"
                step={slotIntervalMinutes * 60}
                value={values.start_time}
                onChange={(e) =>
                  setValues((v) => ({ ...v, start_time: e.target.value }))
                }
                className="mt-2"
                required
              />
            </details>
          </div>

          {/* Observação - em baixo */}
          <div className="border-t pt-4">
            <Label htmlFor="notes">Observação</Label>
            <Textarea
              id="notes"
              value={values.notes}
              onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
              placeholder="Ex: cliente prefere tesoura, alergia a produto, atraso permitido..."
              rows={3}
              className="mt-1"
            />
          </div>
          <DialogFooter className="flex-row justify-between sm:justify-between flex-wrap gap-2">
            <div className="flex gap-2">
              {mode === "edit" &&
                (appointment?.status === "confirmed" ||
                  appointment?.status === "pending") &&
                onComplete && (
                  <div className="flex flex-col items-start gap-1">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="gap-2"
                      onClick={() => setShowCompleteConfirm(true)}
                      disabled={
                        isLoading || isDeleting || isCompleting || !canComplete
                      }
                      title={
                        !canComplete && completeEndLabel
                          ? `Disponível após ${completeEndLabel}`
                          : undefined
                      }
                    >
                      <CheckCircle size={16} />
                      Concluir atendimento
                    </Button>
                    {!canComplete && completeEndLabel && (
                      <span className="text-[10px] text-muted-foreground max-w-[220px]">
                        Após {completeEndLabel}
                      </span>
                    )}
                  </div>
                )}
              {mode === "edit" && appointment && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(appointment.id)}
                  disabled={isLoading || isDeleting}
                >
                  <Trash2 size={16} className="mr-2" />
                  {isDeleting ? "Removendo..." : "Remover"}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  isLoading ||
                  isPast() ||
                  isSelectedProfessionalBusy() ||
                  values.service_ids.length === 0 ||
                  !values.client_name?.trim() ||
                  !values.start_time ||
                  !selectedSlotAvailable
                }
              >
                {isLoading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

    </Dialog>

    <Dialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Concluir atendimento?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">Serviços realizados:</p>
          <ul className="text-sm list-disc list-inside space-y-1">
            {completedServicesForConfirm.length > 0 ? (
              completedServicesForConfirm.map((s) => (
                <li key={s.id}>
                  {s.name} — R$ {Number(s.price).toFixed(2).replace(".", ",")}
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">Atendimento</li>
            )}
          </ul>
          <p className="text-sm font-medium pt-2 border-t">
            Valor total: R$ {totalValueForConfirm.toFixed(2).replace(".", ",")}
          </p>
          <div className="space-y-2 pt-2">
            <Label htmlFor="complete_payment_method">Forma de pagamento</Label>
            <Select
              value={completePaymentMethod}
              onValueChange={(v) => setCompletePaymentMethod(v as PaymentMethod)}
            >
              <SelectTrigger id="complete_payment_method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {appointment && (
            <p className="text-xs text-muted-foreground pt-2">
              {isAppointmentEligibleForFinancial({
                ...appointment,
                status: "completed",
              })
                ? "Será lançado no financeiro ao confirmar."
                : "No financeiro após o horário do atendimento terminar."}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowCompleteConfirm(false)}
            disabled={isCompleting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={async () => {
              if (!appointment?.id || !onComplete) return;
              if (!canMarkAppointmentCompleted(appointment)) return;
              await onComplete(appointment.id, completePaymentMethod);
              setShowCompleteConfirm(false);
              setCompletePaymentMethod(DEFAULT_PAYMENT_METHOD);
              onOpenChange(false);
            }}
            disabled={isCompleting || !canComplete}
          >
            {isCompleting ? "Concluindo..." : "Confirmar conclusão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
