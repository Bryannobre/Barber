-- =============================================================================
-- Módulo fiscal (Fase 1) — NFS-e mock, multi-tenant por company_id
-- Segurança: sem API keys / senhas de certificado em tabelas client-facing
-- =============================================================================

CREATE TYPE public.invoice_status AS ENUM (
  'PENDING',
  'PROCESSING',
  'ISSUED',
  'FAILED',
  'CANCELLED'
);

COMMENT ON TYPE public.invoice_status IS
  'Status da nota fiscal de serviço. Fase 2: integração com provedores reais.';

-- -----------------------------------------------------------------------------
-- Notas fiscais
-- -----------------------------------------------------------------------------
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  financial_record_id UUID REFERENCES public.financial_records(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  company_client_id UUID REFERENCES public.company_clients(id) ON DELETE SET NULL,
  provider TEXT,
  invoice_number TEXT,
  verification_code TEXT,
  status public.invoice_status NOT NULL DEFAULT 'PENDING',
  error_message TEXT,
  service_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  final_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  pdf_url TEXT,
  xml_url TEXT,
  raw_request JSONB,
  raw_response JSONB,
  issued_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_company_created ON public.invoices(company_id, created_at DESC);
CREATE INDEX idx_invoices_company_status ON public.invoices(company_id, status);
CREATE INDEX idx_invoices_financial_record ON public.invoices(financial_record_id)
  WHERE financial_record_id IS NOT NULL;

-- Uma nota ativa por lançamento financeiro; nova emissão só após CANCELLED
CREATE UNIQUE INDEX uniq_invoices_active_per_financial_record
  ON public.invoices(financial_record_id)
  WHERE financial_record_id IS NOT NULL
    AND status <> 'CANCELLED';

COMMENT ON TABLE public.invoices IS
  'Notas fiscais de serviço (NFS-e). Emissão real via Edge Functions + provedor (Fase 2).';
COMMENT ON COLUMN public.invoices.financial_record_id IS
  'Referência principal: lançamento financeiro que originou a nota.';

-- -----------------------------------------------------------------------------
-- Logs de emissão
-- -----------------------------------------------------------------------------
CREATE TABLE public.invoice_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  status TEXT,
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_logs_company_created ON public.invoice_logs(company_id, created_at DESC);
CREATE INDEX idx_invoice_logs_invoice ON public.invoice_logs(invoice_id, created_at DESC);

COMMENT ON TABLE public.invoice_logs IS
  'Auditoria de eventos fiscais (emissão, falha, processamento).';

-- -----------------------------------------------------------------------------
-- Configurações fiscais por empresa (sem segredos)
-- -----------------------------------------------------------------------------
CREATE TABLE public.company_fiscal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  legal_name TEXT,
  document TEXT,
  municipal_registration TEXT,
  tax_regime TEXT,
  provider TEXT,
  auto_issue_invoice BOOLEAN NOT NULL DEFAULT false,
  default_service_code TEXT,
  default_service_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.company_fiscal_settings IS
  'Cadastro fiscal da empresa. Chaves/certificados ficam em Secrets + Edge Functions (Fase 2).';
COMMENT ON COLUMN public.company_fiscal_settings.auto_issue_invoice IS
  'Reservado Fase 2 — emissão automática após confirmação financeira.';

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_invoices_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_invoices_set_updated_at();

CREATE OR REPLACE FUNCTION public.trg_company_fiscal_settings_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_fiscal_settings_updated_at ON public.company_fiscal_settings;
CREATE TRIGGER trg_company_fiscal_settings_updated_at
  BEFORE UPDATE ON public.company_fiscal_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_company_fiscal_settings_set_updated_at();

-- -----------------------------------------------------------------------------
-- Integridade cross-tenant (mesmo padrão de financial_records)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_invoices_financial_record_same_company()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_fr_company UUID;
BEGIN
  IF NEW.financial_record_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT fr.company_id INTO v_fr_company
  FROM public.financial_records fr
  WHERE fr.id = NEW.financial_record_id;

  IF v_fr_company IS NULL THEN
    RAISE EXCEPTION 'invoices: lançamento financeiro inexistente.';
  END IF;

  IF v_fr_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'invoices: lançamento financeiro pertence a outra empresa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_financial_record_same_company ON public.invoices;
CREATE TRIGGER trg_invoices_financial_record_same_company
  BEFORE INSERT OR UPDATE OF financial_record_id, company_id ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_invoices_financial_record_same_company();

CREATE OR REPLACE FUNCTION public.trg_invoices_appointment_same_company()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_appt_company UUID;
BEGIN
  IF NEW.appointment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.company_id INTO v_appt_company
  FROM public.appointments a
  WHERE a.id = NEW.appointment_id;

  IF v_appt_company IS NULL THEN
    RAISE EXCEPTION 'invoices: agendamento inexistente.';
  END IF;

  IF v_appt_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'invoices: agendamento pertence a outra empresa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_appointment_same_company ON public.invoices;
CREATE TRIGGER trg_invoices_appointment_same_company
  BEFORE INSERT OR UPDATE OF appointment_id, company_id ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_invoices_appointment_same_company();

CREATE OR REPLACE FUNCTION public.trg_invoices_professional_same_company()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_prof_company UUID;
BEGIN
  IF NEW.professional_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pr.company_id INTO v_prof_company
  FROM public.professionals pr
  WHERE pr.id = NEW.professional_id;

  IF v_prof_company IS NULL THEN
    RAISE EXCEPTION 'invoices: profissional inexistente.';
  END IF;

  IF v_prof_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'invoices: profissional pertence a outra empresa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_professional_same_company ON public.invoices;
CREATE TRIGGER trg_invoices_professional_same_company
  BEFORE INSERT OR UPDATE OF professional_id, company_id ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_invoices_professional_same_company();

CREATE OR REPLACE FUNCTION public.trg_invoices_company_client_same_company()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_client_company UUID;
BEGIN
  IF NEW.company_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cc.company_id INTO v_client_company
  FROM public.company_clients cc
  WHERE cc.id = NEW.company_client_id;

  IF v_client_company IS NULL THEN
    RAISE EXCEPTION 'invoices: cliente da empresa inexistente.';
  END IF;

  IF v_client_company IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'invoices: cliente pertence a outra empresa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_company_client_same_company ON public.invoices;
CREATE TRIGGER trg_invoices_company_client_same_company
  BEFORE INSERT OR UPDATE OF company_client_id, company_id ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_invoices_company_client_same_company();

-- invoice_logs.company_id deve bater com a nota
CREATE OR REPLACE FUNCTION public.trg_invoice_logs_same_company_as_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_inv_company UUID;
BEGIN
  SELECT i.company_id INTO v_inv_company
  FROM public.invoices i
  WHERE i.id = NEW.invoice_id;

  IF v_inv_company IS NULL THEN
    RAISE EXCEPTION 'invoice_logs: nota inexistente.';
  END IF;

  IF NEW.company_id IS DISTINCT FROM v_inv_company THEN
    RAISE EXCEPTION 'invoice_logs: company_id inconsistente com a nota.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_logs_same_company ON public.invoice_logs;
CREATE TRIGGER trg_invoice_logs_same_company
  BEFORE INSERT OR UPDATE ON public.invoice_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_invoice_logs_same_company_as_invoice();

-- -----------------------------------------------------------------------------
-- RLS (padrão financial_records / recados)
-- -----------------------------------------------------------------------------
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_fiscal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invoices by company staff" ON public.invoices
  FOR ALL
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Invoice logs by company staff" ON public.invoice_logs
  FOR ALL
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Company fiscal settings by company staff" ON public.company_fiscal_settings
  FOR ALL
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
    )
  );
