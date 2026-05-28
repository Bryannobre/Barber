-- =============================================================================
-- Corrige datas dos lançamentos financeiros — Meire Reis
-- =============================================================================
-- Problema: seed gravava created_at = "agora"; o painel filtra por created_at.
-- Solução: alinhar created_at ao fim de cada agendamento concluído.
--
-- Rode no SQL Editor (não apaga dados, só atualiza financial_records).
-- =============================================================================

UPDATE public.financial_records fr
SET created_at = sub.occurred_at
FROM (
  SELECT
    fr.id,
    (
      (a.date::timestamp + a.start_time)
      + (a.duration_minutes * INTERVAL '1 minute')
    ) AS occurred_at
  FROM public.financial_records fr
  INNER JOIN public.appointments a ON a.id = fr.appointment_id
  WHERE fr.company_id = '8ac59242-3ef8-45a2-85ed-19a94c174df0'
    AND fr.source = 'appointment'
    AND fr.is_valid = true
    AND a.status = 'completed'
) sub
WHERE fr.id = sub.id;

-- Conferência (últimos 30 dias):
-- SELECT date_trunc('day', created_at)::date AS dia, count(*), sum(amount)
-- FROM financial_records
-- WHERE company_id = '8ac59242-3ef8-45a2-85ed-19a94c174df0'
--   AND type = 'income' AND is_valid = true
--   AND created_at >= current_date - 30
-- GROUP BY 1 ORDER BY 1;
