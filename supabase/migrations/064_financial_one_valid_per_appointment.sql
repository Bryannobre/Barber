-- Um único lançamento válido por agendamento (evita duplicatas no sync do financeiro)

UPDATE public.financial_records fr
SET is_valid = false
WHERE fr.id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY appointment_id
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.financial_records
    WHERE is_valid = true
      AND appointment_id IS NOT NULL
      AND source = 'appointment'
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_records_one_valid_per_appointment
  ON public.financial_records (appointment_id)
  WHERE is_valid = true
    AND appointment_id IS NOT NULL
    AND source = 'appointment';

COMMENT ON INDEX idx_financial_records_one_valid_per_appointment IS
  'Garante no máximo um lançamento válido de receita por agendamento.';
