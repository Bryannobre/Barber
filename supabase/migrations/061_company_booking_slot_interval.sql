-- Intervalo entre horários oferecidos no agendamento (cliente + landing)

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS booking_slot_interval_minutes INT NOT NULL DEFAULT 15;

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS chk_companies_booking_slot_interval;

ALTER TABLE public.companies
  ADD CONSTRAINT chk_companies_booking_slot_interval
  CHECK (booking_slot_interval_minutes IN (5, 10, 15, 30));

COMMENT ON COLUMN public.companies.booking_slot_interval_minutes IS
  'Passo em minutos para slots de agendamento (ex.: 15 → 09:00, 09:15, 09:30).';
