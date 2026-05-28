import { supabase } from "@/lib/supabase";
import { requireCompanyId } from "@/lib/companyScope";
import type {
  CompanyLandingSettings,
  AboutTitleAccent,
  LandingBodySize,
  LandingFontWeight,
  LandingHeadingSize,
  LandingLetterSpacing,
  LandingTextAlign,
  LandingTextTransform,
} from "@/types/database.types";

export interface LandingSettingsInput {
  hero_title?: string | null;
  hero_subtitle?: string | null;
  hero_image_url?: string | null;
  about_text?: string | null;
  about_image_url?: string | null;
  about_title?: string | null;
  about_title_accent?: AboutTitleAccent | null;
  about_image_1_url?: string | null;
  about_image_2_url?: string | null;
  about_image_3_url?: string | null;
  about_image_4_url?: string | null;
  gallery_image_1_url?: string | null;
  gallery_image_2_url?: string | null;
  gallery_image_3_url?: string | null;
  gallery_image_4_url?: string | null;
  gallery_image_5_url?: string | null;
  gallery_image_6_url?: string | null;
  gallery_image_7_url?: string | null;
  gallery_image_8_url?: string | null;
  cta_text?: string | null;
  cta_button_text?: string | null;
  hero_text_align?: LandingTextAlign | null;
  hero_title_size?: LandingHeadingSize | null;
  hero_title_weight?: LandingFontWeight | null;
  hero_title_letter_spacing?: LandingLetterSpacing | null;
  hero_title_transform?: LandingTextTransform | null;
  hero_subtitle_size?: LandingBodySize | null;
  about_text_align?: LandingTextAlign | null;
  about_title_size?: LandingHeadingSize | null;
  about_body_size?: LandingBodySize | null;
  cta_text_align?: LandingTextAlign | null;
  cta_title_size?: LandingHeadingSize | null;
  cta_body_size?: LandingBodySize | null;
  cta_button_text_size?: LandingBodySize | null;
  primary_color?: string | null;
  secondary_color?: string | null;
}

export const companyLandingService = {
  async getByCompanyId(companyId: string) {
    requireCompanyId(companyId);
    const { data, error } = await supabase
      .from("company_landing_settings")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    return { data: data as CompanyLandingSettings | null, error };
  },

  async upsertLandingSettings(companyId: string, input: LandingSettingsInput) {
    requireCompanyId(companyId);
    const payload = {
      company_id: companyId,
      hero_title: input.hero_title ?? null,
      hero_subtitle: input.hero_subtitle ?? null,
      hero_image_url: input.hero_image_url ?? null,
      about_text: input.about_text ?? null,
      about_image_url: input.about_image_url ?? null,
      about_title: input.about_title ?? null,
      about_title_accent: input.about_title_accent ?? null,
      about_image_1_url: input.about_image_1_url ?? null,
      about_image_2_url: input.about_image_2_url ?? null,
      about_image_3_url: input.about_image_3_url ?? null,
      about_image_4_url: input.about_image_4_url ?? null,
      gallery_image_1_url: input.gallery_image_1_url ?? null,
      gallery_image_2_url: input.gallery_image_2_url ?? null,
      gallery_image_3_url: input.gallery_image_3_url ?? null,
      gallery_image_4_url: input.gallery_image_4_url ?? null,
      gallery_image_5_url: input.gallery_image_5_url ?? null,
      gallery_image_6_url: input.gallery_image_6_url ?? null,
      gallery_image_7_url: input.gallery_image_7_url ?? null,
      gallery_image_8_url: input.gallery_image_8_url ?? null,
      cta_text: input.cta_text ?? null,
      cta_button_text: input.cta_button_text ?? null,
      hero_text_align: input.hero_text_align ?? null,
      hero_title_size: input.hero_title_size ?? null,
      hero_title_weight: input.hero_title_weight ?? null,
      hero_title_letter_spacing: input.hero_title_letter_spacing ?? null,
      hero_title_transform: input.hero_title_transform ?? null,
      hero_subtitle_size: input.hero_subtitle_size ?? null,
      about_text_align: input.about_text_align ?? null,
      about_title_size: input.about_title_size ?? null,
      about_body_size: input.about_body_size ?? null,
      cta_text_align: input.cta_text_align ?? null,
      cta_title_size: input.cta_title_size ?? null,
      cta_body_size: input.cta_body_size ?? null,
      cta_button_text_size: input.cta_button_text_size ?? null,
      primary_color: input.primary_color ?? null,
      secondary_color: input.secondary_color ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("company_landing_settings")
      .upsert(payload, {
        onConflict: "company_id",
        ignoreDuplicates: false,
      })
      .select()
      .single();

    return { data: data as CompanyLandingSettings | null, error };
  },

  async updateLandingSettings(
    companyId: string,
    input: Partial<LandingSettingsInput>
  ) {
    requireCompanyId(companyId);
    const payload: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined) delete payload[k];
    });

    const { data, error } = await supabase
      .from("company_landing_settings")
      .update(payload)
      .eq("company_id", companyId)
      .select()
      .single();

    return { data: data as CompanyLandingSettings | null, error };
  },
};
