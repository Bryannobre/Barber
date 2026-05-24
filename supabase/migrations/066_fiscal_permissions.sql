-- Permissão de página "fiscal" no app e nas RPCs de equipe (alinhar com APP_PAGE_KEYS)

CREATE OR REPLACE FUNCTION public.app_supported_page_keys()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'dashboard',
    'agenda',
    'clients',
    'services',
    'professionals',
    'financial',
    'stock',
    'payments',
    'reports',
    'mural',
    'notifications',
    'settings',
    'commissions',
    'fiscal'
  ]::TEXT[];
$$;

COMMENT ON FUNCTION public.app_supported_page_keys() IS
  'Chaves de páginas permitidas em company_members. Manter alinhado a APP_PAGE_KEYS no frontend.';

-- Recria validação de upsert_company_member (última versão: 053) usando lista centralizada
CREATE OR REPLACE FUNCTION public.upsert_company_member(
  p_company_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT DEFAULT NULL,
  p_password TEXT DEFAULT NULL,
  p_allowed_pages TEXT[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email TEXT;
  v_phone TEXT;
  v_full_name TEXT;
  v_password TEXT;
  v_user_id UUID;
  v_allowed_pages TEXT[];
  v_supported_pages TEXT[];
BEGIN
  v_supported_pages := public.app_supported_page_keys();

  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Apenas Super Admin pode gerenciar equipe.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company_id) THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  v_email := lower(trim(coalesce(p_email, '')));
  v_phone := NULLIF(trim(coalesce(p_phone, '')), '');
  v_full_name := NULLIF(trim(coalesce(p_full_name, '')), '');
  v_password := NULLIF(trim(coalesce(p_password, '')), '');

  IF v_email = '' THEN
    RAISE EXCEPTION 'Email é obrigatório.';
  END IF;

  IF v_full_name IS NULL THEN
    RAISE EXCEPTION 'Nome completo é obrigatório.';
  END IF;

  IF v_password IS NULL OR length(v_password) < 6 THEN
    RAISE EXCEPTION 'Senha deve ter ao menos 6 caracteres.';
  END IF;

  IF p_allowed_pages IS NULL THEN
    v_allowed_pages := NULL;
  ELSE
    SELECT ARRAY(
      SELECT DISTINCT lower(trim(page))
      FROM unnest(p_allowed_pages) AS page
      WHERE trim(page) <> ''
    )
    INTO v_allowed_pages;

    IF EXISTS (
      SELECT 1
      FROM unnest(v_allowed_pages) AS page
      WHERE page <> ALL(v_supported_pages)
    ) THEN
      RAISE EXCEPTION 'Permissão de página inválida.';
    END IF;
  END IF;

  SELECT u.id
  INTO v_user_id
  FROM auth.users u
  WHERE lower(u.email) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      invited_at,
      confirmation_token,
      confirmation_sent_at,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      now(),
      '',
      now(),
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_full_name, 'phone', coalesce(v_phone, ''), 'company_id', p_company_id::text),
      now(),
      now()
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      now(),
      now()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = crypt(v_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = v_user_id;
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, role, company_id)
  VALUES (v_user_id, v_full_name, v_phone, 'employee', p_company_id)
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    company_id = p_company_id,
    role = 'employee'::public.user_role,
    updated_at = now();

  INSERT INTO public.company_members (user_id, company_id, role, allowed_pages)
  VALUES (v_user_id, p_company_id, 'staff', v_allowed_pages)
  ON CONFLICT (user_id, company_id) DO UPDATE
  SET
    role = EXCLUDED.role,
    allowed_pages = EXCLUDED.allowed_pages;

  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_company_member_profile_and_access(
  p_company_id UUID,
  p_user_id UUID,
  p_full_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_allowed_pages TEXT[] DEFAULT NULL,
  p_password TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
  v_password TEXT;
  v_allowed_pages TEXT[];
  v_supported_pages TEXT[];
BEGIN
  v_supported_pages := public.app_supported_page_keys();

  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Apenas Super Admin pode gerenciar equipe.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_members cm
    WHERE cm.company_id = p_company_id
      AND cm.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Vínculo não encontrado.';
  END IF;

  v_full_name := NULLIF(trim(coalesce(p_full_name, '')), '');
  v_phone := NULLIF(trim(coalesce(p_phone, '')), '');
  v_password := NULLIF(trim(coalesce(p_password, '')), '');

  IF v_full_name IS NULL THEN
    RAISE EXCEPTION 'Nome completo é obrigatório.';
  END IF;

  IF p_allowed_pages IS NULL THEN
    v_allowed_pages := NULL;
  ELSE
    SELECT ARRAY(
      SELECT DISTINCT lower(trim(page))
      FROM unnest(p_allowed_pages) AS page
      WHERE trim(page) <> ''
    )
    INTO v_allowed_pages;

    IF EXISTS (
      SELECT 1
      FROM unnest(v_allowed_pages) AS page
      WHERE page <> ALL(v_supported_pages)
    ) THEN
      RAISE EXCEPTION 'Permissão de página inválida.';
    END IF;
  END IF;

  UPDATE public.profiles p
  SET
    full_name = v_full_name,
    phone = v_phone,
    role = CASE
      WHEN p.role = 'client'::public.user_role THEN 'employee'::public.user_role
      ELSE p.role
    END,
    updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.company_members
  SET
    allowed_pages = v_allowed_pages
  WHERE company_id = p_company_id
    AND user_id = p_user_id;

  IF v_password IS NOT NULL THEN
    IF length(v_password) < 6 THEN
      RAISE EXCEPTION 'Senha deve ter ao menos 6 caracteres.';
    END IF;

    UPDATE auth.users
    SET
      encrypted_password = crypt(v_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = p_user_id;
  END IF;

  RETURN TRUE;
END;
$$;
