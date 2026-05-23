/** Padrão quando a empresa não define intervalo */
export const DEFAULT_BOOKING_SLOT_INTERVAL_MINUTES = 15;

const ALLOWED_SLOT_INTERVALS = [5, 10, 15, 30] as const;

export function resolveBookingSlotIntervalMinutes(
  companyValue?: number | null
): number {
  if (
    companyValue != null &&
    ALLOWED_SLOT_INTERVALS.includes(companyValue as (typeof ALLOWED_SLOT_INTERVALS)[number])
  ) {
    return companyValue;
  }
  return DEFAULT_BOOKING_SLOT_INTERVAL_MINUTES;
}

export type ServiceDurationInput = {
  id: string;
  duration_minutes: number;
  execution_mode?: "sequential" | "parallel" | null;
};

/** Alinha com calculate_appointment_duration no Postgres (migration 058). */
export function calculateBookingDurationMinutes(
  services: ServiceDurationInput[],
  selectedIds: string[]
): number {
  const selected = services.filter((s) => selectedIds.includes(s.id));
  if (selected.length === 0) return 0;

  let sequential = 0;
  let parallelMax = 0;
  for (const s of selected) {
    const mode = s.execution_mode ?? "sequential";
    if (mode === "parallel") {
      parallelMax = Math.max(parallelMax, s.duration_minutes);
    } else {
      sequential += s.duration_minutes;
    }
  }
  return sequential + parallelMax;
}
