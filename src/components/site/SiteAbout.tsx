import type React from "react";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import type { Company } from "@/types/database.types";
import { WhatsAppPhoneLink } from "@/components/ui/WhatsAppPhoneLink";
import type { AboutTitleAccent } from "@/types/database.types";
import type { LandingBodySize, LandingHeadingSize, LandingTextAlign } from "@/types/database.types";
import { bodySizeClass, headingSizeClass } from "@/lib/landingTypography";
import { cn } from "@/lib/utils";

/** Imagens padrão em cores neutras para seção Sobre */
const ABOUT_GALLERY_DEFAULT = [
  "https://placehold.co/600x600/e5e7eb/9ca3af?text=1",
  "https://placehold.co/600x600/e5e7eb/9ca3af?text=2",
  "https://placehold.co/600x600/e5e7eb/9ca3af?text=3",
  "https://placehold.co/600x600/e5e7eb/9ca3af?text=4",
];

interface SiteAboutProps {
  company: Company;
  /** Texto descritivo da seção sobre */
  text?: string | null;
  /** Título customizado (fallback: company.slogan) */
  title?: string | null;
  /** Onde aplicar cor em destaque no título */
  titleAccent?: AboutTitleAccent | null;
  /** Imagens nas 4 posições (fallback: ABOUT_GALLERY_DEFAULT) */
  images?: (string | null)[];
  textAlign?: LandingTextAlign | null;
  titleSize?: LandingHeadingSize | null;
  bodySize?: LandingBodySize | null;
}

function renderTitleWithAccent(
  title: string,
  accent: AboutTitleAccent | null | undefined
): React.ReactNode {
  const words = title.trim().split(/\s+/);
  if (!words.length) return null;
  const accentMode = accent ?? "last_word";

  if (accentMode === "none") {
    return <span>{title}</span>;
  }
  if (accentMode === "all") {
    return <span className="text-primary">{title}</span>;
  }
  if (accentMode === "first_word") {
    return (
      <>
        <span className="text-primary">{words[0]}</span>
        {words.length > 1 ? " " + words.slice(1).join(" ") : ""}
      </>
    );
  }
  // last_word
  const last = words.pop() ?? "";
  const rest = words.join(" ");
  return (
    <>
      {rest ? rest + " " : ""}
      <span className="text-primary">{last}</span>
    </>
  );
}

export function SiteAbout({
  company,
  text,
  title,
  titleAccent,
  images,
  textAlign,
  titleSize,
  bodySize,
}: SiteAboutProps) {
  const textAlignClass =
    textAlign === "left" ? "text-left" : textAlign === "right" ? "text-right" : "text-center";
  const smallTitle = company.name.toUpperCase();
  const defaultTitle = company.slogan ?? "Seu estilo, nossa arte";
  const largeTitle = title ?? defaultTitle;

  const defaultDescription =
    company.slogan
      ? `Na ${company.name}, cuidamos do seu visual com dedicação e profissionalismo. Nossa equipe está pronta para oferecer os melhores serviços. Agende online e transforme seu estilo.`
      : `${company.name} oferece os melhores serviços para cuidar do seu estilo. Ambiente aconchegante, profissionais qualificados e atendimento de excelência. Agende online e transforme seu visual com praticidade.`;
  const description = text ?? defaultDescription;

  const galleryImages: [string, string, string, string] = [
    images?.[0] ?? ABOUT_GALLERY_DEFAULT[0],
    images?.[1] ?? ABOUT_GALLERY_DEFAULT[1],
    images?.[2] ?? ABOUT_GALLERY_DEFAULT[2],
    images?.[3] ?? ABOUT_GALLERY_DEFAULT[3],
  ].map((src, i) => src || ABOUT_GALLERY_DEFAULT[i]) as [string, string, string, string];

  const ownerName = company.owner_name ?? "Proprietário";
  const ownerRole = "Proprietário";
  const ownerQuote = `É na ${company.name} que nosso cuidado com cada detalhe faz a diferença.`;

  const ownerInitials = ownerName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <section id="sobre" className="py-20 px-6 scroll-mt-24 bg-muted/30">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Coluna esquerda - galeria de fotos */}
        <div className="relative">
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {galleryImages.map((src, i) => (
              <div
                key={`about-img-${i}`}
                className="aspect-[4/3] rounded-xl overflow-hidden bg-muted"
              >
                <img
                  src={src}
                  alt={`${company.name} - Serviços ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          {/* Botão play central (placeholder para futuro vídeo) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/90 flex items-center justify-center shadow-lg ring-4 ring-background/50">
              <Play className="text-primary-foreground" size={28} fill="currentColor" />
            </div>
          </div>
        </div>

        {/* Coluna direita - texto e informações */}
        <div className="relative overflow-hidden rounded-2xl">
          {/* Fundo com imagem borrada */}
          <div
            className="absolute inset-0 bg-cover bg-center scale-110 blur-xl opacity-30"
            style={{
              backgroundImage: `url(${galleryImages[0]})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-card/95 via-card/90 to-muted/95" />

          <div className={cn("relative z-10 p-8 md:p-10 lg:p-12", textAlignClass)}>
            {/* Título pequeno - nome da empresa */}
            <p className="text-sm font-semibold tracking-[0.2em] text-foreground/80 uppercase mb-3">
              {smallTitle}
            </p>

            {/* Frase de efeito - título grande */}
            <h2
              className={cn(
                "font-bold text-foreground leading-tight mb-6",
                headingSizeClass(titleSize)
              )}
            >
              {renderTitleWithAccent(largeTitle, titleAccent)}
            </h2>

            {/* Texto explicativo */}
            <p className={cn("text-foreground/90 leading-relaxed mb-8", bodySizeClass(bodySize))}>
              {description}
            </p>

            {/* Bloco do dono: foto, nome e cargo */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center shrink-0 ring-2 ring-primary/50">
                <span className="text-lg font-bold text-primary">
                  {ownerInitials}
                </span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground italic mb-1">{ownerQuote}</p>
                <p className="font-semibold text-primary">
                  {ownerName}, {ownerRole}
                </p>
                {company.owner_phone && (
                  <WhatsAppPhoneLink
                    phone={company.owner_phone}
                    className="text-sm mt-2"
                  />
                )}
              </div>
            </div>

            {/* Botão Saiba mais */}
            <a href="#servicos">
              <Button
                variant="outline"
                className="border-2 border-primary text-foreground hover:bg-primary/20 hover:border-primary hover:text-foreground font-semibold tracking-wide px-8 py-6"
              >
                SAIBA MAIS
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
