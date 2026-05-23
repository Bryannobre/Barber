-- Calcula duração do agendamento a partir dos serviços (execution_mode) antes de validar overlap

CREATE OR REPLACE FUNCTION public.create_public_appointment(
  p_company_id UUID,
  p_professional_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_duration_minutes INT,
  p_service_ids UUID[],
  p_client_name TEXT,
  p_client_phone TEXT,
  p_client_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_exists BOOLEAN;
  v_prof_exists BOOLEAN;
  v_services_valid BOOLEAN;
  v_apt_id UUID;
  v_sid UUID;
  v_company_client_id UUID;
  v_duration INT;
  v_starts_at TIMESTAMPTZ;
  v_ends_at TIMESTAMPTZ;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM companies
    WHERE id = p_company_id AND status = 'active'
  ) INTO v_company_exists;
  IF NOT v_company_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Empresa não encontrada ou inativa');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM professionals
    WHERE id = p_professional_id
      AND company_id = p_company_id
      AND is_active = true
  ) INTO v_prof_exists;
  IF NOT v_prof_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profissional não encontrado');
  END IF;

  IF array_length(p_service_ids, 1) IS NULL OR array_length(p_service_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selecione ao menos um serviço');
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM unnest(p_service_ids) AS s(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM services
      WHERE id = s.id AND company_id = p_company_id
    )
  ) INTO v_services_valid;
  IF NOT v_services_valid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Serviço inválido');
  END IF;

  IF NULLIF(TRIM(p_client_name), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome é obrigatório');
  END IF;
  IF NULLIF(TRIM(p_client_phone), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Telefone é obrigatório');
  END IF;

  SELECT
    COALESCE(SUM(s.duration_minutes) FILTER (
      WHERE COALESCE(s.execution_mode, 'sequential') = 'sequential'
    ), 0)
    + COALESCE(MAX(s.duration_minutes) FILTER (
      WHERE COALESCE(s.execution_mode, 'sequential') = 'parallel'
    ), 0)
  INTO v_duration
  FROM services s
  WHERE s.id = ANY (p_service_ids);

  IF v_duration IS NULL OR v_duration <= 0 THEN
    v_duration := GREATEST(COALESCE(p_duration_minutes, 0), 1);
  END IF;

  v_starts_at := ((p_date + p_start_time)::timestamp AT TIME ZONE 'America/Sao_Paulo');
  v_ends_at := v_starts_at + (v_duration || ' minutes')::interval;

  IF EXISTS (
    SELECT 1
    FROM appointments a
    WHERE a.professional_id = p_professional_id
      AND a.status IN ('pending', 'confirmed', 'blocked')
      AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(v_starts_at, v_ends_at, '[)')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Horário indisponível. Este profissional já tem um agendamento neste horário.'
    );
  END IF;

  v_company_client_id := get_or_create_company_client(
    p_company_id,
    TRIM(p_client_name),
    TRIM(p_client_phone),
    p_client_email
  );

  INSERT INTO appointments (
    company_id,
    client_id,
    company_client_id,
    client_name,
    client_phone,
    client_email,
    professional_id,
    date,
    start_time,
    duration_minutes,
    status
  ) VALUES (
    p_company_id,
    NULL,
    v_company_client_id,
    TRIM(p_client_name),
    TRIM(p_client_phone),
    NULLIF(TRIM(COALESCE(p_client_email, '')), ''),
    p_professional_id,
    p_date,
    p_start_time,
    v_duration,
    'confirmed'
  )
  RETURNING id INTO v_apt_id;

  FOREACH v_sid IN ARRAY p_service_ids
  LOOP
    INSERT INTO appointment_services (appointment_id, service_id)
    VALUES (v_apt_id, v_sid);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'appointment_id', v_apt_id);
END;
$$;
