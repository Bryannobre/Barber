-- Forma de pagamento em atendimentos e lançamentos financeiros (B2/B3)

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE public.financial_records
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_payment_method_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_payment_method_check
  CHECK (
    payment_method IS NULL
    OR payment_method IN ('pix', 'cash', 'credit_card', 'debit_card', 'transfer', 'other')
  );

ALTER TABLE public.financial_records
  DROP CONSTRAINT IF EXISTS financial_records_payment_method_check;

ALTER TABLE public.financial_records
  ADD CONSTRAINT financial_records_payment_method_check
  CHECK (
    payment_method IS NULL
    OR payment_method IN ('pix', 'cash', 'credit_card', 'debit_card', 'transfer', 'other')
  );

CREATE INDEX IF NOT EXISTS idx_financial_records_payment_method
  ON public.financial_records(company_id, payment_method)
  WHERE is_valid = true AND type = 'income';

COMMENT ON COLUMN public.appointments.payment_method IS
  'Forma de pagamento informada ao concluir o atendimento.';
COMMENT ON COLUMN public.financial_records.payment_method IS
  'Forma de pagamento do lançamento (espelha o agendamento quando source=appointment).';
