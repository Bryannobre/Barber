import { supabase } from "@/lib/supabase";
import {
  assertBoundedPositiveAmount,
  requireCompanyId,
  requireUuid,
} from "@/lib/companyScope";
import { BusinessRuleError } from "@/lib/businessRules";
import {
  getAppointmentEndDate,
  isAppointmentEligibleForFinancial,
} from "@/lib/appointmentFinancial";
import { DEFAULT_PAYMENT_METHOD, type PaymentMethod } from "@/lib/paymentMethods";
import type { Appointment, FinancialRecord, Service } from "@/types/database.types";

export interface CreateFromAppointmentParams {
  company_id: string;
  appointment_id: string;
  service_name_snapshot: string;
  professional_name_snapshot: string;
  client_name_snapshot: string;
  amount: number;
  created_by: string;
  /** Data/hora do atendimento (fim do serviço) — usada como data do lançamento */
  occurred_at?: string;
  payment_method?: PaymentMethod | string | null;
}

export interface FinancialStats {
  /** Saldo acumulado antes do período (entradas - saídas em registros anteriores) */
  openingBalance: number;
  /** Total de entradas no período */
  income: number;
  /** Total de saídas no período */
  expense: number;
  /** Saldo Atual = openingBalance + income - expense */
  balance: number;
}

export interface CreateManualParams {
  company_id: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  created_at?: string; // ISO string, default now
  created_by?: string;
}

export interface CreateFromProductPurchaseParams {
  company_id: string;
  product_name: string;
  amount: number;
  created_by?: string | null;
}

export interface CreateFromProductSaleParams {
  company_id: string;
  product_name: string;
  amount: number;
  created_by?: string | null;
}

export const financialService = {
  async createFromAppointment(params: CreateFromAppointmentParams) {
    requireCompanyId(params.company_id);
    requireUuid(params.appointment_id);
    assertBoundedPositiveAmount(Math.abs(Number(params.amount)));
    const { data, error } = await supabase
      .from("financial_records")
      .insert({
        company_id: params.company_id,
        appointment_id: params.appointment_id,
        type: "income",
        source: "appointment",
        description: `${params.service_name_snapshot} - ${params.client_name_snapshot}`,
        amount: params.amount,
        service_name_snapshot: params.service_name_snapshot,
        client_name_snapshot: params.client_name_snapshot,
        professional_name_snapshot: params.professional_name_snapshot,
        created_by: params.created_by,
        created_at: params.occurred_at ?? new Date().toISOString(),
        payment_method: params.payment_method ?? DEFAULT_PAYMENT_METHOD,
        is_valid: true,
      })
      .select()
      .single();
    return { data: data as FinancialRecord, error };
  },

  /**
   * Cria receita de um agendamento se: concluído, horário já passou e ainda não existe lançamento válido.
   */
  /**
   * Mantém lançamento de agendamento alinhado ao status e aos serviços.
   * - Concluído + horário passou → cria ou atualiza valor
   * - Concluído + horário ainda não passou → invalida antecipado
   * - Cancelado / não compareceu / outro status → invalida
   */
  async reconcileAppointmentFinancial(
    appointmentId: string,
    createdBy?: string | null
  ): Promise<{ action: "created" | "updated" | "invalidated" | "none"; error: unknown }> {
    requireUuid(appointmentId);
    const { data: apt, error: aptErr } = await supabase
      .from("appointments")
      .select(
        "id, company_id, professional_id, client_name, date, start_time, duration_minutes, status, ends_at, starts_at, created_by, payment_method"
      )
      .eq("id", appointmentId)
      .single();

    if (aptErr || !apt) return { action: "none", error: aptErr };

    const appointment = apt as Appointment;
    const status = appointment.status ?? "";

    if (["cancelled", "no_show", "blocked", "pending", "confirmed"].includes(status)) {
      const had = await this.hasValidRecordForAppointment(appointmentId);
      if (had) {
        await this.invalidateByAppointmentId(appointmentId);
        return { action: "invalidated", error: null };
      }
      return { action: "none", error: null };
    }

    if (status !== "completed") {
      return { action: "none", error: null };
    }

    if (!isAppointmentEligibleForFinancial(appointment)) {
      const had = await this.hasValidRecordForAppointment(appointmentId);
      if (had) {
        await this.invalidateByAppointmentId(appointmentId);
        return { action: "invalidated", error: null };
      }
      return { action: "none", error: null };
    }

    const snapshot = await this.buildAppointmentFinancialSnapshot(appointmentId, appointment);
    if (!snapshot) {
      return { action: "none", error: new Error("Serviço sem valor cadastrado.") };
    }

    const paymentMethod =
      appointment.payment_method ?? DEFAULT_PAYMENT_METHOD;

    const { data: existing } = await supabase
      .from("financial_records")
      .select("id, amount, payment_method")
      .eq("appointment_id", appointmentId)
      .eq("is_valid", true)
      .maybeSingle();

    if (existing?.id) {
      const currentAmount = Math.abs(Number(existing.amount));
      const amountSame = Math.abs(currentAmount - snapshot.amount) < 0.01;
      const paymentSame = (existing.payment_method ?? null) === paymentMethod;
      if (amountSame && paymentSame) {
        return { action: "none", error: null };
      }
      const { error } = await supabase
        .from("financial_records")
        .update({
          amount: snapshot.amount,
          description: `${snapshot.serviceNames} - ${snapshot.clientName}`,
          service_name_snapshot: snapshot.serviceNames,
          client_name_snapshot: snapshot.clientName,
          professional_name_snapshot: snapshot.professionalName,
          created_at: snapshot.occurredAt,
          payment_method: paymentMethod,
        })
        .eq("id", existing.id);
      return { action: "updated", error };
    }

    const { error } = await this.createFromAppointment({
      company_id: appointment.company_id,
      appointment_id: appointmentId,
      service_name_snapshot: snapshot.serviceNames,
      professional_name_snapshot: snapshot.professionalName,
      client_name_snapshot: snapshot.clientName,
      amount: snapshot.amount,
      created_by: createdBy ?? appointment.created_by ?? "",
      occurred_at: snapshot.occurredAt,
      payment_method: paymentMethod,
    });
    return { action: "created", error };
  },

  async buildAppointmentFinancialSnapshot(
    appointmentId: string,
    appointment: Appointment
  ): Promise<{
    serviceNames: string;
    professionalName: string;
    clientName: string;
    amount: number;
    occurredAt: string;
  } | null> {
    const { data: svcLinks } = await supabase
      .from("appointment_services")
      .select("service_id")
      .eq("appointment_id", appointmentId);
    const serviceIds = (svcLinks ?? []).map((s) => s.service_id);

    let services: (Service & { price?: number })[] = [];
    if (serviceIds.length > 0) {
      const { data: servicesData } = await supabase
        .from("services")
        .select("id, name, price")
        .in("id", serviceIds);
      services = (servicesData ?? []) as (Service & { price?: number })[];
    }

    const { data: profData } = await supabase
      .from("professionals")
      .select("name")
      .eq("id", appointment.professional_id)
      .single();

    const professionalName = (profData as { name?: string } | null)?.name ?? "—";
    const clientName = appointment.client_name ?? "Cliente";
    const serviceNames =
      services.map((s) => s.name).filter(Boolean).join(" + ") || "Atendimento";
    const amount = services.reduce((sum, s) => sum + (Number(s.price) ?? 0), 0);

    if (amount <= 0) return null;

    return {
      serviceNames,
      professionalName,
      clientName,
      amount,
      occurredAt: getAppointmentEndDate(appointment).toISOString(),
    };
  },

  async tryCreateFinancialFromAppointment(
    appointmentId: string,
    createdBy?: string | null
  ): Promise<{ created: boolean; error: unknown }> {
    requireUuid(appointmentId);
    const { data: apt, error: aptErr } = await supabase
      .from("appointments")
      .select(
        "id, company_id, professional_id, client_name, date, start_time, duration_minutes, status, ends_at, starts_at, created_by, payment_method"
      )
      .eq("id", appointmentId)
      .single();

    if (aptErr || !apt) return { created: false, error: aptErr };

    const appointment = apt as Appointment;
    const result = await this.reconcileAppointmentFinancial(appointmentId, createdBy);
    return {
      created: result.action === "created",
      error: result.error,
    };
  },

  /**
   * Sincroniza receitas de agendamentos concluídos cujo horário já passou.
   * Invalida lançamentos antecipados (concluído antes do fim do horário).
   */
  async syncAppointmentRevenue(companyId: string, createdBy?: string | null) {
    requireCompanyId(companyId);
    const { data: validAppointmentRecords, error: listErr } = await supabase
      .from("financial_records")
      .select("id, appointment_id")
      .eq("company_id", companyId)
      .eq("source", "appointment")
      .eq("is_valid", true)
      .not("appointment_id", "is", null);

    if (listErr) return { synced: 0, error: listErr };

    for (const rec of validAppointmentRecords ?? []) {
      if (!rec.appointment_id) continue;
      const { data: apt } = await supabase
        .from("appointments")
        .select("status, date, start_time, duration_minutes, ends_at, starts_at")
        .eq("id", rec.appointment_id)
        .single();
      if (!apt || !isAppointmentEligibleForFinancial(apt as Appointment)) {
        await this.invalidateByAppointmentId(rec.appointment_id);
      }
    }

    const { data: completedRows, error: aptErr } = await supabase
      .from("appointments")
      .select("id, status, date, start_time, duration_minutes, ends_at, starts_at")
      .eq("company_id", companyId)
      .eq("status", "completed");

    if (aptErr) return { synced: 0, error: aptErr };

    let synced = 0;
    for (const row of completedRows ?? []) {
      const { action, error } = await this.reconcileAppointmentFinancial(
        row.id,
        createdBy
      );
      if (error) return { synced, error };
      if (action === "created" || action === "updated") synced += 1;
    }

    return { synced, error: null };
  },

  /** Despesa: compra de produto (entrada de estoque com preço de custo). */
  async createFromProductPurchase(params: CreateFromProductPurchaseParams) {
    requireCompanyId(params.company_id);
    const amount = Math.abs(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { data: null, error: new Error("Valor inválido para compra de produto") };
    }
    assertBoundedPositiveAmount(amount);
    const { data, error } = await supabase
      .from("financial_records")
      .insert({
        company_id: params.company_id,
        appointment_id: null,
        type: "expense",
        source: "product_purchase",
        description: `Compra de produto - ${params.product_name}`,
        amount,
        created_by: params.created_by ?? null,
        is_valid: true,
      })
      .select()
      .single();
    return { data: data as FinancialRecord, error };
  },

  /** Receita: venda de produto. */
  async createFromProductSale(params: CreateFromProductSaleParams) {
    requireCompanyId(params.company_id);
    const amount = Math.abs(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { data: null, error: new Error("Valor inválido para venda de produto") };
    }
    assertBoundedPositiveAmount(amount);
    const { data, error } = await supabase
      .from("financial_records")
      .insert({
        company_id: params.company_id,
        appointment_id: null,
        type: "income",
        source: "product_sale",
        description: `Venda de produto - ${params.product_name}`,
        amount,
        created_by: params.created_by ?? null,
        is_valid: true,
      })
      .select()
      .single();
    return { data: data as FinancialRecord, error };
  },

  async invalidateByAppointmentId(appointmentId: string) {
    const { error } = await supabase
      .from("financial_records")
      .update({ is_valid: false })
      .eq("appointment_id", appointmentId)
      .eq("source", "appointment");
    return { error };
  },

  async hasValidRecordForAppointment(appointmentId: string): Promise<boolean> {
    const { data } = await supabase
      .from("financial_records")
      .select("id")
      .eq("appointment_id", appointmentId)
      .eq("is_valid", true)
      .limit(1);
    return (data?.length ?? 0) > 0;
  },

  async listByCompany(
    companyId: string,
    opts?: { startDate?: string; endDate?: string; validOnly?: boolean }
  ) {
    requireCompanyId(companyId);
    let query = supabase
      .from("financial_records")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (opts?.validOnly !== false) {
      query = query.eq("is_valid", true);
    }
    if (opts?.startDate) {
      query = query.gte("created_at", `${opts.startDate}T00:00:00`);
    }
    if (opts?.endDate) {
      query = query.lte("created_at", `${opts.endDate}T23:59:59`);
    }

    const { data, error } = await query;
    return { data: (data ?? []) as FinancialRecord[], error };
  },

  async createManual(params: CreateManualParams) {
    requireCompanyId(params.company_id);
    if (params.type !== "income" && params.type !== "expense") {
      return { data: null, error: new BusinessRuleError("Tipo de lançamento inválido.", "FIN_TYPE") };
    }
    const amount = Math.abs(Number(params.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return { data: null, error: new BusinessRuleError("O valor deve ser maior que zero.", "FIN_AMOUNT") };
    }
    assertBoundedPositiveAmount(amount);
    const desc = params.description?.trim() ?? "";
    if (!desc || desc.length > 2000) {
      return { data: null, error: new BusinessRuleError("Descrição obrigatória (máx. 2000 caracteres).", "FIN_DESC") };
    }
    const { data, error } = await supabase
      .from("financial_records")
      .insert({
        company_id: params.company_id,
        appointment_id: null,
        type: params.type,
        source: "manual",
        description: desc,
        amount,
        created_at: params.created_at ?? new Date().toISOString(),
        created_by: params.created_by ?? null,
        is_valid: true,
      })
      .select()
      .single();
    return { data: data as FinancialRecord, error };
  },

  async getStats(
    companyId: string,
    opts: { startDate: string; endDate: string }
  ): Promise<{ data: FinancialStats; error: unknown }> {
    requireCompanyId(companyId);
    const periodStart = `${opts.startDate}T00:00:00`;
    const periodEnd = `${opts.endDate}T23:59:59`;

    const { data: recordsBefore, error: errBefore } = await supabase
      .from("financial_records")
      .select("type, amount")
      .eq("company_id", companyId)
      .eq("is_valid", true)
      .lt("created_at", periodStart);

    if (errBefore) {
      return {
        data: { openingBalance: 0, income: 0, expense: 0, balance: 0 },
        error: errBefore,
      };
    }

    let openingBalance = 0;
    (recordsBefore ?? []).forEach((r) => {
      const amt = Math.abs(Number(r.amount));
      openingBalance += r.type === "income" ? amt : -amt;
    });

    const { data: recordsInPeriod, error } = await supabase
      .from("financial_records")
      .select("type, amount")
      .eq("company_id", companyId)
      .eq("is_valid", true)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd);

    if (error) {
      return {
        data: { openingBalance, income: 0, expense: 0, balance: openingBalance },
        error,
      };
    }

    let income = 0;
    let expense = 0;
    (recordsInPeriod ?? []).forEach((r) => {
      if (r.type === "income") income += Number(r.amount);
      else expense += Math.abs(Number(r.amount));
    });

    return {
      data: {
        openingBalance,
        income,
        expense,
        balance: openingBalance + income - expense,
      },
      error: null,
    };
  },
};
