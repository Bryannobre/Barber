import { useEffect } from "react";
import { PLATFORM_BRAND } from "@/lib/platformBrand";
import type { Company } from "@/types/database.types";

interface UseSiteMetaOptions {
  company: Company | null;
  slug: string | undefined;
  isReady: boolean;
}

/**
 * Atualiza meta tags dinâmicas (title, description, Open Graph) para SEO da landing da empresa.
 */
export function useSiteMeta({ company, slug, isReady }: UseSiteMetaOptions) {
  useEffect(() => {
    if (!isReady || !company || !slug) return;

    const title = `${company.name} | ${PLATFORM_BRAND.name}`;
    const description =
      company.slogan ??
      `${company.name} - Agende online e transforme seu visual.`;

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/site/${slug}`;
    const imageUrl = company.logo_url ?? company.logo ?? undefined;

    // Title
    document.title = title;

    // Description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", description);
    } else {
      const el = document.createElement("meta");
      el.name = "description";
      el.content = description;
      document.head.appendChild(el);
    }

    // Open Graph
    const setOrCreateMeta = (
      property: string,
      content: string,
      isProperty = true
    ) => {
      const attr = isProperty ? "property" : "name";
      const selector = `meta[${attr}="${property}"]`;
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, property);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    setOrCreateMeta("og:title", title);
    setOrCreateMeta("og:description", description);
    setOrCreateMeta("og:url", url);
    setOrCreateMeta("og:type", "website");
    if (imageUrl) setOrCreateMeta("og:image", imageUrl);

    return () => {
      document.title = PLATFORM_BRAND.name;
    };
  }, [company, slug, isReady]);
}
