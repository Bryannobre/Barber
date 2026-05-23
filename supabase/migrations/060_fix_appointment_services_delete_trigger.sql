-- Ao remover vínculos de serviços (ex.: exclusão do agendamento), não zerar duração
-- em appointments — evita violar chk_appointments_valid_interval (ends_at > starts_at).

CREATE OR REPLACE FUNCTION public.sync_appointment_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_appointment_id UUID;
  new_duration INT;
  service_count INT;
BEGIN
  v_appointment_id := COALESCE(NEW.appointment_id, OLD.appointment_id);

  SELECT COUNT(*)::INT
  INTO service_count
  FROM public.appointment_services
  WHERE appointment_id = v_appointment_id;

  IF service_count = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT public.calculate_appointment_duration(v_appointment_id)
  INTO new_duration;

  IF new_duration IS NULL OR new_duration <= 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.appointments
  SET
    duration_minutes = new_duration,
    ends_at = starts_at + (new_duration || ' minutes')::interval
  WHERE id = v_appointment_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.sync_appointment_duration() IS
  'Recalcula duração/ends_at quando appointment_services muda; ignora se não restar serviço (ex.: DELETE em cascata).';
