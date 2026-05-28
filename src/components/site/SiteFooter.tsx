import type { Company } from "@/types/database.types";
import { WhatsAppPhoneLink } from "@/components/ui/WhatsAppPhoneLink";
import { Mail } from "lucide-react";

interface SiteFooterProps {
  company: Company;
}

export function SiteFooter({ company }: SiteFooterProps) {
  const email = company.email?.trim();

  return (
    <footer
      id="contato"
      className="py-12 px-6 border-t border-border text-center text-sm text-muted-foreground scroll-mt-24"
    >
      {(company.phone || company.owner_phone || email) && (
        <div className="mb-6 flex flex-col items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
            Contato
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 sm:gap-6">
            {company.phone && (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] uppercase text-muted-foreground">Salão</span>
                <WhatsAppPhoneLink phone={company.phone} />
              </div>
            )}
            {company.owner_phone && (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] uppercase text-muted-foreground">
                  {company.owner_name ? company.owner_name : "Responsável"}
                </span>
                <WhatsAppPhoneLink phone={company.owner_phone} />
              </div>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-1.5 text-foreground/90 hover:text-primary hover:underline"
              >
                <Mail className="size-4 shrink-0" aria-hidden />
                {email}
              </a>
            )}
          </div>
        </div>
      )}
      <p>
        © {new Date().getFullYear()} {company.name} · Powered by Auren
      </p>
    </footer>
  );
}
