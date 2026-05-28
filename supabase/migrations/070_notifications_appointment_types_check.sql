-- Migration 062 introduziu tipos de notificação de agendamento nas funções,
-- mas o CHECK da tabela ainda aceitava apenas mention/global (051).
-- Corrige para permitir eventos de agenda sem falhar em DELETE/INSERT.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

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

COMMENT ON CONSTRAINT notifications_type_check ON public.notifications IS
  'Tipos: mural (mention/global) e agenda (appointment_*).';
