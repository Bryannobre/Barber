import { supabase } from "@/lib/supabase";
import { requireCompanyId } from "@/lib/companyScope";
import { getPaymentChartLabel } from "@/lib/paymentMethods";
import type { Appointment, Service, Professional } from "@/types/database.types";

export interface ReportsFilters {
  startDate: string;
  endDate: string;
  professionalId?: string;
  serviceId?: string;
}

export interface ReportMetrics {
  faturamentoTotal: number;
  faturamentoServicos: number;
  faturamentoProdutos: number;
  lucroEstimado: number;
  totalAgendamentos: number;
  agendamentosConcluidos: number;
  ticketMedio: number;
  servicosRealizados: number;
  cancelamentos: number;
  confirmados: number;
  taxaConversao: number;
}

export interface RankingProfissional {
  professionalId: string;
  professionalName: string;
  atendimentos: number;
  faturamentoGerado: number;
  ticketMedio: number;
}

export interface HorarioMovimentado {
  hora: string;
  count: number;
}

export interface FaturamentoPorPeriodoItem {
  date: string;
  valor: number;
}

export interface ServicoMaisVendido {
  serviceId: string;
  serviceName: string;
  quantidade: number;
  faturamentoGerado: number;
}

export interface ProdutividadeProfissional {
  professionalId: string;
  professionalName: string;
  atendimentos: number;
  valorGerado: number;
}

export interface StatusDistribuicao {
  status: string;
  count: number;
}

export interface PaymentMethodReportPoint {
  method: string;
  value: number;
}

export interface AppointmentReportRow {
  id: string;
  date: string;
  startTime: string;
  clientName: string;
  serviceNames: string;
  professionalName: string;
  valor: number;
  status: string;
  notes: string | null;
  paymentMethod: string | null;
  /** Concluído mas receita ainda não lançada no financeiro */
  revenuePending: boolean;
}

async function getAppointmentsWithDetails(
  companyId: string,
  filters: ReportsFilters
) {
  requireCompanyId(companyId);
  let query = supabase
    .from("appointments")
    .select("*, appointment_services(service_id)")
    .eq("company_id", companyId)
    .gte("date", filters.startDate)
    .lte("date", filters.endDate);

  if (filters.professionalId) {
    query = query.eq("professional_id", filters.professionalId);
  }

  const { data: appointments, error } = await query.order("date").order("start_time");

  if (error) return { data: [], error };

  const apts = (appointments ?? []) as (Appointment & { appointment_services?: { service_id: string }[] })[];
  const serviceIds = [...new Set(apts.flatMap((a) => (a.appointment_services ?? []).map((s) => s.service_id)))];
  const professionalIds = [...new Set(apts.map((a) => a.professional_id))];

  let services: Service[] = [];
  let professionals: { id: string; name: string }[] = [];

  if (serviceIds.length) {
    const { data: svc } = await supabase.from("services").select("id, name, price").in("id", serviceIds);
    services = (svc ?? []) as Service[];
  }
  if (professionalIds.length) {
    const { data: prof } = await supabase.from("professionals").select("id, name").in("id", professionalIds);
    professionals = (prof ?? []).map((p) => ({ id: (p as { id: string }).id, name: (p as { name: string }).name }));
  }

  const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]));
  const profMap = Object.fromEntries(professionals.map((p) => [p.id, p.name]));

  return {
    data: apts,
    services,
    serviceMap,
    profMap,
    error: null,
  };
}

export const reportsService = {
  async getMetrics(companyId: string, filters: ReportsFilters) {
    requireCompanyId(companyId);
    const periodStart = `${filters.startDate}T00:00:00`;
    const periodEnd = `${filters.endDate}T23:59:59`;

    let aptQuery = supabase
      .from("appointments")
      .select("id, status")
      .eq("company_id", companyId)
      .gte("date", filters.startDate)
      .lte("date", filters.endDate);

    if (filters.professionalId) aptQuery = aptQuery.eq("professional_id", filters.professionalId);
    if (filters.serviceId) {
      const { data: svcLinks } = await supabase
        .from("appointment_services")
        .select("appointment_id")
        .eq("service_id", filters.serviceId);
      const ids = [...new Set(((svcLinks ?? []) as { appointment_id: string }[]).map((a) => a.appointment_id))];
      if (ids.length) aptQuery = aptQuery.in("id", ids);
      else {
        return {
          data: {
            faturamentoTotal: 0,
            faturamentoServicos: 0,
            faturamentoProdutos: 0,
            lucroEstimado: 0,
            totalAgendamentos: 0,
            agendamentosConcluidos: 0,
            ticketMedio: 0,
            servicosRealizados: 0,
            cancelamentos: 0,
            confirmados: 0,
            taxaConversao: 0,
          } as ReportMetrics,
          error: null,
        };
      }
    }

    const { data: appointments } = await aptQuery;
    const apts = (appointments ?? []) as { id: string; status: string }[];
    const aptIds = apts.map((a) => a.id);
    const concluidos = apts.filter((a) => a.status === "completed").length;
    const cancelamentos = apts.filter((a) => a.status === "cancelled").length;
    const confirmados = apts.filter((a) => a.status === "confirmed").length;
    const totalAgendamentos = apts.length;

    const { data: allFinancial } = await supabase
      .from("financial_records")
      .select("type, source, amount, appointment_id")
      .eq("company_id", companyId)
      .eq("is_valid", true)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd);

    const records = (allFinancial ?? []) as { type: string; source: string; amount: number; appointment_id: string | null }[];
    const filteredAptIdsSet = new Set(aptIds);

    let totalIncome = 0;
    let totalExpense = 0;
    let faturamentoServicos = 0;
    let faturamentoProdutos = 0;
    records.forEach((r) => {
      const amt = Number(r.amount) || 0;
      if (r.type === "income") {
        totalIncome += amt;
        if (r.source === "appointment" || r.appointment_id != null) {
          if (filteredAptIdsSet.size > 0 && r.appointment_id && filteredAptIdsSet.has(r.appointment_id))
            faturamentoServicos += amt;
        } else if (r.source === "product_sale") faturamentoProdutos += amt;
      } else if (r.type === "expense") totalExpense += amt;
    });

    const faturamentoTotal = faturamentoServicos + faturamentoProdutos;
    const lucroEstimado = totalIncome - totalExpense;
    const ticketMedio = concluidos > 0 ? faturamentoServicos / concluidos : 0;
    const taxaConversao = confirmados > 0 ? (concluidos / confirmados) * 100 : 0;

    return {
      data: {
        faturamentoTotal,
        faturamentoServicos,
        faturamentoProdutos,
        lucroEstimado,
        totalAgendamentos,
        agendamentosConcluidos: concluidos,
        ticketMedio,
        servicosRealizados: concluidos,
        cancelamentos,
        confirmados,
        taxaConversao,
      } as ReportMetrics,
      error: null,
    };
  },

  async getFaturamentoPorPeriodo(companyId: string, filters: ReportsFilters) {
    requireCompanyId(companyId);
    let aptIds: string[] | null = null;
    if (filters.professionalId) {
      const { data: apts } = await supabase
        .from("appointments")
        .select("id")
        .eq("company_id", companyId)
        .eq("professional_id", filters.professionalId)
        .eq("status", "completed")
        .gte("date", filters.startDate)
        .lte("date", filters.endDate);
      aptIds = (apts ?? []).map((a: { id: string }) => a.id);
      if (aptIds.length === 0) return { data: [], error: null };
    }

    let query = supabase
      .from("financial_records")
      .select("amount, created_at, appointment_id")
      .eq("company_id", companyId)
      .eq("is_valid", true)
      .eq("type", "income")
      .gte("created_at", `${filters.startDate}T00:00:00`)
      .lte("created_at", `${filters.endDate}T23:59:59`);

    if (aptIds) query = query.in("appointment_id", aptIds);
    const { data: records } = await query;

    const byDate: Record<string, number> = {};
    (records ?? []).forEach((r) => {
      const d = (r.created_at as string).slice(0, 10);
      byDate[d] = (byDate[d] ?? 0) + Number(r.amount);
    });

    const result: FaturamentoPorPeriodoItem[] = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, valor]) => ({ date, valor }));

    return { data: result, error: null };
  },

  async getServicosMaisVendidos(companyId: string, filters: ReportsFilters) {
    requireCompanyId(companyId);
    let aptQuery = supabase
      .from("appointments")
      .select("id, appointment_services(service_id)")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("date", filters.startDate)
      .lte("date", filters.endDate);
    if (filters.professionalId) aptQuery = aptQuery.eq("professional_id", filters.professionalId);
    const { data: apts } = await aptQuery;

    const countByService: Record<string, number> = {};
    const aptIdsByService: Record<string, string[]> = {};
    (apts ?? []).forEach((a: { id: string; appointment_services?: { service_id: string }[] }) => {
      (a.appointment_services ?? []).forEach((s) => {
        const sid = s.service_id;
        if (filters.serviceId && sid !== filters.serviceId) return;
        countByService[sid] = (countByService[sid] ?? 0) + 1;
        if (!aptIdsByService[sid]) aptIdsByService[sid] = [];
        if (!aptIdsByService[sid].includes(a.id)) aptIdsByService[sid].push(a.id);
      });
    });

    const serviceIds = Object.keys(countByService);
    if (serviceIds.length === 0) return { data: [], error: null };

    const allAptIds = [...new Set(Object.values(aptIdsByService).flat())];
    let valorByApt: Record<string, number> = {};
    if (allAptIds.length > 0) {
      const { data: financial } = await supabase
        .from("financial_records")
        .select("appointment_id, amount")
        .eq("company_id", companyId)
        .eq("is_valid", true)
        .eq("type", "income")
        .in("appointment_id", allAptIds);
      (financial ?? []).forEach((r: { appointment_id: string; amount: number }) => {
        valorByApt[r.appointment_id] = (valorByApt[r.appointment_id] ?? 0) + Number(r.amount);
      });
    }

    const { data: services } = await supabase.from("services").select("id, name").in("id", serviceIds);
    const svcMap = Object.fromEntries(((services ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));

    const result: ServicoMaisVendido[] = Object.entries(countByService)
      .map(([serviceId, quantidade]) => {
        const aptIds = aptIdsByService[serviceId] ?? [];
        const faturamentoGerado = aptIds.reduce((s, id) => s + (valorByApt[id] ?? 0), 0);
        return {
          serviceId,
          serviceName: svcMap[serviceId] ?? "—",
          quantidade,
          faturamentoGerado,
        };
      })
      .sort((a, b) => b.quantidade - a.quantidade);

    return { data: result, error: null };
  },

  async getRankingProfissionais(companyId: string, filters: ReportsFilters) {
    requireCompanyId(companyId);
    let aptQuery = supabase
      .from("appointments")
      .select("id, professional_id")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("date", filters.startDate)
      .lte("date", filters.endDate);
    if (filters.professionalId) aptQuery = aptQuery.eq("professional_id", filters.professionalId);
    const { data: apts } = await aptQuery;

    let aptList = (apts ?? []) as { id: string; professional_id: string }[];
    if (filters.serviceId) {
      const { data: svcLinks } = await supabase
        .from("appointment_services")
        .select("appointment_id")
        .eq("service_id", filters.serviceId);
      const ids = new Set(((svcLinks ?? []) as { appointment_id: string }[]).map((a) => a.appointment_id));
      aptList = aptList.filter((a) => ids.has(a.id));
    }

    const aptIds = aptList.map((a) => a.id);
    const atendimentosByProf: Record<string, number> = {};
    aptList.forEach((a) => {
      atendimentosByProf[a.professional_id] = (atendimentosByProf[a.professional_id] ?? 0) + 1;
    });

    let valorByProf: Record<string, number> = {};
    if (aptIds.length > 0) {
      const { data: financial } = await supabase
        .from("financial_records")
        .select("appointment_id, amount")
        .eq("company_id", companyId)
        .eq("is_valid", true)
        .eq("type", "income")
        .in("appointment_id", aptIds);
      const aptToProf = Object.fromEntries(aptList.map((a) => [a.id, a.professional_id]));
      (financial ?? []).forEach((r: { appointment_id: string; amount: number }) => {
        const pid = aptToProf[r.appointment_id];
        if (pid) valorByProf[pid] = (valorByProf[pid] ?? 0) + Number(r.amount);
      });
    }

    const profIds = Object.keys(atendimentosByProf);
    if (profIds.length === 0) return { data: [], error: null };
    const { data: profs } = await supabase.from("professionals").select("id, name").in("id", profIds);
    const profMap = Object.fromEntries(((profs ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

    const result: RankingProfissional[] = profIds
      .map((professionalId) => {
        const atendimentos = atendimentosByProf[professionalId] ?? 0;
        const faturamentoGerado = valorByProf[professionalId] ?? 0;
        const ticketMedio = atendimentos > 0 ? faturamentoGerado / atendimentos : 0;
        return {
          professionalId,
          professionalName: profMap[professionalId] ?? "—",
          atendimentos,
          faturamentoGerado,
          ticketMedio,
        };
      })
      .sort((a, b) => b.faturamentoGerado - a.faturamentoGerado);

    return { data: result, error: null };
  },

  async getHorariosMaisMovimentados(companyId: string, filters: ReportsFilters) {
    requireCompanyId(companyId);
    let query = supabase
      .from("appointments")
      .select("start_time")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("date", filters.startDate)
      .lte("date", filters.endDate);
    if (filters.professionalId) query = query.eq("professional_id", filters.professionalId);
    if (filters.serviceId) {
      const { data: svcLinks } = await supabase
        .from("appointment_services")
        .select("appointment_id")
        .eq("service_id", filters.serviceId);
      const ids = [...new Set(((svcLinks ?? []) as { appointment_id: string }[]).map((a) => a.appointment_id))];
      if (ids.length === 0) return { data: [], error: null };
      query = query.in("id", ids);
    }
    const { data: apts } = await query;

    const byHour: Record<number, number> = {};
    (apts ?? []).forEach((a: { start_time: string | null }) => {
      const t = a.start_time;
      if (!t) return;
      const hour = parseInt(t.slice(0, 2), 10);
      if (!Number.isNaN(hour)) byHour[hour] = (byHour[hour] ?? 0) + 1;
    });

    const result: HorarioMovimentado[] = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
      .filter((h) => (byHour[h] ?? 0) > 0)
      .map((h) => ({ hora: `${h.toString().padStart(2, "0")}h`, count: byHour[h] ?? 0 }))
      .sort((a, b) => a.hora.localeCompare(b.hora));

    return { data: result, error: null };
  },

  async getProdutividadeProfissionais(companyId: string, filters: ReportsFilters) {
    requireCompanyId(companyId);
    const { data: apts } = await supabase
      .from("appointments")
      .select("id, professional_id")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("date", filters.startDate)
      .lte("date", filters.endDate);

    let aptList = (apts ?? []) as { id: string; professional_id: string }[];
    if (filters.professionalId) {
      aptList = aptList.filter((a) => a.professional_id === filters.professionalId);
    }

    const aptIds = aptList.map((a) => a.id);
    const atendimentosByProf: Record<string, number> = {};
    aptList.forEach((a) => {
      atendimentosByProf[a.professional_id] = (atendimentosByProf[a.professional_id] ?? 0) + 1;
    });

    const valorByProf: Record<string, number> = {};
    if (aptIds.length > 0) {
      const { data: financial } = await supabase
        .from("financial_records")
        .select("appointment_id, amount")
        .eq("company_id", companyId)
        .eq("is_valid", true)
        .eq("type", "income")
        .in("appointment_id", aptIds);
      const aptToProf = Object.fromEntries(aptList.map((a) => [a.id, a.professional_id]));
      (financial ?? []).forEach((r: { appointment_id: string; amount: number }) => {
        const pid = aptToProf[r.appointment_id];
        if (pid) valorByProf[pid] = (valorByProf[pid] ?? 0) + Number(r.amount);
      });
    }

    const profIds = Object.keys(atendimentosByProf);
    const { data: profs } = await supabase.from("professionals").select("id, name").in("id", profIds);
    const profMap = Object.fromEntries(((profs ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

    const result: ProdutividadeProfissional[] = profIds.map((professionalId) => ({
      professionalId,
      professionalName: profMap[professionalId] ?? "—",
      atendimentos: atendimentosByProf[professionalId] ?? 0,
      valorGerado: valorByProf[professionalId] ?? 0,
    })).sort((a, b) => b.atendimentos - a.atendimentos);

    return { data: result, error: null };
  },

  async getStatusDistribuicao(companyId: string, filters: ReportsFilters) {
    requireCompanyId(companyId);
    let query = supabase
      .from("appointments")
      .select("status")
      .eq("company_id", companyId)
      .gte("date", filters.startDate)
      .lte("date", filters.endDate);

    if (filters.professionalId) query = query.eq("professional_id", filters.professionalId);

    const { data } = await query;

    const counts: Record<string, number> = {};
    (data ?? []).forEach((r: { status: string }) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    });

    const result: StatusDistribuicao[] = ["confirmed", "pending", "completed", "cancelled", "blocked", "no_show"]
      .filter((s) => (counts[s] ?? 0) > 0)
      .map((status) => ({ status, count: counts[status] ?? 0 }));

    return { data: result, error: null };
  },

  async getAppointmentsForTable(
    companyId: string,
    filters: ReportsFilters,
    opts?: { limit?: number; offset?: number }
  ) {
    requireCompanyId(companyId);
    const { data, services, serviceMap, profMap, error } = await getAppointmentsWithDetails(
      companyId,
      filters
    );

    if (error) return { data: [], total: 0, error };

    const aptIdList = data.map((a) => a.id).filter(Boolean);
    const { data: financial } =
      aptIdList.length > 0
        ? await supabase
            .from("financial_records")
            .select("appointment_id, amount, payment_method")
            .eq("company_id", companyId)
            .eq("is_valid", true)
            .eq("type", "income")
            .in("appointment_id", aptIdList)
        : { data: [] };

    const valorByApt: Record<string, number> = {};
    const paymentByApt: Record<string, string | null> = {};
    ((financial ?? []) as { appointment_id: string; amount: number; payment_method?: string | null }[]).forEach(
      (r) => {
        valorByApt[r.appointment_id] = Number(r.amount);
        if (r.payment_method) paymentByApt[r.appointment_id] = r.payment_method;
      }
    );

    let rows: AppointmentReportRow[] = data
      .filter((a) => !filters.serviceId || (a.appointment_services ?? []).some((s) => s.service_id === filters.serviceId))
      .map((a) => {
        const serviceIds = (a.appointment_services ?? []).map((s) => s.service_id);
        const serviceNames = serviceIds.map((id) => serviceMap[id]?.name ?? "—").join(" + ") || "—";
        const valor = valorByApt[a.id] ?? 0;
        const paymentMethod =
          (a as Appointment).payment_method ??
          paymentByApt[a.id] ??
          null;
        return {
          id: a.id,
          date: a.date,
          startTime: String(a.start_time ?? "").slice(0, 5),
          clientName: a.client_name ?? "Cliente",
          serviceNames,
          professionalName: profMap[a.professional_id] ?? "—",
          valor,
          status: a.status,
          notes: a.notes,
          paymentMethod,
          revenuePending: a.status === "completed" && valor <= 0,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    const total = rows.length;
    const limit = opts?.limit ?? 20;
    const offset = opts?.offset ?? 0;
    rows = rows.slice(offset, offset + limit);

    return { data: rows, total, error: null };
  },

  async getPaymentMethodsDistribution(companyId: string, filters: ReportsFilters) {
    requireCompanyId(companyId);
    const periodStart = `${filters.startDate}T00:00:00`;
    const periodEnd = `${filters.endDate}T23:59:59`;

    const { data, error } = await supabase
      .from("financial_records")
      .select("payment_method, amount, appointment_id")
      .eq("company_id", companyId)
      .eq("type", "income")
      .eq("is_valid", true)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd);

    if (error) return { data: [] as PaymentMethodReportPoint[], error };

    let records = (data ?? []) as {
      payment_method?: string | null;
      amount: number;
      appointment_id: string | null;
    }[];

    if (filters.professionalId || filters.serviceId) {
      const { data: aptRows } = await getAppointmentsWithDetails(companyId, filters);
      const aptIdSet = new Set(aptRows.map((a) => a.id));
      records = records.filter(
        (r) => r.appointment_id && aptIdSet.has(r.appointment_id)
      );
    }

    const totals = new Map<string, number>();
    records.forEach((row) => {
      const label = getPaymentChartLabel(row.payment_method);
      const amount = Math.abs(Number(row.amount ?? 0));
      totals.set(label, (totals.get(label) ?? 0) + amount);
    });

    const order = ["PIX", "Dinheiro", "Cartão", "Transferência", "Outros"];
    const result: PaymentMethodReportPoint[] = order
      .filter((method) => (totals.get(method) ?? 0) > 0)
      .map((method) => ({ method, value: totals.get(method) ?? 0 }));

    for (const [method, value] of totals) {
      if (!order.includes(method)) {
        result.push({ method, value });
      }
    }

    return { data: result, error: null };
  },
};
