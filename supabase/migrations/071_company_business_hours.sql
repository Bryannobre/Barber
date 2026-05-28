-- Horário de funcionamento da empresa por dia da semana (0=Dom … 6=Sáb)

CREATE TABLE IF NOT EXISTS public.company_business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_closed BOOLEAN NOT NULL DEFAULT false,
  opens_at TIME,
  closes_at TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, day_of_week),
  CONSTRAINT company_business_hours_times_check CHECK (
    (is_closed = true AND opens_at IS NULL AND closes_at IS NULL)
    OR (
      is_closed = false
      AND opens_at IS NOT NULL
      AND closes_at IS NOT NULL
      AND closes_at > opens_at
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_company_business_hours_company
  ON public.company_business_hours(company_id);

COMMENT ON TABLE public.company_business_hours IS
  'Janela de funcionamento por dia. Fechado = sem agendamento na empresa naquele dia.';

CREATE OR REPLACE FUNCTION public.trg_company_business_hours_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_business_hours_updated ON public.company_business_hours;
CREATE TRIGGER trg_company_business_hours_updated
  BEFORE UPDATE ON public.company_business_hours
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_company_business_hours_set_updated_at();

ALTER TABLE public.company_business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_business_hours_by_company_access"
  ON public.company_business_hours
  FOR ALL
  USING (
    company_id IN (
      SELECT c.id FROM public.companies c
      WHERE c.owner_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM public.company_members cm
           WHERE cm.company_id = c.id AND cm.user_id = auth.uid()
         )
         OR EXISTS (
           SELECT 1 FROM public.profiles p
           WHERE p.id = auth.uid() AND p.role = 'owner'
         )
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT c.id FROM public.companies c
      WHERE c.owner_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM public.company_members cm
           WHERE cm.company_id = c.id AND cm.user_id = auth.uid()
         )
         OR EXISTS (
           SELECT 1 FROM public.profiles p
           WHERE p.id = auth.uid() AND p.role = 'owner'
         )
    )
  );

CREATE POLICY "company_business_hours_public_read_active"
  ON public.company_business_hours
  FOR SELECT
  USING (
    company_id IN (SELECT id FROM public.companies WHERE status = 'active')
  );

-- Backfill: seg–sáb com horário legado; domingo fechado
INSERT INTO public.company_business_hours (company_id, day_of_week, is_closed, opens_at, closes_at)
SELECT
  c.id,
  d.dow,
  (d.dow = 0),
  CASE WHEN d.dow = 0 THEN NULL ELSE COALESCE(c.opening_time, '09:00'::time) END,
  CASE WHEN d.dow = 0 THEN NULL ELSE COALESCE(c.closing_time, '19:00'::time) END
FROM public.companies c
CROSS JOIN generate_series(0, 6) AS d(dow)
ON CONFLICT (company_id, day_of_week) DO NOTHING;
