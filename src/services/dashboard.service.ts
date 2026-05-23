import { supabase } from "@/lib/supabase";
import { requireCompanyId } from "@/lib/companyScope";
import { getPaymentChartLabel } from "@/lib/paymentMethods";
import { addDays, differenceInCalendarDays, format, startOfMonth, startOfWeek, subDays } from "date-fns";

export type DashboardRangeKey = "today" | "7d" | "30d" | "month";

export interface DashboardRange {
  startDate: string;
  endDate: string;
}

export interface DashboardSummary {
  revenue: number;
  appointments: number;
  clientsServed: number;
  averageTicket: number;
  growthPercent: number;
}

export interface DashboardRevenuePoint {
  date: string;
  value: number;
}

export interface DashboardServicePoint {
  serviceName: string;
  quantity: number;
}

export interface DashboardPaymentPoint {
  method: string;
  value: number;
}

export interface DashboardActivityItem {
  id: string;
  time: string;
  client: string;
  service: string;
  professional: string;
  amount: number;
  status: string;
}

export interface DashboardGoalPerformance {
  goalType: "daily" | "weekly" | "monthly" | "custom";
  goalAmount: number;
  currentRevenue: number;
  percent: number;
  progressPercent: number;
  status: "danger" | "warning" | "success";
}

export interface DashboardServiceRankingItem {
  serviceId: string;
  serviceName: string;
  appointments: number;
  revenue: number;
}

export interface DashboardProfessionalRankingItem {
  professionalId: string;
  professionalName: string;
  appointments: number;
  revenue: number;
}

export interface DashboardBusinessPerformance {
  goal: DashboardGoalPerformance;
  topServices: DashboardServiceRankingItem[];
  topProfessionals: DashboardProfessionalRankingItem[];
}

function getRangeDays(range: DashboardRange) {
  return differenceInCalendarDays(new Date(range.endDate), new Date(range.startDate)) + 1;
}

function toIsoDay(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function getDashboardRange(key: DashboardRangeKey): DashboardRange {
  const today = new Date();
  const todayStr = toIsoDay(today);

  if (key === "today") {
    return { startDate: todayStr, endDate: todayStr };
  }
  if (key === "7d") {
    return { startDate: toIsoDay(subDays(today, 6)), endDate: todayStr };
  }
  if (key === "30d") {
    return { startDate: toIsoDay(subDays(today, 29)), endDate: todayStr };
  }

  return { startDate: format(today, "yyyy-MM-01"), endDate: todayStr };
}

export function getPreviousRange(range: DashboardRange): DashboardRange {
  const days = getRangeDays(range);
  const start = subDays(new Date(range.startDate), days);
  const end = subDays(new Date(range.startDate), 1);
  return { startDate: toIsoDay(start), endDate: toIsoDay(end) };
}

function normalizeGrowth(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function getGoalStatus(percent: number): DashboardGoalPerformance["status"] {
  if (percent < 50) return "danger";
  if (percent < 80) return "warning";
  return "success";
}

function isValidIsoDay(value: string | null | undefined): value is string {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

export const dashboardService = {
  async getSummary(companyId: string, range: DashboardRange) {
    requireCompanyId(companyId);
    const prevRange = getPreviousRange(range);

    const [{ data: appointments }, { data: revenueNow }, { data: revenuePrev }] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, status")
        .eq("company_id", companyId)
        .gte("date", range.startDate)
        .lte("date", range.endDate),
      supabase
        .from("financial_records")
        .select("amount")
        .eq("company_id", companyId)
        .eq("type", "income")
        .eq("is_valid", true)
        .gte("created_at", `${range.startDate}T00:00:00`)
        .lte("created_at", `${range.endDate}T23:59:59`),
      supabase
        .from("financial_records")
        .select("amount")
        .eq("company_id", companyId)
        .eq("type", "income")
        .eq("is_valid", true)
        .gte("created_at", `${prevRange.startDate}T00:00:00`)
        .lte("created_at", `${prevRange.endDate}T23:59:59`),
    ]);

    const totalAppointments = appointments?.length ?? 0;
    const completed = (appointments ?? []).filter((a) => a.status === "completed").length;
    const revenue = (revenueNow ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
    const previousRevenue = (revenuePrev ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

    return {
      data: {
        revenue,
        appointments: totalAppointments,
        clientsServed: completed,
        averageTicket: totalAppointments > 0 ? revenue / totalAppointments : 0,
        growthPercent: normalizeGrowth(revenue, previousRevenue),
      } as DashboardSummary,
      error: null,
    };
  },

  async getRevenue(companyId: string, range: DashboardRange) {
    requireCompanyId(companyId);
    const { data, error } = await supabase
      .from("financial_records")
      .select("amount, created_at")
      .eq("company_id", companyId)
      .eq("type", "income")
      .eq("is_valid", true)
      .gte("created_at", `${range.startDate}T00:00:00`)
      .lte("created_at", `${range.endDate}T23:59:59`);

    if (error) return { data: [] as DashboardRevenuePoint[], error };

    const days = getRangeDays(range);
    const byDate: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = toIsoDay(addDays(new Date(range.startDate), i));
      byDate[d] = 0;
    }

    (data ?? []).forEach((row) => {
      const d = String(row.created_at).slice(0, 10);
      byDate[d] = (byDate[d] ?? 0) + Number(row.amount);
    });

    return {
      data: Object.entries(byDate).map(([date, value]) => ({ date, value })),
      error: null,
    };
  },

  async getTopServices(companyId: string, range: DashboardRange) {
    requireCompanyId(companyId);
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("status, appointment_services(service_id)")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("date", range.startDate)
      .lte("date", range.endDate);

    if (error) return { data: [] as DashboardServicePoint[], error };

    const countByService: Record<string, number> = {};
    (appointments ?? []).forEach((apt: { appointment_services?: { service_id: string }[] }) => {
      (apt.appointment_services ?? []).forEach((svc) => {
        countByService[svc.service_id] = (countByService[svc.service_id] ?? 0) + 1;
      });
    });

    const ids = Object.keys(countByService);
    if (ids.length === 0) return { data: [] as DashboardServicePoint[], error: null };

    const { data: services } = await supabase.from("services").select("id, name").in("id", ids);
    const nameById = Object.fromEntries(
      ((services ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name])
    );

    const result = ids
      .map((id) => ({ serviceName: nameById[id] ?? "—", quantity: countByService[id] }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return { data: result, error: null };
  },

  async getPayments(companyId: string, range: DashboardRange) {
    requireCompanyId(companyId);
    const { data, error } = await supabase
      .from("financial_records")
      .select("payment_method, amount")
      .eq("company_id", companyId)
      .eq("type", "income")
      .eq("is_valid", true)
      .gte("created_at", `${range.startDate}T00:00:00`)
      .lte("created_at", `${range.endDate}T23:59:59`);

    if (error) return { data: [] as DashboardPaymentPoint[], error };

    const totals = new Map<string, number>();

    (data ?? []).forEach((row) => {
      const label = getPaymentChartLabel(
        (row as { payment_method?: string | null }).payment_method
      );
      const amount = Math.abs(Number(row.amount ?? 0));
      totals.set(label, (totals.get(label) ?? 0) + amount);
    });

    const order = ["PIX", "Dinheiro", "Cartão", "Transferência", "Outros"];
    const result: DashboardPaymentPoint[] = order
      .filter((method) => (totals.get(method) ?? 0) > 0)
      .map((method) => ({ method, value: totals.get(method) ?? 0 }));

    for (const [method, value] of totals) {
      if (!order.includes(method)) {
        result.push({ method, value });
      }
    }

    return { data: result, error: null };
  },

  async getRecentActivity(companyId: string, range: DashboardRange) {
    requireCompanyId(companyId);
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("id, date, start_time, client_name, professional_id, status, appointment_services(service_id)")
      .eq("company_id", companyId)
      .gte("date", range.startDate)
      .lte("date", range.endDate)
      .order("date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(10);

    if (error) return { data: [] as DashboardActivityItem[], error };

    const aptIds = (appointments ?? []).map((a) => a.id);
    const profIds = [...new Set((appointments ?? []).map((a) => a.professional_id))];
    const serviceIds = [
      ...new Set(
        (appointments ?? []).flatMap((a) =>
          ((a as { appointment_services?: { service_id: string }[] }).appointment_services ?? []).map(
            (s) => s.service_id
          )
        )
      ),
    ];

    const [{ data: professionals }, { data: services }, { data: revenue }] = await Promise.all([
      profIds.length
        ? supabase.from("professionals").select("id, name").in("id", profIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      serviceIds.length
        ? supabase.from("services").select("id, name").in("id", serviceIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      aptIds.length
        ? supabase
            .from("financial_records")
            .select("appointment_id, amount")
            .eq("company_id", companyId)
            .eq("type", "income")
            .eq("is_valid", true)
            .in("appointment_id", aptIds)
        : Promise.resolve({ data: [] as { appointment_id: string; amount: number }[] }),
    ]);

    const profById = Object.fromEntries(
      ((professionals ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name])
    );
    const serviceById = Object.fromEntries(
      ((services ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name])
    );
    const revenueByApt = Object.fromEntries(
      ((revenue ?? []) as { appointment_id: string; amount: number }[]).map((r) => [
        r.appointment_id,
        Number(r.amount),
      ])
    );

    const items: DashboardActivityItem[] = (appointments ?? []).map((apt) => {
      const serviceName =
        ((apt as { appointment_services?: { service_id: string }[] }).appointment_services ?? [])
          .map((s) => serviceById[s.service_id] ?? "—")
          .join(" + ") || "—";

      return {
        id: apt.id,
        time: `${apt.date} ${String(apt.start_time).slice(0, 5)}`,
        client: apt.client_name ?? "Cliente",
        service: serviceName,
        professional: profById[apt.professional_id] ?? "—",
        amount: revenueByApt[apt.id] ?? 0,
        status: apt.status,
      };
    });

    return { data: items, error: null };
  },

  async getBusinessPerformance(companyId: string, range: DashboardRange) {
    requireCompanyId(companyId);
    const endDate = new Date(range.endDate);
    const defaultGoalPeriod: DashboardGoalPerformance["goalType"] = "weekly";
    const dailyRange: DashboardRange = { startDate: range.endDate, endDate: range.endDate };
    const weeklyRange: DashboardRange = {
      startDate: format(startOfWeek(endDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      endDate: range.endDate,
    };
    const monthlyRange: DashboardRange = {
      startDate: format(startOfMonth(endDate), "yyyy-MM-dd"),
      endDate: range.endDate,
    };

    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("revenue_goal_amount, revenue_goal_period, revenue_goal_custom_start_date, revenue_goal_custom_end_date")
      .eq("id", companyId)
      .single();

    const configuredGoalPeriod: DashboardGoalPerformance["goalType"] =
      companyData?.revenue_goal_period === "daily" ||
      companyData?.revenue_goal_period === "weekly" ||
      companyData?.revenue_goal_period === "monthly" ||
      companyData?.revenue_goal_period === "custom"
        ? companyData.revenue_goal_period
        : defaultGoalPeriod;

    const hasValidCustomRange =
      isValidIsoDay(companyData?.revenue_goal_custom_start_date) &&
      isValidIsoDay(companyData?.revenue_goal_custom_end_date) &&
      companyData.revenue_goal_custom_start_date <= companyData.revenue_goal_custom_end_date;

    const goalRange: DashboardRange =
      configuredGoalPeriod === "daily"
        ? dailyRange
        : configuredGoalPeriod === "weekly"
        ? weeklyRange
        : configuredGoalPeriod === "monthly"
        ? monthlyRange
        : hasValidCustomRange
        ? {
            startDate: companyData!.revenue_goal_custom_start_date!,
            endDate: companyData!.revenue_goal_custom_end_date!,
          }
        : monthlyRange;

    const previousGoalRange = getPreviousRange(goalRange);

    const [goalRevenueRes, previousGoalRevenueRes, appointmentsRes] = await Promise.all([
      supabase
        .from("financial_records")
        .select("amount")
        .eq("company_id", companyId)
        .eq("type", "income")
        .eq("is_valid", true)
        .gte("created_at", `${goalRange.startDate}T00:00:00`)
        .lte("created_at", `${goalRange.endDate}T23:59:59`),
      supabase
        .from("financial_records")
        .select("amount")
        .eq("company_id", companyId)
        .eq("type", "income")
        .eq("is_valid", true)
        .gte("created_at", `${previousGoalRange.startDate}T00:00:00`)
        .lte("created_at", `${previousGoalRange.endDate}T23:59:59`),
      supabase
        .from("appointments")
        .select("id, professional_id, appointment_services(service_id)")
        .eq("company_id", companyId)
        .eq("status", "completed")
        .gte("date", range.startDate)
        .lte("date", range.endDate),
    ]);

    const currentRevenue = (goalRevenueRes.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const previousRevenue = (previousGoalRevenueRes.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

    const configuredGoalAmount = Number(companyData?.revenue_goal_amount ?? 0);
    const hasConfiguredGoal = configuredGoalAmount > 0;
    const fallbackGoal =
      configuredGoalPeriod === "daily" ? 500 : configuredGoalPeriod === "weekly" ? 3500 : 12000;
    const computedGoalAmount = previousRevenue > 0 ? previousRevenue * 1.1 : Math.max(currentRevenue * 1.2, fallbackGoal);
    const goalAmount = hasConfiguredGoal ? configuredGoalAmount : computedGoalAmount;
    const percent = goalAmount > 0 ? (currentRevenue / goalAmount) * 100 : 0;
    const progressPercent = Math.max(0, Math.min(percent, 100));

    const goal: DashboardGoalPerformance = {
      goalType:
        configuredGoalPeriod === "custom" && !hasValidCustomRange ? "monthly" : configuredGoalPeriod,
      goalAmount,
      currentRevenue,
      percent,
      progressPercent,
      status: getGoalStatus(percent),
    };

    if (companyError) {
      return {
        data: {
          goal,
          topServices: [] as DashboardServiceRankingItem[],
          topProfessionals: [] as DashboardProfessionalRankingItem[],
        },
        error: companyError,
      };
    }

    if (appointmentsRes.error) {
      return {
        data: {
          goal,
          topServices: [] as DashboardServiceRankingItem[],
          topProfessionals: [] as DashboardProfessionalRankingItem[],
        },
        error: appointmentsRes.error,
      };
    }

    const appointments =
      (appointmentsRes.data as
        | { id: string; professional_id: string; appointment_services?: { service_id: string }[] }[]
        | null) ?? [];

    const appointmentIds = appointments.map((appointment) => appointment.id);
    const serviceIds = [
      ...new Set(appointments.flatMap((appointment) => (appointment.appointment_services ?? []).map((s) => s.service_id))),
    ];
    const professionalIds = [...new Set(appointments.map((appointment) => appointment.professional_id))];

    const [recordsRes, servicesRes, professionalsRes] = await Promise.all([
      appointmentIds.length
        ? supabase
            .from("financial_records")
            .select("appointment_id, amount")
            .eq("company_id", companyId)
            .eq("type", "income")
            .eq("is_valid", true)
            .in("appointment_id", appointmentIds)
        : Promise.resolve({ data: [] as { appointment_id: string | null; amount: number }[] }),
      serviceIds.length
        ? supabase.from("services").select("id, name, price").eq("company_id", companyId).in("id", serviceIds)
        : Promise.resolve({ data: [] as { id: string; name: string; price: number }[] }),
      professionalIds.length
        ? supabase
            .from("professionals")
            .select("id, name")
            .eq("company_id", companyId)
            .in("id", professionalIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const serviceById = Object.fromEntries(
      ((servicesRes.data ?? []) as { id: string; name: string; price: number }[]).map((service) => [
        service.id,
        { name: service.name, price: Number(service.price ?? 0) },
      ])
    );
    const professionalById = Object.fromEntries(
      ((professionalsRes.data ?? []) as { id: string; name: string }[]).map((professional) => [
        professional.id,
        professional.name,
      ])
    );

    const revenueByAppointment: Record<string, number> = {};
    ((recordsRes.data ?? []) as { appointment_id: string | null; amount: number }[]).forEach((record) => {
      if (!record.appointment_id) return;
      revenueByAppointment[record.appointment_id] =
        (revenueByAppointment[record.appointment_id] ?? 0) + Number(record.amount ?? 0);
    });

    const serviceStats: Record<string, DashboardServiceRankingItem> = {};
    const professionalStats: Record<string, DashboardProfessionalRankingItem> = {};

    appointments.forEach((appointment) => {
      const serviceRefs = appointment.appointment_services ?? [];
      serviceRefs.forEach((serviceRef) => {
        const serviceInfo = serviceById[serviceRef.service_id];
        if (!serviceInfo) return;

        if (!serviceStats[serviceRef.service_id]) {
          serviceStats[serviceRef.service_id] = {
            serviceId: serviceRef.service_id,
            serviceName: serviceInfo.name,
            appointments: 0,
            revenue: 0,
          };
        }

        serviceStats[serviceRef.service_id].appointments += 1;
        serviceStats[serviceRef.service_id].revenue += Number(serviceInfo.price ?? 0);
      });

      const professionalId = appointment.professional_id;
      if (!professionalStats[professionalId]) {
        professionalStats[professionalId] = {
          professionalId,
          professionalName: professionalById[professionalId] ?? "—",
          appointments: 0,
          revenue: 0,
        };
      }

      professionalStats[professionalId].appointments += 1;
      professionalStats[professionalId].revenue += revenueByAppointment[appointment.id] ?? 0;
    });

    const topServices = Object.values(serviceStats)
      .sort((a, b) => b.appointments - a.appointments || b.revenue - a.revenue)
      .slice(0, 5);
    const topProfessionals = Object.values(professionalStats)
      .sort((a, b) => b.appointments - a.appointments || b.revenue - a.revenue)
      .slice(0, 5);

    return {
      data: {
        goal,
        topServices,
        topProfessionals,
      } as DashboardBusinessPerformance,
      error:
        goalRevenueRes.error ??
        previousGoalRevenueRes.error ??
        recordsRes.error ??
        servicesRes.error ??
        professionalsRes.error ??
        null,
    };
  },
};
