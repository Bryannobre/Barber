import { supabase } from "@/lib/supabase";
import { requireCompanyId, requireUuid } from "@/lib/companyScope";
import { addMinutes, parse, format, setHours, setMinutes } from "date-fns";
import type { Appointment, Service } from "@/types/database.types";
import { financialService } from "@/services/financial.service";
import { BOOKING_SLOT_INTERVAL_MINUTES } from "@/lib/bookingDuration";

export interface CreateAppointmentParams {
  company_id: string;
  client_id: string;
  professional_id: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  service_ids: string[];
  status?: "pending" | "confirmed" | "blocked";
  notes?: string | null;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
}

/** Params para cliente criar agendamento público (walk-in, sem conta) */
export interface CreateClientBookingParams {
  company_id: string;
  professional_id: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  service_ids: string[];
  client_name: string;
  client_phone: string;
  client_email?: string;
  status?: Appointment["status"];
}

/** Params para admin criar agendamento (cliente walk-in, sem conta) */
export interface CreateAdminAppointmentParams {
  company_id: string;
  client_name: string;
  client_phone: string;
  client_email?: string;
  professional_id: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  service_ids: string[];
  status?: Appointment["status"];
  notes?: string | null;
  created_by: string;
}

/** Params para atualizar agendamento */
export interface UpdateAppointmentParams {
  client_name?: string;
  client_phone?: string;
  professional_id?: string;
  date?: string;
  start_time?: string;
  duration_minutes?: number;
  status?: Appointment["status"];
  notes?: string | null;
  service_ids?: string[];
  /** Usuário que alterou (para auditoria financeira) */
  updated_by?: string;
}

export interface AvailableSlot {
  startTime: string;
  endTime: string;
  /** false se horário já passou ou está ocupado */
  available?: boolean;
  /** Motivo quando available=false */
  unavailableReason?: "past" | "occupied";
}

const DEFAULT_OPENING_TIME = "09:00";
const DEFAULT_CLOSING_TIME = "19:00";

/** Data yyyy-MM-dd no fuso local (evita getDay errado com new Date('yyyy-MM-dd') em UTC). */
function parseLocalDate(date: string): Date {
  return parse(date, "yyyy-MM-dd", new Date());
}

function isExclusionViolation(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === "23P01" ||
    (error?.message?.includes("no_overlap_per_professional") ?? false)
  );
}

function normalizeTime(value: string | null | undefined, fallback = "00:00") {
  return typeof value === "string" ? value.slice(0, 5) : fallback;
}

function timeToMinutes(value: string) {
  const [h, m] = normalizeTime(value, "00:00").split(":").map(Number);
  return h * 60 + m;
}

function ceilToSlotBoundary(minutes: number, step: number) {
  return Math.ceil(minutes / step) * step;
}

export const bookingService = {
  async listByCompany(companyId: string, startDate?: string, endDate?: string) {
    requireCompanyId(companyId);
    let query = supabase
      .from("appointments")
      .select("*")
      .eq("company_id", companyId)
      .order("date")
      .order("start_time");

    if (startDate) query = query.gte("date", startDate);
    if (endDate) query = query.lte("date", endDate);

    const { data, error } = await query;
    return { data: (data ?? []) as Appointment[], error };
  },

  async listByClient(clientId: string) {
    requireUuid(clientId);
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("client_id", clientId)
      .order("date", { ascending: false })
      .order("start_time");
    return { data: (data ?? []) as Appointment[], error };
  },

  /** Lista agendamentos do cliente: não finalizados (em cima) e finalizados no histórico (embaixo) */
  async listMyAppointments(userId: string) {
    requireUuid(userId);
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("client_id", userId)
      .order("date", { ascending: false })
      .order("start_time", { ascending: false });
    if (error) return { upcoming: [], history: [], error };

    const all = (data ?? []) as Appointment[];
    const isFinalizado = (a: Appointment) =>
      ["cancelled", "completed"].includes(a.status ?? "");
    const notFinalizados = all
      .filter((a) => !isFinalizado(a))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return ((a.start_time ?? "") as string).localeCompare((b.start_time ?? "") as string);
      });
    const finalizados = all
      .filter(isFinalizado)
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return ((b.start_time ?? "") as string).localeCompare((a.start_time ?? "") as string);
      });
    return { upcoming: notFinalizados, history: finalizados, error: null };
  },

  /** Verifica se pode cancelar (até 2h antes) */
  canCancel(appointment: { date: string; start_time?: string | null }) {
    const aptStart = new Date(`${appointment.date}T${(appointment.start_time ?? "00:00").slice(0, 5)}`);
    const twoHoursBefore = new Date(aptStart.getTime() - 2 * 60 * 60 * 1000);
    return new Date() < twoHoursBefore;
  },

  /** Verifica se pode reagendar (não passou, status ativo) */
  canReschedule(appointment: { date: string; start_time?: string | null; status?: string | null }) {
    if (["cancelled", "completed"].includes(appointment.status ?? "")) return false;
    const aptStart = new Date(`${appointment.date}T${(appointment.start_time ?? "00:00").slice(0, 5)}`);
    return new Date() < aptStart;
  },

  async listByProfessionalAndDate(professionalId: string, date: string) {
    requireUuid(professionalId);
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("professional_id", professionalId)
      .eq("date", date)
      .in("status", ["pending", "confirmed", "blocked"])
      .order("start_time");
    return { data: (data ?? []) as Appointment[], error };
  },

  /**
   * Obtém slots. Usa RPC get_busy_periods (bypassa RLS) para períodos ocupados,
   * gera todos os slots no cliente e desabilita apenas os que sobrepõem.
   */
  async getAvailableSlots(
    companyId: string,
    professionalId: string,
    date: string,
    serviceIds: string[],
    serviceDurations: Record<string, number>,
    /** Quando informado, usa duração já calculada (execution_mode sequential/parallel). */
    totalDurationMinutes?: number
  ): Promise<{ data: AvailableSlot[]; error: unknown }> {
    requireCompanyId(companyId);
    requireUuid(professionalId);
    const totalDuration =
      totalDurationMinutes ??
      serviceIds.reduce((acc, sid) => acc + (serviceDurations[sid] ?? 0), 0);
    if (totalDuration <= 0) return { data: [], error: null };

    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("opening_time, closing_time")
      .eq("id", companyId)
      .single();

    if (companyError) return { data: [], error: companyError };

    const companyOpen = timeToMinutes(
      normalizeTime(companyData?.opening_time, DEFAULT_OPENING_TIME)
    );
    const companyClose = timeToMinutes(
      normalizeTime(companyData?.closing_time, DEFAULT_CLOSING_TIME)
    );

    if (companyClose <= companyOpen) return { data: [], error: null };

    const dayOfWeek = parseLocalDate(date).getDay();
    const { data: wh, error: whError } = await supabase
      .from("working_hours")
      .select("*")
      .eq("professional_id", professionalId)
      .eq("day_of_week", dayOfWeek);

    if (whError) return { data: [], error: whError };
    if (!wh?.length) return { data: [], error: null };

    const { data: busyData } = await supabase.rpc("get_busy_periods", {
      p_professional_id: professionalId,
      p_date: date,
    });
    const busyPeriods = (Array.isArray(busyData) ? busyData : []) as {
      start_time?: string;
      duration_minutes?: number;
    }[];

    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const slots: AvailableSlot[] = [];
    const dayBase = parseLocalDate(date);
    const slotStep = BOOKING_SLOT_INTERVAL_MINUTES;

    for (const w of wh) {
      const profStart = timeToMinutes(normalizeTime(w.start_time, DEFAULT_OPENING_TIME));
      const profEnd = timeToMinutes(normalizeTime(w.end_time, DEFAULT_CLOSING_TIME));

      const effectiveStart = ceilToSlotBoundary(
        Math.max(profStart, companyOpen),
        slotStep
      );
      const effectiveEnd = Math.min(profEnd, companyClose);

      if (effectiveEnd <= effectiveStart) continue;

      let current = setMinutes(
        setHours(dayBase, Math.floor(effectiveStart / 60)),
        effectiveStart % 60
      );
      const end = setMinutes(
        setHours(dayBase, Math.floor(effectiveEnd / 60)),
        effectiveEnd % 60
      );

      while (addMinutes(current, totalDuration) <= end) {
        const startTime = format(current, "HH:mm");
        const endTime = format(addMinutes(current, totalDuration), "HH:mm");

        const overlaps = busyPeriods.some((apt) => {
          const aptStart = parse(normalizeTime(apt.start_time), "HH:mm", new Date());
          const aptEnd = addMinutes(aptStart, apt.duration_minutes ?? 0);
          const slotStart = parse(startTime, "HH:mm", new Date());
          const slotEnd = parse(endTime, "HH:mm", new Date());
          return slotStart < aptEnd && slotEnd > aptStart;
        });

        const isPast =
          date === today && timeToMinutes(startTime) < nowMinutes;

        const available = !overlaps && !isPast;
        slots.push({
          startTime,
          endTime,
          available,
          unavailableReason: !available
            ? isPast
              ? "past"
              : "occupied"
            : undefined,
        });

        current = addMinutes(current, slotStep);
      }
    }

    const ordered = slots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    const deduped = ordered.filter(
      (slot, index, arr) => index === 0 || arr[index - 1].startTime !== slot.startTime
    );

    return { data: deduped, error: null };
  },

  /**
   * Cria agendamento pelo fluxo público (landing).
   * Se client_id fornecido (usuário logado), usa create().
   * Caso contrário, usa RPC create_public_appointment (walk-in).
   */
  async createClientBooking(params: CreateClientBookingParams, clientId?: string | null) {
    requireCompanyId(params.company_id);
    requireUuid(params.professional_id);
    if (clientId) {
      requireUuid(clientId);
      return this.create({
        company_id: params.company_id,
        client_id: clientId,
        professional_id: params.professional_id,
        date: params.date,
        start_time: params.start_time,
        duration_minutes: params.duration_minutes,
        service_ids: params.service_ids,
        status: params.status ?? "confirmed",
        client_name: params.client_name,
        client_phone: params.client_phone,
        client_email: params.client_email,
      });
    }

    const { data, error } = await supabase.rpc("create_public_appointment", {
      p_company_id: params.company_id,
      p_professional_id: params.professional_id,
      p_date: params.date,
      p_start_time: params.start_time,
      p_duration_minutes: params.duration_minutes,
      p_service_ids: params.service_ids,
      p_client_name: params.client_name,
      p_client_phone: params.client_phone,
      p_client_email: params.client_email ?? null,
    });

    if (error) {
      if (import.meta.env.DEV) {
        console.error("[booking.service] create_public_appointment RPC error:", error);
      }
      return { data: null, error };
    }

    const result = data as { success?: boolean; error?: string; appointment_id?: string } | null;
    if (!result?.success) {
      const errMsg = result?.error ?? "Falha ao criar agendamento";
      if (import.meta.env.DEV) {
        console.error("[booking.service] create_public_appointment rejected:", errMsg);
      }
      return {
        data: null,
        error: new Error(errMsg),
      };
    }

    // Walk-in: anon não consegue SELECT via RLS; retornamos objeto mínimo para UX
    return {
      data: {
        id: result.appointment_id!,
        company_id: params.company_id,
        professional_id: params.professional_id,
        date: params.date,
        start_time: params.start_time,
        duration_minutes: params.duration_minutes,
        client_name: params.client_name,
        client_phone: params.client_phone,
      } as Appointment,
      error: null,
    };
  },

  async create(params: CreateAppointmentParams) {
    requireCompanyId(params.company_id);
    requireUuid(params.client_id);
    requireUuid(params.professional_id);
    for (const sid of params.service_ids) {
      requireUuid(sid);
    }
    const { data: existing } = await this.listByProfessionalAndDate(
      params.professional_id,
      params.date
    );
    const overlaps = (existing ?? []).some((apt) => {
      const aptStart = parse(normalizeTime(apt.start_time), "HH:mm", new Date());
      const aptEnd = addMinutes(aptStart, apt.duration_minutes);
      const slotStart = parse(normalizeTime(params.start_time), "HH:mm", new Date());
      const slotEnd = addMinutes(slotStart, params.duration_minutes);
      return slotStart < aptEnd && slotEnd > aptStart;
    });
    if (overlaps) {
      return {
        data: null,
        error: new Error("Horário indisponível. Este profissional já tem um agendamento neste horário."),
      };
    }

    const insert: Record<string, unknown> = {
      company_id: params.company_id,
      client_id: params.client_id,
      professional_id: params.professional_id,
      date: params.date,
      start_time: params.start_time,
      duration_minutes: params.duration_minutes,
      status: params.status ?? "confirmed",
      notes: params.notes ?? null,
    };
    if (params.client_name != null) insert.client_name = params.client_name;
    if (params.client_phone != null) insert.client_phone = params.client_phone;
    if (params.client_email != null) insert.client_email = params.client_email;

    const { data: apt, error: aptError } = await supabase
      .from("appointments")
      .insert(insert)
      .select()
      .single();

    if (aptError) {
      if (aptError.code === "23505" || isExclusionViolation(aptError)) {
        return {
          data: null,
          error: new Error("Horário indisponível. Outro cliente acabou de agendar."),
        };
      }
      return { data: null, error: aptError };
    }

    if (params.service_ids.length > 0) {
      const { error: svcError } = await supabase.from("appointment_services").insert(
        params.service_ids.map((sid) => ({
          appointment_id: (apt as Appointment).id,
          service_id: sid,
        }))
      );
      if (svcError) {
        await supabase.from("appointments").delete().eq("id", (apt as Appointment).id);
        if (isExclusionViolation(svcError)) {
          return {
            data: null,
            error: new Error("Horário indisponível. Outro cliente acabou de agendar."),
          };
        }
        return { data: null, error: svcError };
      }
    }

    return { data: apt as Appointment, error: null };
  },

  async cancel(id: string) {
    requireUuid(id);
    return this.updateStatus(id, "cancelled");
  },

  async updateStatus(id: string, status: Appointment["status"]) {
    requireUuid(id);
    const { data, error } = await supabase
      .from("appointments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    return { data: data as Appointment | null, error };
  },

  async getById(id: string) {
    requireUuid(id);
    const { data: apt, error: aptError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", id)
      .single();
    if (aptError || !apt) return { data: null, error: aptError };
    const { data: svcLinks } = await supabase
      .from("appointment_services")
      .select("service_id")
      .eq("appointment_id", id);
    const serviceIds = (svcLinks ?? []).map((s) => s.service_id);
    let client_name = (apt as Appointment).client_name;
    let client_phone = (apt as Appointment).client_phone;
    if (
      ((apt as Appointment).client_id && !client_name) ||
      ((apt as Appointment).client_id && !client_phone)
    ) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", (apt as Appointment).client_id)
        .single();
      if (prof) {
        client_name = client_name ?? prof?.full_name ?? null;
        client_phone = client_phone ?? prof?.phone ?? null;
      }
    }
    return {
      data: {
        ...apt,
        client_name,
        client_phone,
        service_ids: serviceIds,
      } as Appointment & { service_ids: string[] },
      error: null,
    };
  },

  async createAdmin(params: CreateAdminAppointmentParams) {
    requireCompanyId(params.company_id);
    requireUuid(params.professional_id);
    requireUuid(params.created_by);
    for (const sid of params.service_ids ?? []) {
      requireUuid(sid);
    }
    const { data: existing } = await this.listByProfessionalAndDate(
      params.professional_id,
      params.date
    );
    const overlaps = (existing ?? []).some((apt) => {
      const aptStart = parse(normalizeTime(apt.start_time), "HH:mm", new Date());
      const aptEnd = addMinutes(aptStart, apt.duration_minutes);
      const slotStart = parse(normalizeTime(params.start_time), "HH:mm", new Date());
      const slotEnd = addMinutes(slotStart, params.duration_minutes);
      return slotStart < aptEnd && slotEnd > aptStart;
    });
    if (overlaps) {
      return {
        data: null,
        error: new Error("Horário indisponível. Este profissional já tem um agendamento neste horário."),
      };
    }

    let companyClientId: string | null = null;
    if (params.client_phone?.trim()) {
      const { data: ccId } = await supabase.rpc("get_or_create_company_client", {
        p_company_id: params.company_id,
        p_full_name: params.client_name.trim(),
        p_phone: params.client_phone.trim(),
        p_email: params.client_email?.trim() || null,
      });
      companyClientId = ccId as string | null;
    }

    const insertPayload = {
      company_id: params.company_id,
      client_id: null,
      company_client_id: companyClientId,
      client_name: params.client_name,
      client_phone: params.client_phone,
      client_email: params.client_email || null,
      professional_id: params.professional_id,
      date: params.date,
      start_time: params.start_time,
      duration_minutes: params.duration_minutes,
      status: params.status ?? "confirmed",
      notes: params.notes ?? null,
      created_by: params.created_by,
    };

    const { data: apt, error: aptError } = await supabase
      .from("appointments")
      .insert(insertPayload)
      .select()
      .single();

    if (aptError) {
      if (aptError.code === "23505") {
        return {
          data: null,
          error: new Error("Horário indisponível. Outro cliente acabou de agendar."),
        };
      }
      return { data: null, error: aptError };
    }

    if (params.service_ids?.length) {
      await supabase.from("appointment_services").insert(
        params.service_ids.map((sid) => ({
          appointment_id: (apt as Appointment).id,
          service_id: sid,
        }))
      );
    }

    if (params.status === "completed") {
      const serviceIds = params.service_ids ?? [];
      const { data: servicesData } = serviceIds.length
        ? await supabase.from("services").select("id, name, price").in("id", serviceIds)
        : { data: [] as { id: string; name: string; price: number }[] };
      const services = (servicesData ?? []) as (Service & { price?: number })[];
      const { data: profData } = await supabase
        .from("professionals")
        .select("name")
        .eq("id", params.professional_id)
        .single();
      const professionalName = (profData as { name?: string } | null)?.name ?? "—";
      const clientName = params.client_name ?? "Cliente";
      const serviceNames = services.map((s) => s.name).filter(Boolean).join(" + ") || "Atendimento";
      const amount = services.reduce((sum, s) => sum + (Number(s.price) ?? 0), 0);
      await financialService.createFromAppointment({
        company_id: params.company_id,
        appointment_id: (apt as Appointment).id,
        service_name_snapshot: serviceNames,
        professional_name_snapshot: professionalName,
        client_name_snapshot: clientName,
        amount,
        created_by: params.created_by ?? "",
      });
    }

    return { data: apt as Appointment, error: null };
  },

  async update(id: string, params: UpdateAppointmentParams) {
    requireUuid(id);
    if (params.professional_id !== undefined) requireUuid(params.professional_id);
    if (params.service_ids !== undefined) {
      for (const sid of params.service_ids) {
        requireUuid(sid);
      }
    }
    const { data: oldApt, error: fetchErr } = await supabase
      .from("appointments")
      .select("status, professional_id, date, start_time, duration_minutes")
      .eq("id", id)
      .single();
    const oldStatus = fetchErr ? null : (oldApt?.status as Appointment["status"] | null);
    const old = oldApt as { professional_id?: string; date?: string; start_time?: string; duration_minutes?: number } | null;

    const willChangeSlot =
      params.date !== undefined ||
      params.start_time !== undefined ||
      params.duration_minutes !== undefined ||
      params.professional_id !== undefined;
    if (willChangeSlot && old) {
      const profId = params.professional_id ?? old.professional_id;
      const date = params.date ?? old.date;
      const startTime = params.start_time ?? old.start_time;
      const duration = params.duration_minutes ?? old.duration_minutes ?? 0;
      if (profId && date && startTime) {
        const { data: existing } = await this.listByProfessionalAndDate(profId, date);
        const overlaps = (existing ?? [])
          .filter((a) => a.id !== id)
          .some((apt) => {
            const aptStart = parse(normalizeTime(apt.start_time), "HH:mm", new Date());
            const aptEnd = addMinutes(aptStart, apt.duration_minutes);
            const slotStart = parse(normalizeTime(startTime), "HH:mm", new Date());
            const slotEnd = addMinutes(slotStart, duration);
            return slotStart < aptEnd && slotEnd > aptStart;
          });
        if (overlaps) {
          return {
            data: null,
            error: new Error("Horário indisponível. Este profissional já tem um agendamento neste horário."),
          };
        }
      }
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      ...(params.client_name !== undefined && { client_name: params.client_name }),
      ...(params.client_phone !== undefined && { client_phone: params.client_phone }),
      ...(params.professional_id !== undefined && { professional_id: params.professional_id }),
      ...(params.date !== undefined && { date: params.date }),
      ...(params.start_time !== undefined && { start_time: params.start_time }),
      ...(params.duration_minutes !== undefined && { duration_minutes: params.duration_minutes }),
      ...(params.status !== undefined && { status: params.status }),
      ...(params.notes !== undefined && { notes: params.notes }),
    };

    const { data: apt, error: aptError } = await supabase
      .from("appointments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (aptError) {
      if (aptError.code === "23505" || isExclusionViolation(aptError)) {
        return {
          data: null,
          error: new Error("Horário indisponível. Outro cliente acabou de agendar."),
        };
      }
      return { data: null, error: aptError };
    }

    if (params.service_ids !== undefined) {
      await supabase.from("appointment_services").delete().eq("appointment_id", id);
      if (params.service_ids.length > 0) {
        await supabase.from("appointment_services").insert(
          params.service_ids.map((sid) => ({ appointment_id: id, service_id: sid }))
        );
      }
    }

    const newStatus = (apt as Appointment).status;

    if (params.status !== undefined && oldStatus !== newStatus) {
      if (newStatus === "completed") {
        await financialService.tryCreateFinancialFromAppointment(
          id,
          params.updated_by
        );
      } else if (oldStatus === "completed") {
        await financialService.invalidateByAppointmentId(id);
      }
    }

    return { data: apt as Appointment, error: null };
  },

  async delete(id: string) {
    requireUuid(id);
    await financialService.invalidateByAppointmentId(id);
    // appointment_services: ON DELETE CASCADE (não deletar manualmente — trigger de duração gerava 400)
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error && import.meta.env.DEV) {
      console.error("[booking.service] delete appointment:", error);
    }
    return { error };
  },

  async getTodayStats(companyId: string) {
    requireCompanyId(companyId);
    const today = new Date().toISOString().slice(0, 10);
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("id, status, duration_minutes")
      .eq("company_id", companyId)
      .eq("date", today)
      .in("status", ["pending", "confirmed"]);

    if (error) return { appointmentsToday: 0, totalDuration: 0 };

    const appointmentsToday = appointments?.length ?? 0;
    const totalDuration =
      appointments?.reduce((acc, a) => acc + (a.duration_minutes ?? 0), 0) ?? 0;

    return { appointmentsToday, totalDuration };
  },
};
