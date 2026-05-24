-- =============================================================================
-- Módulo fiscal — Fase 2: retry, logs avançados
-- =============================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD CONSTRAINT chk_invoices_retry_count_non_negative
  CHECK (retry_count >= 0);

ALTER TABLE public.invoices
  ADD CONSTRAINT chk_invoices_retry_count_max
  CHECK (retry_count <= 3);

COMMENT ON COLUMN public.invoices.retry_count IS
  'Tentativas de reemissão após FAILED. Máximo 3 (validado na Edge Function).';

-- Logs avançados
ALTER TABLE public.invoice_logs
  ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.invoice_logs
  ADD COLUMN IF NOT EXISTS retry_count INTEGER;

ALTER TABLE public.invoice_logs
  ADD COLUMN IF NOT EXISTS metadata JSONB;

COMMENT ON COLUMN public.invoice_logs.actor_id IS 'Usuário que disparou o evento (quando aplicável).';
COMMENT ON COLUMN public.invoice_logs.metadata IS 'Dados extras: provider, storage_path, etc.';

CREATE INDEX IF NOT EXISTS idx_invoice_logs_actor ON public.invoice_logs(actor_id)
  WHERE actor_id IS NOT NULL;
