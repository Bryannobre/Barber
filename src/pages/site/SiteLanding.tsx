import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  SiteNavbar,
  SiteHero,
  SiteAbout,
  SiteServices,
  SiteProfessionals,
  SiteGallery,
  SiteBookingCTA,
  SiteFooter,
  SiteLandingSkeleton,
  SiteNotFound,
} from "@/components/site";
import { companyService } from "@/services/company.service";
import { companyLandingService } from "@/services/companyLanding.service";
import { serviceService } from "@/services/service.service";
import { professionalService } from "@/services/professional.service";
import { useTenant } from "@/contexts/TenantContext";
import { useSiteMeta } from "@/hooks/useSiteMeta";
import { applyCompanyThemeForSite } from "@/lib/companyTheme";
import { SiteThemeProvider } from "@/contexts/SiteThemeContext";

const SiteLanding = () => {
  const { slug } = useParams<{ slug: string }>();
  const { setCurrentCompanyBySlug } = useTenant();

  const {
    data: companyData,
    isLoading: companyLoading,
    isError: companyError,
  } = useQuery({
    queryKey: ["company", slug],
    queryFn: () => companyService.getBySlug(slug ?? ""),
    enabled: !!slug,
  });

  const company = companyData?.data ?? null;
  const companyId = company?.id ?? "";

  const { data: landingSettingsData } = useQuery({
    queryKey: ["company-landing-settings", companyId],
    queryFn: () => companyLandingService.getByCompanyId(companyId),
    enabled: !!companyId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const landingSettings = landingSettingsData?.data ?? null;

  const { data: servicesData } = useQuery({
    queryKey: ["services-public", companyId],
    queryFn: () => serviceService.listByCompany(companyId),
    enabled: !!companyId,
  });

  const { data: professionalsData } = useQuery({
    queryKey: ["professionals-public", companyId],
    queryFn: () => professionalService.listByCompanyForSite(companyId),
    enabled: !!companyId,
  });

  const services = servicesData?.data ?? [];
  const professionals = professionalsData?.data ?? [];
  const bookingUrl = `/client/booking${slug ? `?company=${slug}` : ""}`;

  useEffect(() => {
    if (slug) {
      setCurrentCompanyBySlug(slug);
    }
  }, [slug, setCurrentCompanyBySlug]);

  useEffect(() => {
    if (company) {
      applyCompanyThemeForSite(company, landingSettings?.primary_color);
    }
    return () => applyCompanyThemeForSite(null);
  }, [company, landingSettings?.primary_color]);

  useSiteMeta({
    company,
    slug,
    isReady: !!company && !!slug,
  });

  if (!slug) {
    return <SiteNotFound />;
  }

  if (companyError || (companyData?.error && !company)) {
    return <SiteNotFound />;
  }

  if (companyLoading || !company) {
    return <SiteLandingSkeleton />;
  }

  const initialTheme =
    (company.dashboard_theme === "dark" || company.dashboard_theme === "light"
      ? company.dashboard_theme
      : "dark") as "dark" | "light";

  const imageTs = landingSettings?.updated_at ?? "";
  const bust = (url: string | null | undefined) =>
    url && url.trim() ? `${url}${url.includes("?") ? "&" : "?"}_t=${imageTs}` : url;

  return (
    <SiteThemeProvider initialTheme={initialTheme}>
      <div className="min-h-screen bg-background">
        <SiteNavbar company={company} bookingUrl={bookingUrl} />
        <SiteHero
          company={company}
          bookingUrl={bookingUrl}
          title={landingSettings?.hero_title}
          subtitle={landingSettings?.hero_subtitle}
          image={bust(landingSettings?.hero_image_url)}
          textAlign={landingSettings?.hero_text_align}
          titleSize={landingSettings?.hero_title_size}
          titleWeight={landingSettings?.hero_title_weight}
          titleLetterSpacing={landingSettings?.hero_title_letter_spacing}
          titleTransform={landingSettings?.hero_title_transform}
          subtitleSize={landingSettings?.hero_subtitle_size}
        />
        <SiteAbout
          company={company}
          text={landingSettings?.about_text}
          title={landingSettings?.about_title}
          titleAccent={landingSettings?.about_title_accent}
          textAlign={landingSettings?.about_text_align}
          titleSize={landingSettings?.about_title_size}
          bodySize={landingSettings?.about_body_size}
          images={[
            bust(landingSettings?.about_image_1_url ?? landingSettings?.about_image_url ?? null),
            bust(landingSettings?.about_image_2_url),
            bust(landingSettings?.about_image_3_url),
            bust(landingSettings?.about_image_4_url),
          ]}
        />
        <SiteServices services={services} bookingUrl={bookingUrl} />
        <SiteProfessionals professionals={professionals} />
        <SiteGallery
          company={company}
          images={
            landingSettings
              ? [
                  bust(landingSettings.gallery_image_1_url),
                  bust(landingSettings.gallery_image_2_url),
                  bust(landingSettings.gallery_image_3_url),
                  bust(landingSettings.gallery_image_4_url),
                  bust(landingSettings.gallery_image_5_url),
                  bust(landingSettings.gallery_image_6_url),
                  bust(landingSettings.gallery_image_7_url),
                  bust(landingSettings.gallery_image_8_url),
                ]
              : undefined
          }
        />
        <SiteBookingCTA
          slug={slug}
          companyName={company.name}
          ctaText={landingSettings?.cta_text}
          buttonText={landingSettings?.cta_button_text}
          textAlign={landingSettings?.cta_text_align}
          titleSize={landingSettings?.cta_title_size}
          bodySize={landingSettings?.cta_body_size}
          buttonTextSize={landingSettings?.cta_button_text_size}
        />
        <SiteFooter company={company} />
      </div>
    </SiteThemeProvider>
  );
};

export default SiteLanding;
