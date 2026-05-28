-- Tipografia e formatação de texto na landing pública (valores controlados)

ALTER TABLE public.company_landing_settings
  ADD COLUMN IF NOT EXISTS hero_text_align TEXT,
  ADD COLUMN IF NOT EXISTS hero_title_size TEXT,
  ADD COLUMN IF NOT EXISTS hero_title_weight TEXT,
  ADD COLUMN IF NOT EXISTS hero_title_letter_spacing TEXT,
  ADD COLUMN IF NOT EXISTS hero_title_transform TEXT,
  ADD COLUMN IF NOT EXISTS hero_subtitle_size TEXT,
  ADD COLUMN IF NOT EXISTS about_text_align TEXT,
  ADD COLUMN IF NOT EXISTS about_title_size TEXT,
  ADD COLUMN IF NOT EXISTS about_body_size TEXT,
  ADD COLUMN IF NOT EXISTS cta_text_align TEXT,
  ADD COLUMN IF NOT EXISTS cta_title_size TEXT,
  ADD COLUMN IF NOT EXISTS cta_body_size TEXT,
  ADD COLUMN IF NOT EXISTS cta_button_text_size TEXT;

ALTER TABLE public.company_landing_settings
  DROP CONSTRAINT IF EXISTS chk_cls_hero_text_align;
ALTER TABLE public.company_landing_settings
  ADD CONSTRAINT chk_cls_hero_text_align
  CHECK (hero_text_align IS NULL OR hero_text_align IN ('left', 'center', 'right'));

ALTER TABLE public.company_landing_settings
  DROP CONSTRAINT IF EXISTS chk_cls_hero_title_size;
ALTER TABLE public.company_landing_settings
  ADD CONSTRAINT chk_cls_hero_title_size
  CHECK (hero_title_size IS NULL OR hero_title_size IN ('md', 'lg', 'xl'));

ALTER TABLE public.company_landing_settings
  DROP CONSTRAINT IF EXISTS chk_cls_hero_title_weight;
ALTER TABLE public.company_landing_settings
  ADD CONSTRAINT chk_cls_hero_title_weight
  CHECK (hero_title_weight IS NULL OR hero_title_weight IN ('normal', 'medium', 'semibold', 'bold'));

ALTER TABLE public.company_landing_settings
  DROP CONSTRAINT IF EXISTS chk_cls_hero_title_letter_spacing;
ALTER TABLE public.company_landing_settings
  ADD CONSTRAINT chk_cls_hero_title_letter_spacing
  CHECK (hero_title_letter_spacing IS NULL OR hero_title_letter_spacing IN ('normal', 'wide', 'wider'));

ALTER TABLE public.company_landing_settings
  DROP CONSTRAINT IF EXISTS chk_cls_hero_title_transform;
ALTER TABLE public.company_landing_settings
  ADD CONSTRAINT chk_cls_hero_title_transform
  CHECK (hero_title_transform IS NULL OR hero_title_transform IN ('none', 'uppercase', 'capitalize'));

ALTER TABLE public.company_landing_settings
  DROP CONSTRAINT IF EXISTS chk_cls_hero_subtitle_size;
ALTER TABLE public.company_landing_settings
  ADD CONSTRAINT chk_cls_hero_subtitle_size
  CHECK (hero_subtitle_size IS NULL OR hero_subtitle_size IN ('sm', 'md', 'lg'));

ALTER TABLE public.company_landing_settings
  DROP CONSTRAINT IF EXISTS chk_cls_about_text_align;
ALTER TABLE public.company_landing_settings
  ADD CONSTRAINT chk_cls_about_text_align
  CHECK (about_text_align IS NULL OR about_text_align IN ('left', 'center', 'right'));

ALTER TABLE public.company_landing_settings
  DROP CONSTRAINT IF EXISTS chk_cls_about_title_size;
ALTER TABLE public.company_landing_settings
  ADD CONSTRAINT chk_cls_about_title_size
  CHECK (about_title_size IS NULL OR about_title_size IN ('md', 'lg', 'xl'));

ALTER TABLE public.company_landing_settings
  DROP CONSTRAINT IF EXISTS chk_cls_about_body_size;
ALTER TABLE public.company_landing_settings
  ADD CONSTRAINT chk_cls_about_body_size
  CHECK (about_body_size IS NULL OR about_body_size IN ('sm', 'md', 'lg'));

ALTER TABLE public.company_landing_settings
  DROP CONSTRAINT IF EXISTS chk_cls_cta_text_align;
ALTER TABLE public.company_landing_settings
  ADD CONSTRAINT chk_cls_cta_text_align
  CHECK (cta_text_align IS NULL OR cta_text_align IN ('left', 'center', 'right'));

ALTER TABLE public.company_landing_settings
  DROP CONSTRAINT IF EXISTS chk_cls_cta_title_size;
ALTER TABLE public.company_landing_settings
  ADD CONSTRAINT chk_cls_cta_title_size
  CHECK (cta_title_size IS NULL OR cta_title_size IN ('md', 'lg', 'xl'));

ALTER TABLE public.company_landing_settings
  DROP CONSTRAINT IF EXISTS chk_cls_cta_body_size;
ALTER TABLE public.company_landing_settings
  ADD CONSTRAINT chk_cls_cta_body_size
  CHECK (cta_body_size IS NULL OR cta_body_size IN ('sm', 'md', 'lg'));

ALTER TABLE public.company_landing_settings
  DROP CONSTRAINT IF EXISTS chk_cls_cta_button_text_size;
ALTER TABLE public.company_landing_settings
  ADD CONSTRAINT chk_cls_cta_button_text_size
  CHECK (cta_button_text_size IS NULL OR cta_button_text_size IN ('sm', 'md', 'lg'));
