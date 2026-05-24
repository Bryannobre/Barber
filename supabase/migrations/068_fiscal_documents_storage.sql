-- Bucket privado para PDFs fiscais (upload apenas via Edge Function + service role)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fiscal-documents',
  'fiscal-documents',
  false,
  5242880,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf']::text[];

-- Leitura: membros da empresa (path: {company_id}/invoices/...)
DROP POLICY IF EXISTS "Fiscal documents read by company staff" ON storage.objects;
CREATE POLICY "Fiscal documents read by company staff"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'fiscal-documents'
    AND (
      public.is_platform_owner()
      OR (storage.foldername(name))[1]::uuid IN (
        SELECT cm.company_id FROM public.company_members cm
        WHERE cm.user_id = auth.uid()
      )
    )
  );

-- Upload/update/delete: apenas service role (Edge Functions) — sem policy INSERT para authenticated
