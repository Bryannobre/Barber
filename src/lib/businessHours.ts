/** 0 = Domingo … 6 = Sábado (mesmo padrão de working_hours) */
export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export interface CompanyBusinessHour {
  id?: string;
  company_id: string;
  day_of_week: number;
  is_closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
}

export type CompanyBusinessHourDraft = {
  day_of_week: number;
  is_closed: boolean;
  opens_at: string;
  closes_at: string;
};

const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "19:00";
const DEFAULT_SAT_OPEN = "09:00";
const DEFAULT_SAT_CLOSE = "14:00";

export function normalizeTimeValue(value: string | null | undefined, fallback = "09:00"): string {
  if (!value) return fallback;
  return value.slice(0, 5);
}

export function timeToMinutes(value: string): number {
  const [h, m] = normalizeTimeValue(value).split(":").map(Number);
  return h * 60 + m;
}

/** Grade padrão para novas empresas ou UI inicial */
export function createDefaultBusinessWeek(companyId: string): CompanyBusinessHour[] {
  return Array.from({ length: 7 }, (_, day) => {
    const isSunday = day === 0;
    const isSaturday = day === 6;
    return {
      company_id: companyId,
      day_of_week: day,
      is_closed: isSunday,
      opens_at: isSunday ? null : isSaturday ? DEFAULT_SAT_OPEN : DEFAULT_OPEN,
      closes_at: isSunday ? null : isSaturday ? DEFAULT_SAT_CLOSE : DEFAULT_CLOSE,
    };
  });
}

export function rowsToDraftMap(rows: CompanyBusinessHour[]): CompanyBusinessHourDraft[] {
  const byDay = new Map(rows.map((r) => [r.day_of_week, r]));
  return Array.from({ length: 7 }, (_, day) => {
    const row = byDay.get(day);
    if (!row || row.is_closed) {
      return {
        day_of_week: day,
        is_closed: true,
        opens_at: DEFAULT_OPEN,
        closes_at: DEFAULT_CLOSE,
      };
    }
    return {
      day_of_week: day,
      is_closed: false,
      opens_at: normalizeTimeValue(row.opens_at, DEFAULT_OPEN),
      closes_at: normalizeTimeValue(row.closes_at, DEFAULT_CLOSE),
    };
  });
}

export type CompanyDayWindow =
  | { closed: true }
  | { closed: false; opensAt: string; closesAt: string; openMinutes: number; closeMinutes: number };

/**
 * Resolve horário da empresa em um dia (com fallback legado opening_time/closing_time).
 */
export function resolveCompanyDayWindow(
  dayOfWeek: number,
  rows: CompanyBusinessHour[] | undefined,
  legacy?: { opening_time?: string | null; closing_time?: string | null }
): CompanyDayWindow {
  const row = rows?.find((r) => r.day_of_week === dayOfWeek);

  if (row) {
    if (row.is_closed) return { closed: true };
    const opensAt = normalizeTimeValue(row.opens_at, DEFAULT_OPEN);
    const closesAt = normalizeTimeValue(row.closes_at, DEFAULT_CLOSE);
    return {
      closed: false,
      opensAt,
      closesAt,
      openMinutes: timeToMinutes(opensAt),
      closeMinutes: timeToMinutes(closesAt),
    };
  }

  if (dayOfWeek === 0) {
    return { closed: true };
  }

  const opensAt = normalizeTimeValue(legacy?.opening_time, DEFAULT_OPEN);
  const closesAt = normalizeTimeValue(legacy?.closing_time, DEFAULT_CLOSE);
  return {
    closed: false,
    opensAt,
    closesAt,
    openMinutes: timeToMinutes(opensAt),
    closeMinutes: timeToMinutes(closesAt),
  };
}

export function validateBusinessWeekDraft(
  drafts: CompanyBusinessHourDraft[],
  slotIntervalMinutes: number
): string | null {
  const openDays = drafts.filter((d) => !d.is_closed);
  if (openDays.length === 0) {
    return "Marque pelo menos um dia como aberto.";
  }

  for (const d of openDays) {
    const open = timeToMinutes(d.opens_at);
    const close = timeToMinutes(d.closes_at);
    if (close <= open) {
      return `${WEEKDAY_LABELS[d.day_of_week]}: fechamento deve ser após abertura.`;
    }
    if (close - open < 30) {
      return `${WEEKDAY_LABELS[d.day_of_week]}: janela mínima de 30 minutos.`;
    }
    const openMin = Number(d.opens_at.split(":")[1] ?? 0);
    const closeMin = Number(d.closes_at.split(":")[1] ?? 0);
    if (openMin % slotIntervalMinutes !== 0 || closeMin % slotIntervalMinutes !== 0) {
      return `${WEEKDAY_LABELS[d.day_of_week]}: use múltiplos de ${slotIntervalMinutes} minutos.`;
    }
  }

  return null;
}
