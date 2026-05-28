-- =============================================================================
-- RESET + SEED — Salão Meire Reis (demo operacional)
-- =============================================================================
-- Onde rodar: Supabase Dashboard → SQL → New query → colar tudo → Run
--
-- Preserva: companies, company_members, auth.users, profiles, landing,
--           company_fiscal_settings
--
-- Remove e recria: serviços, profissionais, clientes, agenda, financeiro,
--                  estoque, recados, metas, notas fiscais da empresa
--
-- Ajuste o ID abaixo se necessário:
--   8ac59242-3ef8-45a2-85ed-19a94c174df0  (slug: meire-reis)
--
-- Se falhar com notifications_type_check: o bloco abaixo corrige (também em
-- supabase/migrations/070_notifications_appointment_types_check.sql).
-- =============================================================================

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'mention',
    'global',
    'appointment_created',
    'appointment_cancelled',
    'appointment_updated',
    'appointment_completed'
  ));

BEGIN;

DO $seed$
DECLARE
  v_co UUID := '8ac59242-3ef8-45a2-85ed-19a94c174df0';

  -- profissionais inseridos
  v_pro_ana   UUID;
  v_pro_jul   UUID;
  v_pro_cam   UUID;
  v_pro_fer   UUID;
  v_pro_pat   UUID;

  -- agendamentos
  v_apt_id    UUID;
  v_i         INT;
  v_attempts  INT := 0;
  v_created   INT := 0;
  v_day_off   INT;
  v_apt_date  DATE;
  v_dow       INT;
  v_pro_id    UUID;
  v_pro_name  TEXT;
  v_client_id UUID;
  v_client_nm TEXT;
  v_client_ph TEXT;
  v_start_min INT;
  v_duration  INT;
  v_status    appointment_status;
  v_pay       TEXT;
  v_slot      INT;
  v_amount    NUMERIC(10,2);
  v_svc_names TEXT[];
  v_svc_ids   UUID[];
  v_r         FLOAT;
  v_occurred_at TIMESTAMPTZ;

  -- estoque
  v_prod_id   UUID;

BEGIN
  -- -------------------------------------------------------------------------
  -- Validação
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = v_co AND slug = 'meire-reis'
  ) THEN
    RAISE EXCEPTION 'Empresa não encontrada (id=%). Confira o UUID antes de executar.', v_co;
  END IF;

  RAISE NOTICE 'Meire Reis: limpando dados operacionais...';

  -- Evita centenas de notificações ao apagar/inserir agendamentos em massa
  ALTER TABLE public.appointments DISABLE TRIGGER trg_appointments_notify_team;

  -- -------------------------------------------------------------------------
  -- 1) LIMPEZA (somente esta empresa)
  -- -------------------------------------------------------------------------
  DELETE FROM public.invoice_logs WHERE company_id = v_co;
  DELETE FROM public.invoices WHERE company_id = v_co;
  DELETE FROM public.financial_records WHERE company_id = v_co;

  DELETE FROM public.appointment_services
  WHERE appointment_id IN (SELECT id FROM public.appointments WHERE company_id = v_co);

  DELETE FROM public.appointments WHERE company_id = v_co;
  DELETE FROM public.notifications WHERE company_id = v_co;

  DELETE FROM public.stock_movements WHERE company_id = v_co;
  DELETE FROM public.stock_products WHERE company_id = v_co;

  DELETE FROM public.professional_service_commissions WHERE company_id = v_co;
  DELETE FROM public.monthly_professional_summary WHERE company_id = v_co;
  DELETE FROM public.professional_payment_settings WHERE company_id = v_co;

  DELETE FROM public.working_hours
  WHERE professional_id IN (SELECT id FROM public.professionals WHERE company_id = v_co);

  DELETE FROM public.professional_services
  WHERE professional_id IN (SELECT id FROM public.professionals WHERE company_id = v_co);

  DELETE FROM public.professionals WHERE company_id = v_co;
  DELETE FROM public.services WHERE company_id = v_co;

  DELETE FROM public.recado_comments
  WHERE recado_id IN (SELECT id FROM public.recados WHERE company_id = v_co);

  DELETE FROM public.recado_mentions
  WHERE recado_id IN (SELECT id FROM public.recados WHERE company_id = v_co);

  DELETE FROM public.recados WHERE company_id = v_co;
  DELETE FROM public.company_clients WHERE company_id = v_co;
  DELETE FROM public.company_performance_goals WHERE company_id = v_co;

  RAISE NOTICE 'Limpeza concluída. Inserindo dados demo...';

  -- -------------------------------------------------------------------------
  -- 2) SERVIÇOS
  -- -------------------------------------------------------------------------
  INSERT INTO public.services (company_id, name, duration_minutes, price, category, execution_mode)
  VALUES
    (v_co, 'Corte feminino',          45,  95.00,  'corte',        'sequential'),
    (v_co, 'Escova',                  40,  70.00,  'finalização',  'sequential'),
    (v_co, 'Hidratação',              60, 120.00,  'tratamento',   'sequential'),
    (v_co, 'Coloração',              120, 280.00,  'coloração',    'sequential'),
    (v_co, 'Mechas / luzes',         150, 380.00,  'coloração',    'sequential'),
    (v_co, 'Progressiva',            180, 420.00,  'química',      'sequential'),
    (v_co, 'Manicure',                45,  45.00,  'unhas',        'parallel'),
    (v_co, 'Pedicure',                50,  55.00,  'unhas',        'parallel'),
    (v_co, 'Alongamento em gel',      90, 150.00,  'unhas',        'sequential'),
    (v_co, 'Design de sobrancelha',   30,  50.00,  'estética',     'sequential'),
    (v_co, 'Maquiagem social',        60, 140.00,  'maquiagem',    'sequential'),
    (v_co, 'Penteado para festa',     90, 180.00,  'eventos',      'sequential');

  -- -------------------------------------------------------------------------
  -- 3) PROFISSIONAIS
  -- -------------------------------------------------------------------------
  INSERT INTO public.professionals (company_id, name, specialty, is_active)
  VALUES (v_co, 'Ana Paula Ribeiro', 'Cabeleireira', true)
  RETURNING id INTO v_pro_ana;

  INSERT INTO public.professionals (company_id, name, specialty, is_active)
  VALUES (v_co, 'Juliana Costa', 'Colorista', true)
  RETURNING id INTO v_pro_jul;

  INSERT INTO public.professionals (company_id, name, specialty, is_active)
  VALUES (v_co, 'Camila Mendes', 'Manicure e pedicure', true)
  RETURNING id INTO v_pro_cam;

  INSERT INTO public.professionals (company_id, name, specialty, is_active)
  VALUES (v_co, 'Fernanda Lima', 'Estética e maquiagem', true)
  RETURNING id INTO v_pro_fer;

  INSERT INTO public.professionals (company_id, name, specialty, is_active)
  VALUES (v_co, 'Patrícia Souza', 'Tratamentos capilares', true)
  RETURNING id INTO v_pro_pat;

  -- Horários seg–sáb 09:00–19:00
  INSERT INTO public.working_hours (professional_id, day_of_week, start_time, end_time)
  SELECT p.id, d.dow, '09:00'::time, '19:00'::time
  FROM (VALUES (v_pro_ana), (v_pro_jul), (v_pro_cam), (v_pro_fer), (v_pro_pat)) AS p(id)
  CROSS JOIN generate_series(1, 6) AS d(dow);

  -- Vínculo profissional ↔ serviço
  INSERT INTO public.professional_services (professional_id, service_id)
  SELECT p.id, s.id
  FROM public.professionals p
  JOIN public.services s ON s.company_id = v_co
  WHERE p.company_id = v_co
    AND (
      (p.id = v_pro_ana AND s.name IN ('Corte feminino', 'Escova', 'Hidratação', 'Penteado para festa'))
      OR (p.id = v_pro_jul AND s.name IN ('Coloração', 'Mechas / luzes', 'Hidratação', 'Progressiva'))
      OR (p.id = v_pro_cam AND s.name IN ('Manicure', 'Pedicure', 'Alongamento em gel'))
      OR (p.id = v_pro_fer AND s.name IN ('Design de sobrancelha', 'Maquiagem social'))
      OR (p.id = v_pro_pat AND s.name IN ('Hidratação', 'Progressiva', 'Escova'))
    );

  INSERT INTO public.professional_payment_settings (
    company_id, professional_id, salario_fixo_mensal, percentual_comissao_padrao, fechamento_dia, ativo
  )
  VALUES
    (v_co, v_pro_ana, 2500, 25, 30, true),
    (v_co, v_pro_jul, 2800, 30, 30, true),
    (v_co, v_pro_cam, 2200, 20, 30, true),
    (v_co, v_pro_fer, 2100, 22, 30, true),
    (v_co, v_pro_pat, 2400, 28, 30, true);

  -- -------------------------------------------------------------------------
  -- 4) CLIENTES (28 fictícios)
  -- -------------------------------------------------------------------------
  INSERT INTO public.company_clients (company_id, full_name, phone, email, notes)
  VALUES
    (v_co, 'Mariana Silva',      '(61) 98100-0001', 'mariana.silva0@exemplo.demo', NULL),
    (v_co, 'Beatriz Santos',     '(61) 98100-0002', 'beatriz.santos1@exemplo.demo', NULL),
    (v_co, 'Carla Oliveira',     '(61) 98100-0003', 'carla.oliveira2@exemplo.demo', NULL),
    (v_co, 'Fernanda Souza',     '(61) 98100-0004', 'fernanda.souza3@exemplo.demo', NULL),
    (v_co, 'Juliana Lima',       '(61) 98100-0005', 'juliana.lima4@exemplo.demo', 'Cliente preferencial — demo'),
    (v_co, 'Patrícia Costa',     '(61) 98100-0006', 'patricia.costa5@exemplo.demo', NULL),
    (v_co, 'Amanda Ferreira',    '(61) 98100-0007', 'amanda.ferreira6@exemplo.demo', NULL),
    (v_co, 'Larissa Almeida',    '(61) 98100-0008', 'larissa.almeida7@exemplo.demo', NULL),
    (v_co, 'Camila Pereira',     '(61) 98100-0009', 'camila.pereira8@exemplo.demo', NULL),
    (v_co, 'Gabriela Ribeiro',   '(61) 98100-0010', 'gabriela.ribeiro9@exemplo.demo', 'Cliente preferencial — demo'),
    (v_co, 'Renata Carvalho',    '(61) 98100-0011', 'renata.carvalho10@exemplo.demo', NULL),
    (v_co, 'Aline Gomes',        '(61) 98100-0012', 'aline.gomes11@exemplo.demo', NULL),
    (v_co, 'Bruna Martins',      '(61) 98100-0013', 'bruna.martins12@exemplo.demo', NULL),
    (v_co, 'Débora Araújo',      '(61) 98100-0014', 'debora.araujo13@exemplo.demo', NULL),
    (v_co, 'Eliane Barbosa',     '(61) 98100-0015', 'eliane.barbosa14@exemplo.demo', 'Cliente preferencial — demo'),
    (v_co, 'Helena Rocha',       '(61) 98100-0016', 'helena.rocha15@exemplo.demo', NULL),
    (v_co, 'Isabela Silva',      '(61) 98100-0017', 'isabela.silva16@exemplo.demo', NULL),
    (v_co, 'Jéssica Santos',     '(61) 98100-0018', 'jessica.santos17@exemplo.demo', NULL),
    (v_co, 'Karina Oliveira',    '(61) 98100-0019', 'karina.oliveira18@exemplo.demo', NULL),
    (v_co, 'Luciana Souza',      '(61) 98100-0020', 'luciana.souza19@exemplo.demo', 'Cliente preferencial — demo'),
    (v_co, 'Michele Lima',       '(61) 98100-0021', 'michele.lima20@exemplo.demo', NULL),
    (v_co, 'Natália Costa',      '(61) 98100-0022', 'natalia.costa21@exemplo.demo', NULL),
    (v_co, 'Olívia Ferreira',    '(61) 98100-0023', 'olivia.ferreira22@exemplo.demo', NULL),
    (v_co, 'Paula Almeida',      '(61) 98100-0024', 'paula.almeida23@exemplo.demo', NULL),
    (v_co, 'Raquel Pereira',     '(61) 98100-0025', 'raquel.pereira24@exemplo.demo', 'Cliente preferencial — demo'),
    (v_co, 'Vitória Gomes',      '(61) 98100-0026', 'vitoria.gomes25@exemplo.demo', NULL),
    (v_co, 'Yasmin Martins',     '(61) 98100-0027', 'yasmin.martins26@exemplo.demo', NULL),
    (v_co, 'Bianca Araújo',      '(61) 98100-0028', 'bianca.araujo27@exemplo.demo', NULL);

  -- Slots ocupados (evita conflito de horário)
  CREATE TEMP TABLE seed_occupied (
    professional_id UUID NOT NULL,
    apt_date DATE NOT NULL,
    start_min INT NOT NULL,
    PRIMARY KEY (professional_id, apt_date, start_min)
  ) ON COMMIT DROP;

  -- -------------------------------------------------------------------------
  -- 5) AGENDAMENTOS (~55) + financeiro nos concluídos
  -- -------------------------------------------------------------------------
  WHILE v_created < 55 AND v_attempts < 800 LOOP
    v_attempts := v_attempts + 1;
    v_day_off := (floor(random() * 43)::int - 28); -- -28 .. +14
    v_apt_date := CURRENT_DATE + v_day_off;
    v_dow := EXTRACT(DOW FROM v_apt_date)::int;
    IF v_dow = 0 THEN CONTINUE; END IF; -- sem domingo

    -- profissional aleatório
    v_r := random();
    IF v_r < 0.2 THEN
      v_pro_id := v_pro_ana; v_pro_name := 'Ana Paula Ribeiro';
    ELSIF v_r < 0.4 THEN
      v_pro_id := v_pro_jul; v_pro_name := 'Juliana Costa';
    ELSIF v_r < 0.6 THEN
      v_pro_id := v_pro_cam; v_pro_name := 'Camila Mendes';
    ELSIF v_r < 0.8 THEN
      v_pro_id := v_pro_fer; v_pro_name := 'Fernanda Lima';
    ELSE
      v_pro_id := v_pro_pat; v_pro_name := 'Patrícia Souza';
    END IF;

    -- 1 ou 2 serviços do profissional
    SELECT COALESCE(array_agg(sub.id), ARRAY[]::uuid[]),
           COALESCE(array_agg(sub.name), ARRAY[]::text[])
    INTO v_svc_ids, v_svc_names
    FROM (
      SELECT s.id, s.name
      FROM public.services s
      INNER JOIN public.professional_services ps
        ON ps.service_id = s.id AND ps.professional_id = v_pro_id
      ORDER BY random()
      LIMIT (CASE WHEN random() > 0.65 THEN 2 ELSE 1 END)
    ) sub;

    IF array_length(v_svc_ids, 1) IS NULL THEN CONTINUE; END IF;

    SELECT
      COALESCE(SUM(CASE WHEN COALESCE(execution_mode, 'sequential') = 'sequential' THEN duration_minutes ELSE 0 END), 0)
      + COALESCE(MAX(CASE WHEN execution_mode = 'parallel' THEN duration_minutes END), 0),
      COALESCE(SUM(price), 0)
    INTO v_duration, v_amount
    FROM public.services
    WHERE id = ANY (v_svc_ids);

    IF v_duration IS NULL OR v_duration <= 0 THEN CONTINUE; END IF;

    v_start_min := 540 + (floor(random() * GREATEST(1, ((1140 - v_duration - 540) / 30) + 1))::int * 30);

    -- verifica disponibilidade
    IF EXISTS (
      SELECT 1 FROM generate_series(0, v_duration - 30, 30) AS g(off)
      JOIN seed_occupied o
        ON o.professional_id = v_pro_id
       AND o.apt_date = v_apt_date
       AND o.start_min = v_start_min + g.off
    ) THEN
      CONTINUE;
    END IF;

    IF v_start_min + v_duration > 1140 OR v_start_min < 540 THEN CONTINUE; END IF;

    SELECT id, full_name, phone
    INTO v_client_id, v_client_nm, v_client_ph
    FROM public.company_clients
    WHERE company_id = v_co
    ORDER BY random()
    LIMIT 1;

    IF v_day_off < 0 THEN
      v_r := random();
      IF v_r < 0.55 THEN v_status := 'completed';
      ELSIF v_r < 0.70 THEN v_status := 'cancelled';
      ELSIF v_r < 0.80 THEN v_status := 'no_show';
      ELSE v_status := 'confirmed';
      END IF;
    ELSIF v_day_off > 7 THEN
      v_status := CASE WHEN random() > 0.4 THEN 'pending' ELSE 'confirmed' END;
    ELSE
      v_status := 'confirmed';
    END IF;

    v_pay := CASE v_status
      WHEN 'completed' THEN (ARRAY['pix','cash','credit_card','debit_card','transfer'])[1 + floor(random() * 5)::int]
      ELSE NULL
    END;

    INSERT INTO public.appointments (
      company_id, professional_id, date, start_time, duration_minutes,
      status, client_name, client_phone, company_client_id, payment_method
    ) VALUES (
      v_co, v_pro_id, v_apt_date,
      (lpad((v_start_min / 60)::text, 2, '0') || ':' || lpad((v_start_min % 60)::text, 2, '0') || ':00')::time,
      v_duration, v_status, v_client_nm, v_client_ph, v_client_id, v_pay
    )
    RETURNING id INTO v_apt_id;

    INSERT INTO public.appointment_services (appointment_id, service_id)
    SELECT v_apt_id, unnest(v_svc_ids);

    FOR v_slot IN SELECT generate_series(0, v_duration - 30, 30) LOOP
      INSERT INTO seed_occupied (professional_id, apt_date, start_min)
      VALUES (v_pro_id, v_apt_date, v_start_min + v_slot)
      ON CONFLICT DO NOTHING;
    END LOOP;

    IF v_status = 'completed' THEN
      -- created_at = fim do atendimento (o app filtra financeiro por created_at, não pela data da agenda)
      v_occurred_at := (
        v_apt_date::timestamp
        + (v_start_min + v_duration) * INTERVAL '1 minute'
      );

      INSERT INTO public.financial_records (
        company_id, appointment_id, type, source, description, amount,
        service_name_snapshot, client_name_snapshot, professional_name_snapshot,
        payment_method, is_valid, created_at
      ) VALUES (
        v_co, v_apt_id, 'income', 'appointment',
        array_to_string(v_svc_names, ' + '),
        v_amount,
        array_to_string(v_svc_names, ', '),
        v_client_nm, v_pro_name, v_pay, true,
        v_occurred_at
      );
    END IF;

    v_created := v_created + 1;
  END LOOP;

  RAISE NOTICE 'Agendamentos criados: %', v_created;

  -- -------------------------------------------------------------------------
  -- 6) ESTOQUE
  -- -------------------------------------------------------------------------
  INSERT INTO public.stock_products (
    company_id, name, category, brand, unit, unit_type,
    minimum_stock, cost_price, sale_price, current_quantity, is_active
  ) VALUES
    (v_co, 'Shampoo profissional 1L', 'Cabelo', 'Wella', 'ml', 'ml', 500, 89, NULL, 2000, true),
    (v_co, 'Máscara hidratação 500g', 'Cabelo', 'L''Oréal', 'g', 'g', 200, 65, NULL, 1500, true),
    (v_co, 'Tintura 7.0', 'Coloração', 'Koleston', 'unidade', 'unit', 5, 28, 45, 24, true),
    (v_co, 'Oxidante 20 volumes', 'Coloração', 'Wella', 'ml', 'ml', 500, 35, NULL, 3000, true),
    (v_co, 'Esmalte gel premium', 'Unhas', 'Impala', 'unidade', 'unit', 10, 22, 38, 36, true),
    (v_co, 'Acetona 500ml', 'Unhas', 'Risqué', 'ml', 'ml', 200, 18, NULL, 2000, true),
    (v_co, 'Algodão rolo', 'Descartáveis', 'Cremer', 'unidade', 'unit', 3, 12, NULL, 12, true),
    (v_co, 'Lixa profissional', 'Unhas', 'World Beauty', 'unidade', 'unit', 20, 2.5, 5, 100, true),
    (v_co, 'Pinça para sobrancelha', 'Estética', 'Mundial', 'unidade', 'unit', 2, 35, NULL, 8, true),
    (v_co, 'Base fortalecedora', 'Unhas', 'Risqué', 'unidade', 'unit', 8, 15, 28, 30, true);

  FOR v_prod_id IN
    SELECT id FROM public.stock_products WHERE company_id = v_co
  LOOP
    INSERT INTO public.stock_movements (company_id, product_id, movement_type, quantity, reason)
    SELECT v_co, v_prod_id, 'entry', current_quantity, 'Estoque inicial — seed demo'
    FROM public.stock_products WHERE id = v_prod_id;

    IF random() > 0.5 THEN
      INSERT INTO public.stock_movements (company_id, product_id, movement_type, quantity, reason)
      SELECT v_co, v_prod_id, 'usage', GREATEST(1, floor(current_quantity * 0.05)), 'Consumo atendimento — demo'
      FROM public.stock_products WHERE id = v_prod_id;
    END IF;
  END LOOP;

  -- -------------------------------------------------------------------------
  -- 7) RECADOS + META
  -- -------------------------------------------------------------------------
  INSERT INTO public.recados (company_id, titulo, mensagem, autor, prioridade, fixado)
  VALUES
    (v_co, 'Promoção escova + hidratação', 'Combo especial até o fim do mês. Divulguem nas redes!', 'Meire Reis', 'importante', true),
    (v_co, 'Estoque de tintura', 'Conferir saldo da linha 7.0 antes do fim de semana.', 'Gestão', 'normal', false),
    (v_co, 'Treinamento colorimetria', 'Sábado 14h — sala de apoio. Presença da equipe de coloração.', 'Juliana Costa', 'normal', false);

  INSERT INTO public.company_performance_goals (company_id, name, period_type, metric, target_value)
  VALUES (v_co, 'Meta receita mensal', 'monthly', 'revenue', 45000);

  ALTER TABLE public.appointments ENABLE TRIGGER trg_appointments_notify_team;

  RAISE NOTICE 'Seed Meire Reis concluído com sucesso.';
END;
$seed$;

COMMIT;

-- Conferência rápida (opcional — pode rodar depois):
-- SELECT 'services' AS t, count(*) FROM services WHERE company_id = '8ac59242-3ef8-45a2-85ed-19a94c174df0'
-- UNION ALL SELECT 'professionals', count(*) FROM professionals WHERE company_id = '8ac59242-3ef8-45a2-85ed-19a94c174df0'
-- UNION ALL SELECT 'clients', count(*) FROM company_clients WHERE company_id = '8ac59242-3ef8-45a2-85ed-19a94c174df0'
-- UNION ALL SELECT 'appointments', count(*) FROM appointments WHERE company_id = '8ac59242-3ef8-45a2-85ed-19a94c174df0'
-- UNION ALL SELECT 'financial', count(*) FROM financial_records WHERE company_id = '8ac59242-3ef8-45a2-85ed-19a94c174df0';
