import type { Company } from "@/types/database.types";

interface SiteFooterProps {
  company: Company;
}

export function SiteFooter({ company }: SiteFooterProps) {
  return (
    <footer id="contato" className="py-12 px-6 border-t border-border text-center text-sm text-muted-foreground scroll-mt-24">
      <p>
        © {new Date().getFullYear()} {company.name} · Powered by Auren
      </p>
    </footer>
  );
}
