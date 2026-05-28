import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import type { LandingBodySize, LandingHeadingSize, LandingTextAlign } from "@/types/database.types";
import { bodySizeClass, buttonTextSizeClass, headingSizeClass } from "@/lib/landingTypography";
import { cn } from "@/lib/utils";

interface SiteBookingCTAProps {
  slug: string;
  companyName?: string;
  /** Texto do CTA (fallback: "Agende seu horário agora") */
  ctaText?: string | null;
  /** Texto do botão (fallback: "Agendar agora") */
  buttonText?: string | null;
  textAlign?: LandingTextAlign | null;
  titleSize?: LandingHeadingSize | null;
  bodySize?: LandingBodySize | null;
  buttonTextSize?: LandingBodySize | null;
}

export function SiteBookingCTA({
  slug,
  companyName,
  ctaText,
  buttonText,
  textAlign,
  titleSize,
  bodySize,
  buttonTextSize,
}: SiteBookingCTAProps) {
  const bookingUrl = `/client/booking?company=${slug}`;
  const title = ctaText ?? "Agende seu horário agora";
  const btnLabel = buttonText ?? "Agendar agora";

  const textAlignClass =
    textAlign === "left" ? "text-left items-start" : textAlign === "right" ? "text-right items-end" : "text-center items-center";

  return (
    <section
      className="relative py-24 px-6 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--primary) / 0.95) 0%, hsl(var(--primary) / 0.85) 50%, hsl(var(--primary) / 0.75) 100%)",
      }}
    >
      {/* Padrão sutil para dar profundidade */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
        aria-hidden
      />

      <div className={cn("relative max-w-4xl mx-auto flex flex-col", textAlignClass)}>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/25 backdrop-blur-sm mb-6">
          <Calendar className="text-white" size={28} strokeWidth={2} />
        </div>

        <h2
          className={cn(
            "font-bold text-white mb-4 tracking-tight drop-shadow-sm",
            headingSizeClass(titleSize)
          )}
        >
          {title}
        </h2>

        <p className={cn("text-white/95 max-w-xl mb-10", bodySizeClass(bodySize))}>
          Escolha o serviço, profissional e horário em poucos cliques.
        </p>

        <Link to={bookingUrl} className="inline-block">
          <Button
            size="lg"
            className={cn(
              "font-semibold px-10 py-7 bg-white text-primary hover:bg-white/95 shadow-xl transition-all duration-300 ease-out hover:scale-105 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/25 hover:ring-4 hover:ring-white/50",
              buttonTextSizeClass(buttonTextSize)
            )}
          >
            {btnLabel}
          </Button>
        </Link>
      </div>
    </section>
  );
}
