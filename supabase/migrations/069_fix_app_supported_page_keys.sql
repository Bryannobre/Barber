-- Alinhar app_supported_page_keys com APP_PAGE_KEYS do frontend (performance + fiscal).

CREATE OR REPLACE FUNCTION public.app_supported_page_keys()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'dashboard',
    'performance',
    'agenda',
    'clients',
    'services',
    'professionals',
    'financial',
    'stock',
    'payments',
    'reports',
    'fiscal',
    'mural',
    'notifications',
    'settings',
    'commissions'
  ]::TEXT[];
$$;

COMMENT ON FUNCTION public.app_supported_page_keys() IS
  'Chaves validadas em company_members. Manter sincronizado com APP_PAGE_KEYS (useCompanyPageAccess.ts).';
