import { format, parseISO, subDays, startOfDay } from "date-fns";
import type { FiscalDashboardStats, InvoiceWithMeta } from "@/types/fiscal.types";

export function buildFiscalDashboardStats(
  invoices: InvoiceWithMeta[],
  days = 30
): FiscalDashboardStats {
  const issued = invoices.filter((i) => i.status === "ISSUED");
  const pending = invoices.filter(
    (i) => i.status === "PENDING" || i.status === "PROCESSING"
  );
  const failed = invoices.filter((i) => i.status === "FAILED");
  const cancelled = invoices.filter((i) => i.status === "CANCELLED");

  const revenue = issued.reduce((s, i) => s + Number(i.final_amount), 0);
  const taxes = issued.reduce((s, i) => s + Number(i.tax_amount), 0);

  const now = startOfDay(new Date());
  const dayKeys: string[] = [];
  for (let d = days - 1; d >= 0; d--) {
    dayKeys.push(format(subDays(now, d), "yyyy-MM-dd"));
  }

  const byDay = new Map<string, { count: number; total: number }>();
  for (const key of dayKeys) {
    byDay.set(key, { count: 0, total: 0 });
  }

  for (const inv of issued) {
    const raw = inv.issued_at ?? inv.created_at;
    const key = format(parseISO(raw), "yyyy-MM-dd");
    if (!byDay.has(key)) continue;
    const row = byDay.get(key)!;
    row.count += 1;
    row.total += Number(inv.final_amount);
  }

  const emissionsByDay = dayKeys.map((date) => ({
    date,
    count: byDay.get(date)?.count ?? 0,
    total: byDay.get(date)?.total ?? 0,
  }));

  const daysWithEmission = emissionsByDay.filter((d) => d.count > 0).length;
  const dailyAverage = daysWithEmission > 0 ? revenue / daysWithEmission : 0;

  return {
    issuedCount: issued.length,
    pendingCount: pending.length,
    failedCount: failed.length,
    cancelledCount: cancelled.length,
    revenue,
    taxes,
    dailyAverage,
    emissionsByDay,
  };
}
