import type { Professional } from "@/types/database.types";
import { WhatsAppPhoneLink } from "@/components/ui/WhatsAppPhoneLink";

export interface ProfessionalWithServices extends Professional {
  serviceNames: string[];
}

interface SiteProfessionalsProps {
  professionals: ProfessionalWithServices[];
}

export function SiteProfessionals({ professionals }: SiteProfessionalsProps) {
  const count = professionals.length;
  const countStr = count.toString().padStart(2, "0");

  return (
    <section
      id="equipe"
      className="py-20 px-6 scroll-mt-24 bg-muted/80 dark:bg-black/10 text-foreground relative overflow-hidden"
    >
      {/* Elementos decorativos sutis - pentes/tesouras */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        aria-hidden
      >
      <div
        className="absolute top-20 right-10 w-24 h-24 border border-border dark:border-white/[0.08] rounded-full opacity-30"
        style={{ transform: "rotate(-15deg)" }}
      />
      <div
        className="absolute bottom-20 left-10 w-20 h-20 border border-border dark:border-white/[0.08] opacity-30"
        style={{ transform: "rotate(25deg)" }}
      />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header: "Nossa Equipe" à esquerda, contagem à direita */}
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-12">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Nossa Equipe
          </h2>
          <span className="text-2xl md:text-3xl font-medium text-muted-foreground tabular-nums">
            /{countStr}
          </span>
        </div>

        {/* Cards dos profissionais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {professionals.length === 0 ? (
            <p className="col-span-full text-center text-muted-foreground py-12">
              Nenhum profissional cadastrado
            </p>
          ) : (
            professionals.map((pro) => (
              <article
                key={pro.id}
                className="group flex flex-col bg-card dark:bg-white/[0.03] border border-border dark:border-white/[0.06] hover:border-primary/30 transition-colors overflow-hidden"
              >
                {/* Foto retangular */}
                <div className="aspect-[3/4] bg-muted overflow-hidden">
                  {pro.photo_url ? (
                    <img
                      src={pro.photo_url}
                      alt={pro.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-muted-foreground/50">
                      {pro.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Conteúdo abaixo da foto */}
                <div className="p-5 flex flex-col gap-2">
                  {/* Especialidade / cargo em destaque */}
                  <p className="text-xs md:text-sm font-semibold uppercase tracking-wider text-primary">
                    {pro.specialty || "Profissional"}
                  </p>

                  {/* Nome */}
                  <h3 className="text-lg font-semibold text-foreground">{pro.name}</h3>

                  {/* Serviços que realiza */}
                  {pro.serviceNames && pro.serviceNames.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {pro.serviceNames.join(" · ")}
                    </p>
                  )}
                  {pro.phone && (
                    <WhatsAppPhoneLink
                      phone={pro.phone}
                      className="text-sm mt-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
