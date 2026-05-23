-- Notificações de agendamento para membros da empresa + deep link na agenda

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_appointment
  ON public.notifications(appointment_id)
  WHERE appointment_id IS NOT NULL;

COMMENT ON COLUMN public.notifications.appointment_id IS
  'Agendamento relacionado (abrir na agenda).';

-- ---------------------------------------------------------------------------
-- Notificar todos os membros (e owner) da empresa
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_company_appointment_event(
  p_company_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_appointment_id UUID DEFAULT NULL,
  p_exclude_user_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  IF p_type IS NULL OR p_type NOT IN (
    'appointment_created',
    'appointment_cancelled',
    'appointment_updated',
    'appointment_completed'
  ) THEN
    RAISE EXCEPTION 'Tipo de notificação de agendamento inválido';
  END IF;

  INSERT INTO public.notifications (
    user_id,
    company_id,
    type,
    title,
    message,
    appointment_id,
    is_read
  )
  SELECT DISTINCT
    u.uid,
    p_company_id,
    p_type,
    left(p_title, 200),
    left(p_message, 500),
    p_appointment_id,
    false
  FROM (
    SELECT cm.user_id AS uid
    FROM public.company_members cm
    WHERE cm.company_id = p_company_id
    UNION
    SELECT c.owner_id AS uid
    FROM public.companies c
    WHERE c.id = p_company_id AND c.owner_id IS NOT NULL
  ) u
  WHERE u.uid IS NOT NULL
    AND (p_exclude_user_id IS NULL OR u.uid <> p_exclude_user_id);

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_company_appointment_event(UUID, TEXT, TEXT, TEXT, UUID, UUID) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- create_notification: aceitar tipos de agendamento
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_company_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_recado_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nid UUID;
BEGIN
  IF p_type IS NULL OR p_type NOT IN (
    'mention',
    'global',
    'appointment_created',
    'appointment_cancelled',
    'appointment_updated',
    'appointment_completed'
  ) THEN
    RAISE EXCEPTION 'Tipo de notificação inválido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = p_company_id AND cm.user_id = auth.uid()
  ) AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Sem permissão para criar notificação nesta empresa';
  END IF;

  INSERT INTO public.notifications (
    user_id, company_id, type, title, message, recado_id, comment_id
  )
  VALUES (
    p_user_id, p_company_id, p_type, p_title, p_message, p_recado_id, p_comment_id
  )
  RETURNING id INTO nid;

  RETURN nid;
END;
$$;

-- ---------------------------------------------------------------------------
-- Triggers em appointments
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_appointments_notify_team()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client TEXT;
  v_when TEXT;
  v_exclude UUID;
BEGIN
  v_exclude := auth.uid();
  v_client := COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.client_name ELSE NEW.client_name END,
    'Cliente'
  );
  v_when :=
    to_char(
      CASE WHEN TG_OP = 'DELETE' THEN OLD.date ELSE NEW.date END,
      'DD/MM/YYYY'
    )
    || ' às '
    || to_char(
      CASE WHEN TG_OP = 'DELETE' THEN OLD.start_time ELSE NEW.start_time END,
      'HH24:MI'
    );

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('cancelled', 'no_show') THEN
      RETURN NEW;
    END IF;
    PERFORM public.notify_company_appointment_event(
      NEW.company_id,
      'appointment_created',
      'Novo agendamento',
      v_client || ' — ' || v_when,
      NEW.id,
      v_exclude
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
      PERFORM public.notify_company_appointment_event(
        NEW.company_id,
        'appointment_cancelled',
        'Agendamento cancelado',
        v_client || ' — ' || v_when,
        NEW.id,
        v_exclude
      );
    ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
      PERFORM public.notify_company_appointment_event(
        NEW.company_id,
        'appointment_completed',
        'Atendimento concluído',
        v_client || ' — ' || v_when,
        NEW.id,
        v_exclude
      );
    ELSIF (
      OLD.date IS DISTINCT FROM NEW.date
      OR OLD.start_time IS DISTINCT FROM NEW.start_time
      OR OLD.professional_id IS DISTINCT FROM NEW.professional_id
    )
    AND NEW.status NOT IN ('cancelled', 'no_show') THEN
      PERFORM public.notify_company_appointment_event(
        NEW.company_id,
        'appointment_updated',
        'Agendamento alterado',
        v_client || ' — ' || v_when,
        NEW.id,
        v_exclude
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.notify_company_appointment_event(
      OLD.company_id,
      'appointment_cancelled',
      'Agendamento removido',
      v_client || ' — ' || v_when,
      NULL,
      v_exclude
    );
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_notify_team ON public.appointments;
CREATE TRIGGER trg_appointments_notify_team
  AFTER INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_appointments_notify_team();
